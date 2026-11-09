import { NextResponse } from "next/server";
import { defaultNonceStore, InMemoryNonceStore, type NonceStore } from "@/lib/siws";

// Fallback in-memory store if DB is unreachable or during offline dev
const inMemoryStore = new InMemoryNonceStore();

// Simple sliding window rate limiter: max 30 requests per minute per IP
const ipRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRequests.get(ip) ?? [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    ipRequests.set(ip, validTimestamps);
    return true;
  }

  validTimestamps.push(now);
  ipRequests.set(ip, validTimestamps);
  return false;
}

export async function GET(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const store: NonceStore = process.env.DATABASE_URL
      ? defaultNonceStore
      : inMemoryStore;

    const { nonce, expiresAt } = await store.createNonce(5 * 60 * 1000);

    return NextResponse.json(
      {
        nonce,
        expiresAt: expiresAt.toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch {
    // If DB fails, fall back to in-memory store seamlessly
    const { nonce, expiresAt } = await inMemoryStore.createNonce(5 * 60 * 1000);
    return NextResponse.json(
      {
        nonce,
        expiresAt: expiresAt.toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}

