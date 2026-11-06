import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  createApiHandler,
  InMemoryRateLimiter,
  type RateLimiter,
} from "./index";

describe("HTTP Security Layer & apiHandler (T-067)", () => {
  const testSchema = z.object({
    name: z.string().min(2),
    count: z.number().int().positive(),
  });

  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new InMemoryRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
    });
  });

  function createMockRequest(options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }) {
    const headers = new Headers(options.headers ?? {});
    if (options.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return new Request("http://localhost:3000/api/test", {
      method: options.method ?? "POST",
      headers,
      body: options.body,
    });
  }

  it("1. unauthenticated → 401: rejects request when authentication is required but missing", async () => {
    const handler = createApiHandler({
      schema: testSchema,
      requireAuth: true,
      getAuthSession: async () => null,
      execute: async () => ({ status: 200, data: { success: true } }),
    });

    const req = createMockRequest({
      body: JSON.stringify({ name: "valid", count: 1 }),
    });

    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized|authentication required/i);
  });

  it("2. malformed body → 400 (never 200): rejects invalid JSON or schema mismatches", async () => {
    const handler = createApiHandler({
      schema: testSchema,
      execute: async () => ({ status: 200, data: { success: true } }),
    });

    // 2a. Invalid JSON syntax
    const malformedJsonReq = createMockRequest({
      body: "{ not valid json: 123",
    });
    const malformedRes = await handler(malformedJsonReq);
    expect(malformedRes.status).toBe(400);
    const malformedBody = await malformedRes.json();
    expect(malformedBody.error).toMatch(/invalid.*json/i);

    // 2b. Schema validation failure (bad types / missing fields)
    const badSchemaReq = createMockRequest({
      body: JSON.stringify({ name: "a", count: -5 }),
    });
    const schemaRes = await handler(badSchemaReq);
    expect(schemaRes.status).toBe(400);
    const schemaBody = await schemaRes.json();
    expect(schemaBody.error).toMatch(/validation failed/i);
  });

  it("3. oversized body → 413: rejects request exceeding max body size", async () => {
    const handler = createApiHandler({
      schema: z.object({ payload: z.string() }),
      maxBodySizeBytes: 1024, // 1 KB max
      execute: async () => ({ status: 200, data: { success: true } }),
    });

    const largeString = "x".repeat(2048); // 2 KB
    const oversizedReq = createMockRequest({
      body: JSON.stringify({ payload: largeString }),
    });

    const res = await handler(oversizedReq);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/payload too large|oversized/i);
  });

  it("4. rate limit → 429: rejects requests exceeding rate limit threshold", async () => {
    const handler = createApiHandler({
      schema: testSchema,
      rateLimiter,
      execute: async () => ({ status: 200, data: { success: true } }),
    });

    const validPayload = JSON.stringify({ name: "valid", count: 1 });
    const ip = "192.168.1.100";

    // First 3 requests succeed (limit = 3)
    for (let i = 0; i < 3; i++) {
      const req = createMockRequest({
        body: validPayload,
        headers: { "x-forwarded-for": ip },
      });
      const res = await handler(req);
      expect(res.status).toBe(200);
    }

    // 4th request exceeds limit → 429
    const limitedReq = createMockRequest({
      body: validPayload,
      headers: { "x-forwarded-for": ip },
    });
    const limitedRes = await handler(limitedReq);
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.headers.get("retry-after")).toBeDefined();
    const body = await limitedRes.json();
    expect(body.error).toMatch(/rate limit|too many requests/i);
  });
});

