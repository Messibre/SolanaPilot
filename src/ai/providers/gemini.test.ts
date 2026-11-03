import { describe, it, expect, vi } from "vitest";
import { GeminiClient } from "./gemini";
import {
  AuthError,
  ProviderRateLimitedError,
  ProviderError,
  ProviderTimeoutError,
  ParseFailureError,
  DomainRefusalError,
} from "../../core/errors";

function createFakeFetch(
  status: number,
  body: unknown,
  statusText = "OK"
): typeof fetch {
  return vi.fn().mockImplementation(async () => {
    return new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("ai/providers/gemini - GeminiClient", () => {
  it("generates content successfully and returns normalized LlmResult", async () => {
    const fakeFetch = createFakeFetch(200, {
      candidates: [
        {
          content: {
            parts: [{ text: "Solana escrow program generated." }],
            role: "model",
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 25,
        totalTokenCount: 40,
      },
    });

    const client = new GeminiClient({
      apiKey: "test-api-key",
      fetchFn: fakeFetch,
    });

    const result = await client.generate({
      messages: [{ role: "user", content: "build escrow" }],
    });

    expect(result.text).toBe("Solana escrow program generated.");
    expect(result.provider).toBe("gemini");
    expect(result.usage?.totalTokens).toBe(40);
  });

  it("maps 401 Unauthorized to AuthError", async () => {
    const fakeFetch = createFakeFetch(401, {
      error: { code: 401, message: "API_KEY_INVALID: Key is invalid", status: "UNAUTHENTICATED" },
    });

    const client = new GeminiClient({
      apiKey: "bad-key",
      fetchFn: fakeFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(AuthError);
  });

  it("maps 429 Rate Limited to ProviderRateLimitedError", async () => {
    const fakeFetch = createFakeFetch(429, {
      error: { code: 429, message: "RESOURCE_EXHAUSTED: Quota exceeded", status: "RESOURCE_EXHAUSTED" },
    });

    const client = new GeminiClient({
      apiKey: "test-key",
      fetchFn: fakeFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ProviderRateLimitedError);
  });

  it("maps 503 Service Unavailable to ProviderError", async () => {
    const fakeFetch = createFakeFetch(503, {
      error: { code: 503, message: "UNAVAILABLE: Backend overloaded", status: "UNAVAILABLE" },
    });

    const client = new GeminiClient({
      apiKey: "test-key",
      fetchFn: fakeFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ProviderError);
  });

  it("maps timeout to ProviderTimeoutError", async () => {
    const fakeFetch = vi.fn().mockImplementation(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    const client = new GeminiClient({
      apiKey: "test-key",
      fetchFn: fakeFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ProviderTimeoutError);
  });

  it("maps empty candidate or response to ParseFailureError", async () => {
    const fakeFetch = createFakeFetch(200, {
      candidates: [],
    });

    const client = new GeminiClient({
      apiKey: "test-key",
      fetchFn: fakeFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(ParseFailureError);
  });

  it("maps SAFETY finishReason to DomainRefusalError", async () => {
    const fakeFetch = createFakeFetch(200, {
      candidates: [
        {
          finishReason: "SAFETY",
          content: { parts: [], role: "model" },
        },
      ],
    });

    const client = new GeminiClient({
      apiKey: "test-key",
      fetchFn: fakeFetch,
    });

    await expect(
      client.generate({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(DomainRefusalError);
  });
});
