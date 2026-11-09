/**
 * Anthropic Claude provider using the Messages API.
 * Strictly fetch-based without third-party SDKs per Agent.md §7.
 * Adheres strictly to Agent.md §6, §10, and §13.
 * Zero vscode imports allowed.
 */

import type { LlmClient, LlmRequest, LlmResult } from "../types";
import { guardedFetch } from "../../security/urlGuard";
import { redact } from "../../security/redact";
import {
  AuthError,
  DomainRefusalError,
  ParseFailureError,
  ProviderError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
  SolanaPilotError,
  classify,
} from "../../core/errors";

export interface AnthropicClientOptions {
  apiKey?: string;
  baseUrl?: string;
  isLocal?: boolean;
  defaultModel?: string;
  apiVersion?: string;
  fetchFn?: typeof fetch;
}

export class AnthropicClient implements LlmClient {
  public readonly id = "anthropic" as const;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly isLocal: boolean;
  private readonly defaultModel: string;
  private readonly apiVersion: string;
  private readonly fetchFn?: typeof fetch;

  constructor(options?: AnthropicClientOptions) {
    this.apiKey = options?.apiKey;
    this.baseUrl = options?.baseUrl ?? "https://api.anthropic.com";
    this.isLocal = options?.isLocal ?? false;
    this.defaultModel = options?.defaultModel ?? "claude-3-5-sonnet-20241022";
    this.apiVersion = options?.apiVersion ?? "2023-06-01";
    this.fetchFn = options?.fetchFn;
  }

  public async generate(req: LlmRequest): Promise<LlmResult> {
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/v1/messages`;
    const model = req.model ?? this.defaultModel;

    const { systemPrompt, messages } = this.formatMessages(req);

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: req.maxTokens ?? 4096,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (req.temperature !== undefined) {
      body.temperature = req.temperature;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": this.apiVersion,
    };

    if (this.apiKey && this.apiKey.trim().length > 0) {
      headers["x-api-key"] = this.apiKey.trim();
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

      return await this.parseResponse(response, model);
    } catch (err: unknown) {
      if (err instanceof SolanaPilotError) {
        throw err;
      }

      const name = (err as Error)?.name;
      const msg = String((err as Error)?.message ?? err);

      if (name === "AbortError" || /abort|timed? out/i.test(msg)) {
        throw new ProviderTimeoutError("Anthropic provider request timed out", err);
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

  private formatMessages(req: LlmRequest): {
    systemPrompt: string | undefined;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  } {
    const systemParts: string[] = [];
    if (req.system && req.system.trim().length > 0) {
      systemParts.push(req.system.trim());
    }

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (const msg of req.messages) {
      if (msg.role === "system") {
        if (msg.content.trim().length > 0) {
          systemParts.push(msg.content.trim());
        }
      } else {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    const systemPrompt = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
    return { systemPrompt, messages };
  }

  private async parseResponse(response: Response, model: string): Promise<LlmResult> {
    const json = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    if (json.stop_reason === "refusal") {
      throw new DomainRefusalError("Anthropic model refused to fulfill the prompt");
    }

    const textBlocks = json.content?.filter((b) => b.type === "text" && typeof b.text === "string");
    const text = textBlocks?.map((b) => b.text).join("") ?? "";

    if (text.trim().length === 0) {
      throw new ParseFailureError("Anthropic provider returned empty content");
    }

    const usage = json.usage
      ? {
          promptTokens: json.usage.input_tokens ?? 0,
          completionTokens: json.usage.output_tokens ?? 0,
          totalTokens: (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
        }
      : undefined;

    return {
      text,
      provider: "anthropic",
      model,
      usage,
    };
  }

  private mapHttpStatus(status: number, rawBody: string): SolanaPilotError {
    const sanitizedMsg = String(redact(rawBody));

    if (status === 401 || status === 403) {
      return new AuthError(
        `Anthropic authentication failed (${status}): ${sanitizedMsg}`
      );
    }

    if (status === 429) {
      return new ProviderRateLimitedError(
        `Anthropic rate limit exceeded: ${sanitizedMsg}`
      );
    }

    if (status === 500 || status === 503 || status === 529) {
      return new ProviderError(
        `Anthropic server error (${status}): ${sanitizedMsg}`,
        true
      );
    }

    if (status === 400) {
      return new ProviderError(
        `Anthropic bad request (${status}): ${sanitizedMsg}`,
        false
      );
    }

    return classify(new Error(`HTTP ${status}: ${sanitizedMsg}`));
  }
}
