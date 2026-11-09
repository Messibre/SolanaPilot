import { describe, it, expect, vi } from "vitest";
import { OpenAiCompatibleClient } from "./openaiCompatible";
import {
  AuthError,
  ProviderRateLimitedError,
  ProviderError,
  NetworkBlockedError,
  ParseFailureError,
} from "../../core/errors";

function createMockResponse(
  status: number,
  body: unknown,
  statusText = "OK"
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ai/providers/openaiCompatible - OpenAiCompatibleClient", () => {
  it("builds correct URL and headers for 'openai' preset", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return createMockResponse(200, {
        choices: [{ message: { content: "OpenAI answer" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: "sk-test-key",
      fetchFn: mockFetch,
    });

    const result = await client.generate({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.text).toBe("OpenAI answer");
    expect(result.provider).toBe("openaiCompatible");
    expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
    expect(capturedHeaders["Authorization"]).toBe("Bearer sk-test-key");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("builds correct URL and headers for 'openrouter' preset", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return createMockResponse(200, {
        choices: [{ message: { content: "OpenRouter answer" } }],
      });
    });

    const client = new OpenAiCompatibleClient({
      preset: "openrouter",
      apiKey: "sk-or-test-key",
      fetchFn: mockFetch,
    });

    await client.generate({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(capturedUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(capturedHeaders["Authorization"]).toBe("Bearer sk-or-test-key");
    expect(capturedHeaders["HTTP-Referer"]).toBeDefined();
    expect(capturedHeaders["X-Title"]).toBe("SolanaPilot");
  });

  it("builds correct URL for 'custom' preset and respects isLocal flag", async () => {
    let capturedUrl = "";
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return createMockResponse(200, {
        choices: [{ message: { content: "Custom answer" } }],
      });
    });

    const localClient = new OpenAiCompatibleClient({
      preset: "custom",
      baseUrl: "http://127.0.0.1:8000/v1",
      isLocal: true,
      fetchFn: mockFetch,
    });

    const result = await localClient.generate({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.text).toBe("Custom answer");
    expect(capturedUrl).toBe("http://127.0.0.1:8000/v1/chat/completions");
  });

  it("refuses private custom URL when isLocal is false (SSRF block)", async () => {
    const client = new OpenAiCompatibleClient({
      preset: "custom",
      baseUrl: "https://10.0.0.1:8000/v1",
      isLocal: false,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(NetworkBlockedError);
  });

  it("refuses non-https custom URL when isLocal is false", async () => {
    const client = new OpenAiCompatibleClient({
      preset: "custom",
      baseUrl: "http://example.com/v1",
      isLocal: false,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(NetworkBlockedError);
  });

  it("maps 401/403 to AuthError", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(401, { error: { message: "Invalid API key" } }, "Unauthorized")
    );

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: "bad-key",
      fetchFn: mockFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(AuthError);
  });

  it("maps 429 to ProviderRateLimitedError", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(429, { error: { message: "Rate limit reached" } }, "Too Many Requests")
    );

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: "sk-key",
      fetchFn: mockFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ProviderRateLimitedError);
  });

  it("maps 500/503 to retryable ProviderError", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(503, { error: { message: "Service Unavailable" } }, "Service Unavailable")
    );

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: "sk-key",
      fetchFn: mockFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ProviderError);
  });

  it("maps 400 Bad Request to non-retryable ProviderError", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(400, { error: { message: "Invalid prompt syntax" } }, "Bad Request")
    );

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: "sk-key",
      fetchFn: mockFetch,
    });

    try {
      await client.generate({ messages: [{ role: "user", content: "test" }] });
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(false);
    }
  });

  it("maps empty choices to ParseFailureError", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(200, { choices: [] })
    );

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: "sk-key",
      fetchFn: mockFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ParseFailureError);
  });

  it("redacts API keys and never includes them in errors or URLs", async () => {
    const SECRET_KEY = "sk-secret-token-123456789";
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(401, { error: { message: `Bad key: ${SECRET_KEY}` } })
    );

    const client = new OpenAiCompatibleClient({
      preset: "openai",
      apiKey: SECRET_KEY,
      fetchFn: mockFetch,
    });

    try {
      await client.generate({ messages: [{ role: "user", content: "test" }] });
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      const msg = String(err) + ((err as Error)?.message || "");
      expect(msg).not.toContain(SECRET_KEY);
    }
  });
});
