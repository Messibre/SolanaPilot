/**
 * Gemini AI provider client using @google/genai SDK.
 * Adheres strictly to Agent.md §6, §7, and §10.
 * Zero vscode imports allowed.
 */

import type { LlmClient, LlmRequest, LlmResult } from "../types";
import type { SolanaPilotConfig } from "../../core/config";
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

interface GeminiCandidate {
  finishReason?: string;
}

interface GeminiPromptFeedback {
  blockReason?: string;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  text?: string;
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  usageMetadata?: GeminiUsageMetadata;
}

interface GeminiModels {
  generateContent(params: {
    model: string;
    contents: unknown[];
    config?: Record<string, unknown>;
  }): Promise<GeminiGenerateContentResponse>;
}

interface GoogleGenAIInstance {
  models: GeminiModels;
}

type GoogleGenAIConstructor = new (opts: {
  apiKey: string;
  httpOptions?: { fetch?: typeof fetch };
}) => GoogleGenAIInstance;

let genAiConstructor: GoogleGenAIConstructor | undefined;

async function getGoogleGenAI(): Promise<GoogleGenAIConstructor> {
  if (!genAiConstructor) {
    const mod = await import("@google/genai");
    genAiConstructor = mod.GoogleGenAI as unknown as GoogleGenAIConstructor;
  }
  return genAiConstructor;
}

export interface GeminiClientOptions {
  apiKey: string;
  config?: SolanaPilotConfig;
  defaultModel?: string;
  fetchFn?: typeof fetch;
}

export class GeminiClient implements LlmClient {
  public readonly id = "gemini" as const;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly fetchFn?: typeof fetch;
  private aiInstance?: GoogleGenAIInstance;

  constructor(options: GeminiClientOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new AuthError("Gemini API key is missing or empty");
    }
    this.apiKey = options.apiKey;
    this.defaultModel =
      options.defaultModel ?? options.config?.model ?? "gemini-2.0-flash";
    this.fetchFn = options.fetchFn;
  }

  private async getAi(): Promise<GoogleGenAIInstance> {
    if (!this.aiInstance) {
      const GoogleGenAI = await getGoogleGenAI();
      this.aiInstance = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: this.fetchFn ? { fetch: this.fetchFn } : undefined,
      });
    }
    return this.aiInstance;
  }

  public async generate(req: LlmRequest): Promise<LlmResult> {
    const model = req.model ?? this.defaultModel;

    // Filter out system message and format messages for contents
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    // System instruction from request or system message
    const systemInstruction =
      req.system ?? req.messages.find((m) => m.role === "system")?.content;

    const genConfig: Record<string, unknown> = {};
    if (systemInstruction) {
      genConfig.systemInstruction = systemInstruction;
    }
    if (req.jsonMode) {
      genConfig.responseMimeType = "application/json";
    }
    if (req.temperature !== undefined) {
      genConfig.temperature = req.temperature;
    }
    if (req.maxTokens !== undefined) {
      genConfig.maxOutputTokens = req.maxTokens;
    }

    try {
      const ai = await this.getAi();
      const response = await ai.models.generateContent({
        model,
        contents,
        config: genConfig,
      });

      // Check for safety finish reason
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === "SAFETY") {
        throw new DomainRefusalError(
          "Gemini generation was blocked by safety policy"
        );
      }

      if (response.promptFeedback?.blockReason) {
        throw new DomainRefusalError(
          `Gemini prompt blocked by safety policy: ${response.promptFeedback.blockReason}`
        );
      }

      const text = response.text;
      if (!text || text.trim().length === 0) {
        throw new ParseFailureError("Gemini returned an empty response");
      }

      const usageMetadata = response.usageMetadata;
      const usage = usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            completionTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
          }
        : undefined;

      return {
        text,
        provider: "gemini",
        model,
        usage,
      };
    } catch (err: unknown) {
      throw this.mapError(err);
    }
  }

  public async healthCheck(): Promise<void> {
    await this.generate({
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 5,
    });
  }

  private mapError(err: unknown): SolanaPilotError {
    if (err instanceof SolanaPilotError) {
      return err;
    }

    const errObj = err as {
      status?: number;
      statusCode?: number;
      name?: string;
      message?: string;
    };
    const status = errObj?.status ?? errObj?.statusCode;
    const msg = String(errObj?.message ?? err);
    const name = errObj?.name ?? "";

    if (
      status === 401 ||
      /API_KEY_INVALID|UNAUTHENTICATED|invalid api key/i.test(msg)
    ) {
      return new AuthError(
        "Invalid Gemini API key or unauthorized request",
        err
      );
    }

    if (
      status === 429 ||
      /RESOURCE_EXHAUSTED|rate limit|quota exceeded/i.test(msg)
    ) {
      return new ProviderRateLimitedError("Gemini API rate limit exceeded", err);
    }

    if (
      status === 503 ||
      status === 500 ||
      /UNAVAILABLE|internal server error|overloaded/i.test(msg)
    ) {
      return new ProviderError("Gemini service is currently unavailable", true, err);
    }

    if (
      name === "AbortError" ||
      /abort|timed? out|deadline exceeded/i.test(msg)
    ) {
      return new ProviderTimeoutError("Gemini request timed out", err);
    }

    if (/SAFETY|blocked by safety/i.test(msg)) {
      return new DomainRefusalError("Gemini blocked generation for safety", err);
    }

    return classify(err);
  }
}
