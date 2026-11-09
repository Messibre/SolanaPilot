/**
 * Ollama provider for local LLM inference.
 * Strictly fetch-based without third-party SDKs per Agent.md §7.
 * Adheres strictly to Agent.md §6, §10, and §13.
 * Zero vscode imports allowed.
 */

import type { LlmClient, LlmRequest, LlmResult } from "../types";
import { guardedFetch } from "../../security/urlGuard";
import {
  ConfigError,
  ParseFailureError,
  ProviderError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
  SolanaPilotError,
  classify,
} from "../../core/errors";

declare module "../types" {
  interface LlmResult {
    warnings?: string[];
    metadata?: Record<string, unknown>;
  }
}

export interface OllamaClientOptions {
  baseUrl?: string;
  isLocal?: boolean;
  defaultModel?: string;
  defaultTimeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class OllamaClient implements LlmClient {
  public readonly id = "ollama" as const;
  private readonly baseUrl: string;
  private readonly isLocal: boolean;
  private readonly defaultModel: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchFn?: typeof fetch;

  constructor(options?: OllamaClientOptions) {
    this.baseUrl = options?.baseUrl ?? "http://127.0.0.1:11434";
    this.defaultModel = options?.defaultModel ?? "codellama";
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 120_000;
    this.fetchFn = options?.fetchFn;

    if (options?.isLocal !== undefined) {
      this.isLocal = options.isLocal;
    } else {
      this.isLocal = this.isLoopbackHost(this.baseUrl);
    }
  }

  private assertAllowedUrl(): void {
    const isLoopback = this.isLoopbackHost(this.baseUrl);
    if (!isLoopback && !this.isLocal) {
      throw new ConfigError(
        `Ollama provider refused non-loopback URL '${this.baseUrl}'. Set isLocal: true to allow remote endpoints.`
      );
    }
  }

  public async generate(req: LlmRequest): Promise<LlmResult> {
    this.assertAllowedUrl();
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const model = req.model ?? this.defaultModel;

    const messages = [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages,
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (req.jsonMode) {
      body.format = "json";
    }
    if (req.temperature !== undefined) {
      body.options = { temperature: req.temperature };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    if (req.signal) {
      req.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const response = await guardedFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
        {
          allowLoopback: this.isLocal,
          fetchFn: this.fetchFn,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody: string;
        try {
          errBody = await response.text();
        } catch {
          errBody = response.statusText;
        }
        throw this.mapHttpStatus(response.status, errBody);
      }

      return await this.parseChatResponse(response, model, req.jsonMode);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      this.handleError(err);
    }
  }

  public async listModels(): Promise<string[]> {
    this.assertAllowedUrl();
    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/api/tags`;

    try {
      const response = await guardedFetch(
        endpoint,
        { method: "GET" },
        {
          allowLoopback: this.isLocal,
          fetchFn: this.fetchFn,
        }
      );

      if (!response.ok) {
        throw new ConfigError(`Ollama failed to list models: HTTP ${response.status}`);
      }

      const json = (await response.json()) as {
        models?: Array<{ name?: string; model?: string }>;
      };

      return (json.models ?? []).map((m) => m.name ?? m.model ?? "").filter(Boolean);
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  public async healthCheck(modelToCheck?: string): Promise<void> {
    const target = modelToCheck ?? this.defaultModel;
    const installed = await this.listModels();

    const hasModel =
      installed.includes(target) ||
      installed.some(
        (m) => m.startsWith(`${target}:`) || target.startsWith(`${m.split(":")[0]}:`)
      );

    if (!hasModel) {
      throw new ConfigError(
        `Ollama model '${target}' is not installed. Run 'ollama pull ${target}' to install it.`
      );
    }
  }

  private isLoopbackHost(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();
      return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
    } catch {
      return false;
    }
  }

  private async parseChatResponse(
    response: Response,
    model: string,
    jsonMode?: boolean
  ): Promise<LlmResult> {
    const json = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const text = json.message?.content;
    if (text === undefined || text === null || text.trim().length === 0) {
      throw new ParseFailureError("Ollama provider returned empty content");
    }

    let isJson = false;
    try {
      JSON.parse(text);
      isJson = true;
    } catch {
      isJson = false;
    }

    let warnings: string[] | undefined;
    if (jsonMode && !isJson) {
      warnings = ["Model output is not valid JSON despite jsonMode requested"];
    }

    const usage = {
      promptTokens: json.prompt_eval_count ?? 0,
      completionTokens: json.eval_count ?? 0,
      totalTokens: (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0),
    };

    return {
      text,
      provider: "ollama",
      model,
      usage,
      metadata: { isJson },
      warnings,
    };
  }

  private mapHttpStatus(status: number, body: string): SolanaPilotError {
    if (status === 404) {
      return new ConfigError(`Ollama endpoint or model not found (404): ${body}`);
    }
    if (status === 429) {
      return new ProviderRateLimitedError(`Ollama rate limited: ${body}`);
    }
    if (status >= 500) {
      return new ProviderError(`Ollama server error (${status}): ${body}`, true);
    }
    return new ProviderError(`Ollama request error (${status}): ${body}`, false);
  }

  private handleError(err: unknown): never {
    if (err instanceof SolanaPilotError) {
      throw err;
    }

    const name = (err as Error)?.name;
    const msg = String((err as Error)?.message ?? err);
    const code = (err as { cause?: { code?: string } })?.cause?.code;

    if (code === "ECONNREFUSED" || /econnrefused|fetch failed/i.test(msg)) {
      throw new ConfigError(
        `Ollama service is not running at ${this.baseUrl}. Please start the Ollama service (e.g. 'ollama serve') and try again.`,
        err
      );
    }

    if (name === "AbortError" || /abort|timed? out/i.test(msg)) {
      throw new ProviderTimeoutError("Ollama request timed out", err);
    }

    throw classify(err);
  }
}
