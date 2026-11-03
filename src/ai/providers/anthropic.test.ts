import { describe, it, expect, vi } from "vitest";
import { AnthropicClient } from "./anthropic";
import {
  AuthError,
  DomainRefusalError,
  NetworkBlockedError,
  ParseFailureError,
  ProviderError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
} from "../../core/errors";

describe("ai/providers/anthropic - AnthropicClient", () => {
  const secretKey = "sk-ant-api03-test-secret-key-12345";

  it("builds correct Anthropic Messages API request with headers and payload", async () => {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedOptions = init;
      return new Response(
        JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Hello from Claude" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 15, output_tokens: 8 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({
      apiKey: secretKey,
      baseUrl: "https://api.anthropic.com",
      fetchFn: mockFetch,
      defaultModel: "claude-3-5-sonnet-20241022",
    });

    const result = await client.generate({
      system: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.7,
      maxTokens: 1024,
    });

    expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
    expect(capturedOptions?.method).toBe("POST");

    const headers = capturedOptions?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(secretKey);
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(capturedOptions?.body));
    expect(body.model).toBe("claude-3-5-sonnet-20241022");
    expect(body.system).toBe("You are a helpful assistant.");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.max_tokens).toBe(1024);
    expect(body.temperature).toBe(0.7);

    expect(result.text).toBe("Hello from Claude");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-3-5-sonnet-20241022");
    expect(result.usage).toEqual({
      promptTokens: 15,
      completionTokens: 8,
      totalTokens: 23,
    });
  });

  it("extracts system messages embedded in messages array into top-level system parameter", async () => {
    let capturedOptions: RequestInit | undefined;

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedOptions = init;
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "OK" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({
      apiKey: secretKey,
      fetchFn: mockFetch,
    });

    await client.generate({
      messages: [
        { role: "system", content: "System rule 1" },
        { role: "user", content: "User prompt" },
      ],
    });

    const body = JSON.parse(String(capturedOptions?.body));
    expect(body.system).toBe("System rule 1");
    expect(body.messages).toEqual([{ role: "user", content: "User prompt" }]);
  });

  it("maps 401 and 403 to AuthError", async () => {
    const mockFetch401 = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "authentication_error", message: "invalid x-api-key" } }),
        { status: 401 }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch401 });
    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      AuthError
    );

    const mockFetch403 = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "permission_error", message: "forbidden" } }),
        { status: 403 }
      );
    }) as unknown as typeof fetch;

    const client403 = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch403 });
    await expect(client403.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      AuthError
    );
  });

  it("maps 429 to ProviderRateLimitedError", async () => {
    const mockFetch429 = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "rate_limit_error", message: "Rate limit reached" } }),
        { status: 429 }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch429 });
    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      ProviderRateLimitedError
    );
  });

  it("maps 500, 503, and 529 to retryable ProviderError", async () => {
    for (const status of [500, 503, 529]) {
      const mockFetch = vi.fn(async () => {
        return new Response("Overloaded", { status });
      }) as unknown as typeof fetch;

      const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch });
      try {
        await client.generate({ messages: [{ role: "user", content: "hi" }] });
        expect.fail(`Expected status ${status} to throw`);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ProviderError);
        expect((err as ProviderError).retryable).toBe(true);
      }
    }
  });

  it("maps 400 to non-retryable ProviderError", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "invalid_request_error", message: "max_tokens too large" } }),
        { status: 400 }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch });
    try {
      await client.generate({ messages: [{ role: "user", content: "hi" }] });
      expect.fail("Expected status 400 to throw");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).retryable).toBe(false);
    }
  });

  it("maps AbortError / timeout to ProviderTimeoutError", async () => {
    const mockFetch = vi.fn(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch });
    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      ProviderTimeoutError
    );
  });

  it("maps empty content to ParseFailureError", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ content: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch });
    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      ParseFailureError
    );
  });

  it("maps stop_reason refusal to DomainRefusalError", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "I cannot fulfill this request" }],
          stop_reason: "refusal",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch });
    await expect(client.generate({ messages: [{ role: "user", content: "harmful prompt" }] })).rejects.toThrow(
      DomainRefusalError
    );
  });

  it("blocks SSRF when custom baseUrl targets a private IP and isLocal is false", async () => {
    const client = new AnthropicClient({
      apiKey: secretKey,
      baseUrl: "https://192.168.1.100",
      isLocal: false,
    });

    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      NetworkBlockedError
    );
  });

  it("allows loopback baseUrl when isLocal is explicitly true", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Local proxy response" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({
      apiKey: secretKey,
      baseUrl: "http://127.0.0.1:8080",
      isLocal: true,
      fetchFn: mockFetch,
    });

    const res = await client.generate({ messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toBe("Local proxy response");
  });

  it("never exposes or includes raw secret keys in error messages", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        `Error with key ${secretKey}: invalid authorization header`,
        { status: 401 }
      );
    }) as unknown as typeof fetch;

    const client = new AnthropicClient({ apiKey: secretKey, fetchFn: mockFetch });
    try {
      await client.generate({ messages: [{ role: "user", content: "hi" }] });
      expect.fail("Expected 401 to throw");
    } catch (err: unknown) {
      const msg = String((err as Error).message);
      expect(msg).not.toContain(secretKey);
      expect(msg).toContain("[redacted:anthropic]");
    }
  });
});
