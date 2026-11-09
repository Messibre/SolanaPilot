import { NextResponse } from "next/server";
import { z } from "zod";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

export interface RateLimiter {
  check(key: string): Promise<{ isAllowed: boolean; retryAfterSeconds?: number }>;
}

/**
 * In-memory sliding window rate limiter.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  async check(key: string): Promise<{ isAllowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    const timestamps = this.requests.get(key) ?? [];
    const valid = timestamps.filter((t) => now - t < this.windowMs);

    if (valid.length >= this.max) {
      const oldest = valid[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.requests.set(key, valid);
      return { isAllowed: false, retryAfterSeconds };
    }

    valid.push(now);
    this.requests.set(key, valid);
    return { isAllowed: true };
  }
}

export interface AuthSessionContext {
  userId: string;
}

export interface ApiHandlerOptions<TInput, TOutput> {
  schema?: z.ZodType<TInput>;
  requireAuth?: boolean;
  getAuthSession?: () => Promise<AuthSessionContext | null>;
  rateLimiter?: RateLimiter;
  maxBodySizeBytes?: number;
  execute: (params: {
    input: TInput;
    session: AuthSessionContext | null;
    request: Request;
  }) => Promise<{ status: number; data?: TOutput; headers?: Record<string, string> }>;
}

const DEFAULT_MAX_BODY_SIZE = 100 * 1024; // 100 KB

/**
 * Creates a standardized API handler with validation, size bounds, auth checks, and rate limiting.
 */
export function createApiHandler<TInput = unknown, TOutput = unknown>(
  options: ApiHandlerOptions<TInput, TOutput>
) {
  const maxBytes = options.maxBodySizeBytes ?? DEFAULT_MAX_BODY_SIZE;

  return async function handleRequest(request: Request): Promise<Response> {
    // 1. Rate Limiting Check
    if (options.rateLimiter) {
      const forwarded = request.headers.get("x-forwarded-for");
      const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

      const { isAllowed, retryAfterSeconds } = await options.rateLimiter.check(clientIp);
      if (!isAllowed) {
        return NextResponse.json(
          { error: "Too many requests. Rate limit exceeded." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfterSeconds ?? 60),
            },
          }
        );
      }
    }

    // 2. Authentication Check
    let session: AuthSessionContext | null = null;
    if (options.requireAuth || options.getAuthSession) {
      if (options.getAuthSession) {
        session = await options.getAuthSession();
      }

      if (options.requireAuth && !session?.userId) {
        return NextResponse.json(
          { error: "Unauthorized. Authentication required." },
          { status: 401 }
        );
      }
    }

    // 3. Payload size check & Body parsing
    let parsedInput = {} as TInput;

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return NextResponse.json(
        { error: `Payload too large. Exceeds maximum allowed size of ${maxBytes} bytes.` },
        { status: 413 }
      );
    }

    const method = request.method.toUpperCase();
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      let rawText = "";
      try {
        rawText = await request.text();
      } catch {
        return NextResponse.json({ error: "Failed to read request body." }, { status: 400 });
      }

      // Check byte size of actual read text
      const byteSize = new TextEncoder().encode(rawText).length;
      if (byteSize > maxBytes) {
        return NextResponse.json(
          { error: `Payload too large. Exceeds maximum allowed size of ${maxBytes} bytes.` },
          { status: 413 }
        );
      }

      if (rawText.trim().length > 0) {
        let jsonBody: unknown;
        try {
          jsonBody = JSON.parse(rawText);
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON body syntax." },
            { status: 400 }
          );
        }

        if (options.schema) {
          const validationResult = options.schema.safeParse(jsonBody);
          if (!validationResult.success) {
            return NextResponse.json(
              {
                error: "Validation failed.",
                details: validationResult.error.issues,
              },
              { status: 400 }
            );
          }
          parsedInput = validationResult.data;
        } else {
          parsedInput = jsonBody as TInput;
        }
      } else if (options.schema) {
        // Schema was provided but empty body received
        const validationResult = options.schema.safeParse({});
        if (!validationResult.success) {
          return NextResponse.json(
            {
              error: "Validation failed.",
              details: validationResult.error.issues,
            },
            { status: 400 }
          );
        }
        parsedInput = validationResult.data;
      }
    }

    // 4. Handler execution
    try {
      const response = await options.execute({
        input: parsedInput,
        session,
        request,
      });

      return NextResponse.json(response.data ?? null, {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      return NextResponse.json(
        { error: "Internal server error." },
        { status: 500 }
      );
    }
  };
}

