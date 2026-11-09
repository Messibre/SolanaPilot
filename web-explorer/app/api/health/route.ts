import { NextResponse } from "next/server";

/**
 * Health check endpoint indicating the Node.js server process is running and responding.
 * Returns HTTP 200 with uptime and ISO timestamp.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

