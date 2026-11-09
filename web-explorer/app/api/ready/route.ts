import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createApiHandler } from "@/lib/http";

/**
 * Validates required environment variables for operation.
 */
function checkEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) {
    missing.push("DATABASE_URL");
  }
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    missing.push("AUTH_SECRET");
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

/**
 * Tests database reachability with a fast query and bounded timeout.
 */
async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  try {
    const queryPromise = db.$queryRawUnsafe("SELECT 1");
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database check timed out after 2500ms")), 2500);
    });
    await Promise.race([queryPromise, timeoutPromise]);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database connection failed";
    return { ok: false, error: message };
  }
}

/**
 * Tests Solana RPC reachability with getHealth and bounded timeout.
 */
async function checkRpc(): Promise<{ ok: boolean; error?: string }> {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "ready-check",
        method: "getHealth",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `RPC HTTP ${res.status}` };
    }

    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (json.error) {
      return { ok: false, error: json.error.message ?? "RPC returned error" };
    }

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "RPC check failed";
    return { ok: false, error: message };
  }
}

/**
 * Readiness check verifying environment variables, database reachability, and Solana RPC.
 * Returns 200 when ready, 503 Service Unavailable when any dependency is degraded.
 */
export async function GET() {
  const envCheck = checkEnv();
  const [dbCheck, rpcCheck] = await Promise.all([checkDb(), checkRpc()]);

  const isReady = envCheck.ok && dbCheck.ok && rpcCheck.ok;
  const status = isReady ? "ready" : "not_ready";
  const statusCode = isReady ? 200 : 503;

  return NextResponse.json(
    {
      status,
      checks: {
        env: envCheck.ok,
        db: dbCheck.ok,
        rpc: rpcCheck.ok,
      },
      details: {
        ...(envCheck.missing.length > 0 ? { missingEnv: envCheck.missing } : {}),
        ...(dbCheck.error ? { dbError: dbCheck.error } : {}),
        ...(rpcCheck.error ? { rpcError: rpcCheck.error } : {}),
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

const pingSchema = z.object({
  ping: z.string().optional(),
});

/**
 * Standardized API handler endpoint for smoke testing payload limits and input validation.
 */
export const POST = createApiHandler({
  schema: pingSchema,
  maxBodySizeBytes: 100 * 1024, // 100 KB max payload
  execute: async ({ input }) => {
    return {
      status: 200,
      data: {
        pong: true,
        received: input,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

