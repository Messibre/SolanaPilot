/**
 * OpenAI-compatible provider (OpenAI, OpenRouter, and custom endpoints).
 * Strictly fetch-based without third-party SDKs per Agent.md §7.
 * Adheres strictly to Agent.md §6, §10, and §13.
 * Zero vscode imports allowed.
 */

import type { LlmClient, LlmRequest, LlmResult } from "../types";
import { guardedFetch } from "../../security/urlGuard";
import { redact } from "../../security/redact";
import {
  AuthError,
  ParseFailureError,
  ProviderError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
  SolanaPilotError,
  classify,
} from "../../core/errors";

export type OpenAiPreset = "openai" | "openrouter" | "custom";

export interface OpenAiCompatibleClientOptions {
  preset: OpenAiPreset;
  apiKey?: string;
  baseUrl?: string;
  isLocal?: boolean;
  defaultModel?: string;
  fetchFn?: typeof fetch;
}

export class OpenAiCompatibleClient implements LlmClient {
  public readonly id = "openaiCompatible" as const;
  private readonly preset: OpenAiPreset;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly isLocal: boolean;
  private readonly defaultModel: string;
  private readonly fetchFn?: typeof fetch;

  constructor(options: OpenAiCompatibleClientOptions) {
    this.preset = options.preset;
    this.apiKey = options.apiKey;
    this.isLocal = options.isLocal ?? false;
    this.fetchFn = options.fetchFn;

    if (this.preset === "openai") {
      this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
      this.defaultModel = options.defaultModel ?? "gpt-4o";
    } else if (this.preset === "openrouter") {
      this.baseUrl = options.baseUrl ?? "https://openrouter.ai/api/v1";
      this.defaultModel = options.defaultModel ?? "anthropic/claude-3.5-sonnet";
    } else {
      this.baseUrl = options.baseUrl ?? "http://127.0.0.1:8000/v1";
      this.defaultModel = options.defaultModel ?? "custom-model";
    }
  }

  public async generate(req: LlmRequest): Promise<LlmResult> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const model = req.model ?? this.defaultModel;

    const messages = [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages,
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (req.temperature !== undefined) {
      body.temperature = req.temperature;
    }
    if (req.maxTokens !== undefined) {
      body.max_tokens = req.maxTokens;
    }
    if (req.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers["Authorization"] = `Bearer ${this.apiKey.trim()}`;
    }

    if (this.preset === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/solana-pilot/solana-pilot";
      headers["X-Title"] = "SolanaPilot";
    }

    try {
      const response = await guardedFetch(
        endpoint,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: req.signal,
        },
        {
          allowLoopback: this.isLocal,
          fetchFn: this.fetchFn,
        }
      );

      if (!response.ok) {
        let errBody: string;
        try {
          errBody = await response.text();
        } catch {
          errBody = response.statusText;
        }
        throw this.mapHttpStatus(response.status, errBody);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const choice = json.choices?.[0];
      const text = choice?.message?.content;
      if (text === undefined || text === null || text.trim().length === 0) {
        throw new ParseFailureError("OpenAI-compatible provider returned empty content");
      }

      const usage = json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          }
        : undefined;

      return {
        text,
        provider: "openaiCompatible",
        model,
        usage,
      };
    } catch (err: unknown) {
      if (err instanceof SolanaPilotError) {
        throw err;
      }

      const name = (err as Error)?.name;
      const msg = String((err as Error)?.message ?? err);

      if (name === "AbortError" || /abort|timed? out/i.test(msg)) {
        throw new ProviderTimeoutError("OpenAI-compatible provider request timed out", err);
      }

      throw classify(err);
    }
  }

  public async healthCheck(): Promise<void> {
    await this.generate({
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 5,
    });
  }

  private mapHttpStatus(status: number, rawBody: string): SolanaPilotError {
    const sanitizedMsg = String(redact(rawBody));

    if (status === 401 || status === 403) {
      return new AuthError(
        `OpenAI-compatible authentication failed (${status}): ${sanitizedMsg}`
      );
    }

    if (status === 429) {
      return new ProviderRateLimitedError(
        `OpenAI-compatible rate limit exceeded: ${sanitizedMsg}`
      );
    }

    if (status >= 500 && status <= 599) {
      return new ProviderError(
        `OpenAI-compatible server error (${status}): ${sanitizedMsg}`,
        true
      );
    }

    if (status === 400) {
      return new ProviderError(
        `OpenAI-compatible bad request (${status}): ${sanitizedMsg}`,
        false
      );
    }

    return classify(new Error(`HTTP ${status}: ${sanitizedMsg}`));
  }
}
