#!/usr/bin/env node

/**
 * SolanaPilot Web Explorer Smoke Test Runner
 *
 * Usage:
 *   node scripts/smoke.mjs [baseUrl] [--require-ready] [--simulate-failure]
 *
 * Default baseUrl: http://localhost:3000
 *
 * Verifies:
 *   1. GET /api/health -> 200 OK, latency recorded
 *   2. GET /api/ready -> returns valid readiness status (200 or 503 with structured checks)
 *   3. POST /api/ready (malformed body) -> 4xx (not 200)
 *   4. POST /api/ready (oversized payload > 100KB) -> 413 Payload Too Large
 *   5. Cold-start and probe latencies recorded
 */

import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
let baseUrl = "http://localhost:3000";
let requireReady = false;
let simulateFailure = false;

for (const arg of args) {
  if (arg === "--require-ready") {
    requireReady = true;
  } else if (arg === "--simulate-failure") {
    simulateFailure = true;
  } else if (!arg.startsWith("--")) {
    baseUrl = arg.replace(/\/+$/, "");
  }
}

console.log(`\n========================================`);
console.log(`SolanaPilot Smoke Test Runner`);
console.log(`Target URL: ${baseUrl}`);
console.log(`Require Ready: ${requireReady}`);
console.log(`Simulate Failure: ${simulateFailure}`);
console.log(`========================================\n`);

let passedChecks = 0;
let totalChecks = 0;
const failures = [];

async function recordCheck(name, fn) {
  totalChecks++;
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    console.log(`[PASS] ${name} (${durationMs}ms)`);
    if (result && typeof result === "string") {
      console.log(`       ${result}`);
    }
    passedChecks++;
    return { ok: true, durationMs };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ${name} (${durationMs}ms)`);
    console.error(`       Error: ${message}`);
    failures.push({ name, message });
    return { ok: false, durationMs };
  }
}

async function run() {
  if (simulateFailure) {
    await recordCheck("Simulated failure verification", async () => {
      throw new Error("Deliberate failure triggered via --simulate-failure flag");
    });
  }

  // 1. Health Check (Process Up)
  let coldStartDurationMs = 0;
  await recordCheck("GET /api/health returns 200 OK", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200 from /api/health, got ${res.status}`);
    }
    const data = await res.json();
    if (data.status !== "ok") {
      throw new Error(`Expected { status: "ok" }, got ${JSON.stringify(data)}`);
    }
    return `Server uptime: ${data.uptime.toFixed(1)}s, timestamp: ${data.timestamp}`;
  });

  // 2. Readiness Check (Dependency Status)
  await recordCheck("GET /api/ready reports dependency readiness", async () => {
    const res = await fetch(`${baseUrl}/api/ready`);
    const validStatuses = requireReady ? [200] : [200, 503];

    if (!validStatuses.includes(res.status)) {
      throw new Error(
        `Expected HTTP ${requireReady ? "200" : "200 or 503"} from /api/ready, got ${res.status}`
      );
    }

    const data = await res.json();
    if (!data.checks || typeof data.checks !== "object") {
      throw new Error(`Invalid response schema from /api/ready: missing checks object`);
    }

    const { env, db, rpc } = data.checks;
    return `Status: ${res.status} (${data.status}) | checks: env=${env}, db=${db}, rpc=${rpc}`;
  });

  // 3. Malformed Request Check (returns 4xx, never 200)
  await recordCheck("POST /api/ready with malformed body returns 4xx", async () => {
    const res = await fetch(`${baseUrl}/api/ready`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"invalidJson": }', // invalid JSON syntax
    });

    if (res.status === 200) {
      throw new Error(`Security violation: Malformed body returned HTTP 200! Expected 4xx`);
    }

    if (res.status < 400 || res.status >= 500) {
      throw new Error(`Expected 4xx client error, got HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => ({}));
    return `HTTP ${res.status} returned as expected (${data.error || "Client Error"})`;
  });

  // 4. Oversized Payload Check (returns 413 Payload Too Large)
  await recordCheck("POST /api/ready with oversized payload (>100KB) returns 413", async () => {
    // Construct payload of 105 KB
    const largePayload = JSON.stringify({
      ping: "x".repeat(105 * 1024),
    });

    const res = await fetch(`${baseUrl}/api/ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(largePayload)),
      },
      body: largePayload,
    });

    if (res.status !== 413) {
      throw new Error(
        `Expected HTTP 413 Payload Too Large for oversized request, got ${res.status}`
      );
    }

    return `HTTP 413 Payload Too Large received as expected`;
  });

  console.log(`\n----------------------------------------`);
  console.log(`Results: ${passedChecks}/${totalChecks} checks passed`);
  console.log(`----------------------------------------\n`);

  if (failures.length > 0) {
    console.error(`Smoke test failed with ${failures.length} errors:`);
    for (const f of failures) {
      console.error(` - ${f.name}: ${f.message}`);
    }
    process.exit(1);
  }

  console.log(`Smoke test suite passed successfully.\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Unhandled exception during smoke run:", err);
  process.exit(1);
});

