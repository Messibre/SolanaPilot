/**
 * Scriptable mock AI provider for deterministic, offline testing.
 * Adheres strictly to Agent.md §6, §10, and §11.
 * Zero vscode imports allowed.
 */

import type { LlmClient, LlmRequest, LlmResult } from "../types";

export type ScriptedItem =
  | { type: "response"; result: Partial<LlmResult> | string; delayMs?: number }
  | { type: "error"; error: Error; delayMs?: number };

export class MockLlmClient implements LlmClient {
  public readonly id = "mock" as const;
  private queue: ScriptedItem[] = [];
  public readonly calls: LlmRequest[] = [];
  private isHealthy = true;
  private readonly defaultResponse: string | Partial<LlmResult>;

  constructor(options?: { defaultResponse?: string | Partial<LlmResult> }) {
    this.defaultResponse = options?.defaultResponse ?? "Mock default response";
  }

  public enqueueResponse(result: string | Partial<LlmResult>, delayMs?: number): this {
    this.queue.push({ type: "response", result, delayMs });
    return this;
  }

  public enqueueError(error: Error, delayMs?: number): this {
    this.queue.push({ type: "error", error, delayMs });
    return this;
  }

  public setHealthy(healthy: boolean): this {
    this.isHealthy = healthy;
    return this;
  }

  public async healthCheck(): Promise<void> {
    if (!this.isHealthy) {
      throw new Error("Mock provider is unhealthy");
    }
  }

  public async generate(req: LlmRequest): Promise<LlmResult> {
    this.calls.push(req);

    if (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) {
        return this.buildDefaultResult(req);
      }

      if (item.delayMs && item.delayMs > 0) {
        if (req.signal?.aborted) {
          throw new Error("Request aborted before delay");
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, item.delayMs);
          req.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("Request aborted during mock delay"));
          });
        });
      }

      if (item.type === "error") {
        throw item.error;
      }

      const res = item.result;
      const text = typeof res === "string" ? res : res.text ?? "";
      return {
        text,
        provider: "mock",
        model: typeof res === "object" && res.model ? res.model : req.model ?? "mock-model",
        usage:
          typeof res === "object" && res.usage
            ? res.usage
            : { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        latencyMs: item.delayMs ?? 1,
      };
    }

    return this.buildDefaultResult(req);
  }

  private buildDefaultResult(req: LlmRequest): LlmResult {
    const defaultRes = this.defaultResponse;
    const text = typeof defaultRes === "string" ? defaultRes : defaultRes.text ?? "";
    return {
      text,
      provider: "mock",
      model:
        typeof defaultRes === "object" && defaultRes.model
          ? defaultRes.model
          : req.model ?? "mock-model",
      usage:
        typeof defaultRes === "object" && defaultRes.usage
          ? defaultRes.usage
          : { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      latencyMs: 1,
    };
  }

  public getCallCount(): number {
    return this.calls.length;
  }

  public getLastCall(): LlmRequest | undefined {
    return this.calls[this.calls.length - 1];
  }

  public clearCalls(): void {
    this.calls.length = 0;
  }

  public clearQueue(): void {
    this.queue = [];
  }
}
