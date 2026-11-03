/**
 * Multi-provider LLM gateway with timeout, retry backoff, and fallback chain.
 * Adheres strictly to Agent.md §6 and §10.
 * Zero vscode imports allowed.
 */

import type { SolanaPilotConfig } from "../core/config";
import type { ProviderId } from "../core/validation";
import {
  classify,
  ConfigError,
  ProviderTimeoutError,
  SolanaPilotError,
} from "../core/errors";
import { redact } from "../security/redact";
import type {
  LlmClient,
  LlmRequest,
  LlmResult,
  SecretStore,
} from "./types";

export type ClientFactory = (
  id: ProviderId,
  config: SolanaPilotConfig,
  apiKey?: string
) => LlmClient;

export interface LlmGatewayOptions {
  config: SolanaPilotConfig;
  secrets?: SecretStore;
  clientFactory?: ClientFactory;
  sleepFn?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

async function getSecret(
  store: SecretStore | undefined,
  key: string
): Promise<string | undefined> {
  if (!store) return undefined;
  if (typeof store === "function") {
    return await store(key);
  }
  return store[key];
}

async function resolveApiKeyForProvider(
  provider: ProviderId,
  secrets: SecretStore | undefined
): Promise<string | undefined> {
  if (provider === "mock" || provider === "ollama") {
    return undefined;
  }

  const keyNames: Record<string, string[]> = {
    gemini: ["geminiApiKey", "GEMINI_API_KEY"],
    anthropic: ["anthropicApiKey", "ANTHROPIC_API_KEY"],
    openaiCompatible: ["openaiApiKey", "OPENAI_API_KEY"],
  };

  const candidates = keyNames[provider] ?? [`${provider}ApiKey`];
  for (const k of candidates) {
    const val = await getSecret(secrets, k);
    if (val && val.trim().length > 0) {
      return val.trim();
    }
  }

  throw new ConfigError(
    `Missing API key for AI provider '${provider}'. Please configure '${candidates[0]}' in secrets.`
  );
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class LlmGateway {
  private readonly config: SolanaPilotConfig;
  private readonly secrets?: SecretStore;
  private readonly clientFactory?: ClientFactory;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(options: LlmGatewayOptions) {
    this.config = options.config;
    this.secrets = options.secrets;
    this.clientFactory = options.clientFactory;
    this.sleepFn = options.sleepFn ?? defaultSleep;
    this.timeoutMs = options.timeoutMs ?? options.config.timeouts.requestMs;
  }

  /**
   * Generates a completion through the provider chain.
   */
  public async generate(request: LlmRequest): Promise<LlmResult> {
    const primaryProvider = this.config.provider;
    const fallbackList = this.config.fallbackOrder.filter(
      (p) => p !== primaryProvider
    );
    const candidateChain: ProviderId[] = [primaryProvider, ...fallbackList];

    let lastError: SolanaPilotError | undefined;

    for (let i = 0; i < candidateChain.length; i++) {
      const providerId = candidateChain[i];

      try {
        const apiKey = await resolveApiKeyForProvider(providerId, this.secrets);
        const client = this.getClient(providerId, apiKey);
        return await this.callWithRetryAndTimeout(client, request);
      } catch (err: unknown) {
        const classified = classify(err);
        lastError = classified;

        // Never fallback on auth or config errors
        if (classified.category === "auth" || classified.category === "config") {
          this.sanitizeAndThrow(classified);
        }

        // Only fallback on retryable provider errors, timeouts, or rate limits
        const isFallbackEligible =
          classified.retryable &&
          (classified.category === "provider_timeout" ||
            classified.category === "provider_rate_limited" ||
            classified.category === "provider_error");

        if (!isFallbackEligible || i === candidateChain.length - 1) {
          this.sanitizeAndThrow(classified);
        }
        // Fallback to next provider in candidateChain
      }
    }

    if (lastError) {
      this.sanitizeAndThrow(lastError);
    }

    throw new ConfigError("No AI providers available in gateway");
  }

  private getClient(id: ProviderId, apiKey?: string): LlmClient {
    if (this.clientFactory) {
      return this.clientFactory(id, this.config, apiKey);
    }
    throw new ConfigError(`No client factory configured for provider '${id}'`);
  }

  private async callWithRetryAndTimeout(
    client: LlmClient,
    request: LlmRequest
  ): Promise<LlmResult> {
    const maxRetries = this.config.retries.maxRetries;
    const timeoutMs = this.timeoutMs;

    let lastErr: SolanaPilotError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.executeWithTimeout(
          (signal) => client.generate({ ...request, signal }),
          timeoutMs,
          client.id
        );
        const latencyMs = Date.now() - startTime;
        return {
          ...result,
          latencyMs,
          provider: client.id,
        };
      } catch (err: unknown) {
        const classified = classify(err);
        lastErr = classified;

        // Fails fast: do not retry non-retryable categories (auth, config, 400, etc.)
        if (!classified.retryable || attempt === maxRetries) {
          throw classified;
        }

        // Exponential backoff with jitter
        const baseMs = 200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 100);
        await this.sleepFn(baseMs + jitter);
      }
    }

    throw lastErr;
  }

  private async executeWithTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    providerId: ProviderId
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new ProviderTimeoutError(
            `Provider '${providerId}' request timed out after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(controller.signal), timeoutPromise]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private sanitizeAndThrow(error: SolanaPilotError): never {
    const redactedUserMessage = String(redact(error.userMessage));
    const redactedMessage = String(redact(error.message));
    Object.defineProperty(error, "userMessage", {
      value: redactedUserMessage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(error, "message", {
      value: redactedMessage,
      configurable: true,
      writable: true,
    });
    throw error;
  }
}
