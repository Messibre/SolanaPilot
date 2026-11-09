import { describe, it, expect, vi } from "vitest";
import { OllamaClient } from "./ollama";
import {
  ConfigError,
  NetworkBlockedError,
  ParseFailureError,
  ProviderTimeoutError,
} from "../../core/errors";

describe("ai/providers/ollama - OllamaClient", () => {
  it("builds correct chat request payload and parses response and usage", async () => {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedOptions = init;
      return new Response(
        JSON.stringify({
          model: "codellama:latest",
          message: {
            role: "assistant",
            content: "{\"status\": \"ok\"}",
          },
          done: true,
          prompt_eval_count: 24,
          eval_count: 50,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({
      baseUrl: "http://127.0.0.1:11434",
      defaultModel: "codellama:latest",
      fetchFn: mockFetch,
    });

    const result = await client.generate({
      system: "You are a code assistant.",
      messages: [{ role: "user", content: "Generate Anchor template" }],
      jsonMode: true,
      temperature: 0.2,
    });

    expect(capturedUrl).toBe("http://127.0.0.1:11434/api/chat");
    expect(capturedOptions?.method).toBe("POST");

    const body = JSON.parse(String(capturedOptions?.body));
    expect(body.model).toBe("codellama:latest");
    expect(body.stream).toBe(false);
    expect(body.format).toBe("json");
    expect(body.options).toEqual({ temperature: 0.2 });
    expect(body.messages).toEqual([
      { role: "system", content: "You are a code assistant." },
      { role: "user", content: "Generate Anchor template" },
    ]);

    expect(result.text).toBe("{\"status\": \"ok\"}");
    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("codellama:latest");
    expect(result.usage).toEqual({
      promptTokens: 24,
      completionTokens: 50,
      totalTokens: 74,
    });
    expect(result.metadata?.isJson).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  it("warns in result metadata when model output is not valid JSON", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "codellama",
          message: { role: "assistant", content: "Here is the code: ```rust fn test() {}```" },
          done: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({
      fetchFn: mockFetch,
    });

    const result = await client.generate({
      messages: [{ role: "user", content: "Give me JSON" }],
      jsonMode: true,
    });

    expect(result.metadata?.isJson).toBe(false);
    expect(result.warnings).toContain("Model output is not valid JSON despite jsonMode requested");
  });

  it("throws ParseFailureError when response content is empty", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "codellama",
          message: { role: "assistant", content: "   " },
          done: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({ fetchFn: mockFetch });
    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      ParseFailureError
    );
  });

  it("listModels queries /api/tags and returns model list", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("http://127.0.0.1:11434/api/tags");
      return new Response(
        JSON.stringify({
          models: [
            { name: "codellama:latest", model: "codellama:latest" },
            { name: "llama3:latest", model: "llama3:latest" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({ fetchFn: mockFetch });
    const models = await client.listModels();
    expect(models).toEqual(["codellama:latest", "llama3:latest"]);
  });

  it("healthCheck passes when default model exists in installed models", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          models: [{ name: "codellama:latest" }],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({ defaultModel: "codellama:latest", fetchFn: mockFetch });
    await expect(client.healthCheck()).resolves.toBeUndefined();
  });

  it("healthCheck throws ConfigError with instructions when model is not installed", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          models: [{ name: "llama3:latest" }],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({ defaultModel: "codellama:latest", fetchFn: mockFetch });
    try {
      await client.healthCheck();
      expect.fail("Expected healthCheck to throw ConfigError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).userMessage).toContain("ollama pull codellama:latest");
    }
  });

  it("maps connection failure / ECONNREFUSED to user-friendly ConfigError", async () => {
    const mockFetch = vi.fn(async () => {
      const err = new TypeError("fetch failed");
      Object.assign(err, { cause: { code: "ECONNREFUSED" } });
      throw err;
    }) as unknown as typeof fetch;

    const client = new OllamaClient({ fetchFn: mockFetch });
    try {
      await client.healthCheck();
      expect.fail("Expected healthCheck to throw ConfigError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).userMessage).toContain("Ollama service is not running");
    }
  });

  it("maps request timeout to ProviderTimeoutError", async () => {
    const mockFetch = vi.fn(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;

    const client = new OllamaClient({ fetchFn: mockFetch });
    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      ProviderTimeoutError
    );
  });

  it("refuses non-loopback URL when isLocal is false", async () => {
    const client = new OllamaClient({
      baseUrl: "https://ollama.remote-host.com",
      isLocal: false,
    });

    try {
      await client.generate({ messages: [{ role: "user", content: "hi" }] });
      expect.fail("Expected generate to throw ConfigError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).userMessage).toContain("refused non-loopback URL");
    }
  });

  it("allows non-loopback URL when isLocal is explicitly true", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "codellama",
          message: { role: "assistant", content: "Remote local Ollama" },
          done: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new OllamaClient({
      baseUrl: "https://ollama.remote-host.com",
      isLocal: true,
      fetchFn: mockFetch,
    });

    const res = await client.generate({ messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toBe("Remote local Ollama");
  });

  it("blocks SSRF when custom URL targets private IP range", async () => {
    const client = new OllamaClient({
      baseUrl: "https://192.168.1.50",
      isLocal: true,
    });

    await expect(client.generate({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      NetworkBlockedError
    );
  });
});
