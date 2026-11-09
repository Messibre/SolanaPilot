import { describe, it, expect, vi } from "vitest";
import { LlmGateway } from "./gateway";
import type { LlmClient, LlmRequest, LlmResult } from "./types";
import { loadConfig } from "../core/config";
import {
  ConfigError,
  AuthError,
  ProviderError,
  ProviderTimeoutError,
  ProviderRateLimitedError,
} from "../core/errors";

function createMockClient(
  id: "gemini" | "anthropic" | "openaiCompatible" | "ollama" | "mock",
  generateFn: (req: LlmRequest) => Promise<LlmResult>
): LlmClient {
  return {
    id,
    generate: vi.fn().mockImplementation(generateFn),
    healthCheck: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ai/gateway - LlmGateway", () => {
  it("fails fast with ConfigError before network call if required API key is missing", async () => {
    const config = loadConfig({ provider: "gemini" });
    const mockClient = createMockClient("gemini", async () => ({
      text: "hello",
      provider: "gemini",
      model: "gemini-2.0-flash",
    }));

    const gateway = new LlmGateway({
      config,
      secrets: {}, // Missing geminiApiKey
      clientFactory: () => mockClient,
    });

    await expect(
      gateway.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(ConfigError);

    expect(mockClient.generate).not.toHaveBeenCalled();
  });

  it("never includes API key in error message when call fails", async () => {
    const SECRET_KEY = "AIzaSySecretKeyValue123456789";
    const config = loadConfig({ provider: "gemini" });
    const mockClient = createMockClient("gemini", async () => {
      throw new Error(`Unauthorized with key: ${SECRET_KEY}`);
    });

    const gateway = new LlmGateway({
      config,
      secrets: { geminiApiKey: SECRET_KEY },
      clientFactory: () => mockClient,
      sleepFn: async () => {},
    });

    try {
      await gateway.generate({ messages: [{ role: "user", content: "hi" }] });
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      const errorStr = String(err) + ((err as Error)?.message || "");
      expect(errorStr).not.toContain(SECRET_KEY);
    }
  });

  it("handles timeout with ProviderTimeoutError using AbortSignal", async () => {
    const config = loadConfig({
      provider: "mock",
      fallbackOrder: ["mock"],
    });

    const mockClient = createMockClient("mock", (req) => {
      return new Promise<LlmResult>((_resolve, reject) => {
        req.signal?.addEventListener("abort", () => {
          reject(new ProviderTimeoutError("Request aborted due to timeout"));
        });
      });
    });

    const gateway = new LlmGateway({
      config,
      secrets: {},
      clientFactory: () => mockClient,
      sleepFn: async () => {},
      timeoutMs: 25,
    });

    await expect(
      gateway.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(ProviderTimeoutError);
  });

  it("retries 429 rate limit with exponential backoff and succeeds on second attempt", async () => {
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const config = loadConfig({
      provider: "mock",
      retries: { maxRetries: 2 },
    });

    let attempts = 0;
    const mockClient = createMockClient("mock", async () => {
      attempts++;
      if (attempts === 1) {
        throw new ProviderRateLimitedError("Rate limited");
      }
      return {
        text: "success after retry",
        provider: "mock",
        model: "mock-model",
      };
    });

    const gateway = new LlmGateway({
      config,
      secrets: {},
      clientFactory: () => mockClient,
      sleepFn: sleepMock,
    });

    const result = await gateway.generate({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("success after retry");
    expect(attempts).toBe(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry 401 AuthError (fails fast)", async () => {
    const sleepMock = vi.fn();
    const config = loadConfig({
      provider: "mock",
      retries: { maxRetries: 2 },
    });

    let attempts = 0;
    const mockClient = createMockClient("mock", async () => {
      attempts++;
      throw new AuthError("Invalid authentication credentials");
    });

    const gateway = new LlmGateway({
      config,
      secrets: {},
      clientFactory: () => mockClient,
      sleepFn: sleepMock,
    });

    await expect(
      gateway.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(AuthError);

    expect(attempts).toBe(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("does not retry 400 Bad Request / non-retryable error (fails fast)", async () => {
    const sleepMock = vi.fn();
    const config = loadConfig({
      provider: "mock",
      retries: { maxRetries: 2 },
    });

    let attempts = 0;
    const mockClient = createMockClient("mock", async () => {
      attempts++;
      throw new ProviderError("Bad request: invalid schema", false); // retryable = false
    });

    const gateway = new LlmGateway({
      config,
      secrets: {},
      clientFactory: () => mockClient,
      sleepFn: sleepMock,
    });

    await expect(
      gateway.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(ProviderError);

    expect(attempts).toBe(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("falls back to next provider in fallbackOrder on provider_error/timeout", async () => {
    const config = loadConfig({
      provider: "gemini",
      fallbackOrder: ["gemini", "anthropic"],
      retries: { maxRetries: 0 }, // no retries to test immediate fallback
    });

    const geminiClient = createMockClient("gemini", async () => {
      throw new ProviderError("Gemini internal service outage", true);
    });

    const anthropicClient = createMockClient("anthropic", async () => ({
      text: "hello from anthropic fallback",
      provider: "anthropic",
      model: "claude-3-5-sonnet",
    }));

    const gateway = new LlmGateway({
      config,
      secrets: {
        geminiApiKey: "gemini-key",
        anthropicApiKey: "anthropic-key",
      },
      clientFactory: (id) => (id === "gemini" ? geminiClient : anthropicClient),
      sleepFn: async () => {},
    });

    const result = await gateway.generate({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("hello from anthropic fallback");
    expect(result.provider).toBe("anthropic");
    expect(geminiClient.generate).toHaveBeenCalledTimes(1);
    expect(anthropicClient.generate).toHaveBeenCalledTimes(1);
  });

  it("does not fallback when error is AuthError or ConfigError", async () => {
    const config = loadConfig({
      provider: "gemini",
      fallbackOrder: ["gemini", "anthropic"],
    });

    const geminiClient = createMockClient("gemini", async () => {
      throw new AuthError("Unauthorized: bad key");
    });

    const anthropicClient = createMockClient("anthropic", async () => ({
      text: "should not be called",
      provider: "anthropic",
      model: "claude",
    }));

    const gateway = new LlmGateway({
      config,
      secrets: {
        geminiApiKey: "bad-key",
        anthropicApiKey: "anthropic-key",
      },
      clientFactory: (id) => (id === "gemini" ? geminiClient : anthropicClient),
      sleepFn: async () => {},
    });

    await expect(
      gateway.generate({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(AuthError);

    expect(anthropicClient.generate).not.toHaveBeenCalled();
  });
});
