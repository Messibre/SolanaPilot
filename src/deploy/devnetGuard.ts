/**
 * Devnet guard: validates that Solana CLI and RPC endpoints target devnet or local testnet.
 * Strictly adheres to Agent.md §3 (Rule 3) and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { ToolRefusedError } from "../core/errors";
import type { ProcessRunner } from "./types";

/**
 * Asserts that an RPC URL targets devnet or localhost.
 * Throws ToolRefusedError if the target contains mainnet or is non-devnet.
 */
export function assertDevnetRpcUrl(rpcUrl: string): void {
  const lower = rpcUrl.toLowerCase().trim();

  // Explicitly deny any mainnet endpoint
  if (lower.includes("mainnet")) {
    throw new ToolRefusedError(
      `Mainnet target is strictly prohibited. Detected RPC URL: ${rpcUrl}`
    );
  }

  // Must target devnet or local network
  const isDevnetOrLocal =
    lower.includes("devnet") ||
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("testnet");

  if (!isDevnetOrLocal) {
    throw new ToolRefusedError(
      `Solana CLI RPC URL must be devnet or localhost/127.0.0.1. Current URL: ${rpcUrl}`
    );
  }
}

/**
 * Runs `solana config get` to inspect the active Solana CLI RPC URL.
 */
export async function verifyDevnetConfiguration(
  runner: ProcessRunner,
  cwd: string
): Promise<string> {
  const res = await runner("solana", ["config", "get"], { cwd });
  if (res.exitCode !== 0) {
    throw new ToolRefusedError(
      `Failed to execute 'solana config get': ${res.stderr || res.stdout}`
    );
  }

  const match = res.stdout.match(/RPC URL:\s*(\S+)/i);
  if (!match) {
    throw new ToolRefusedError(
      "Unable to parse RPC URL from 'solana config get' output"
    );
  }

  const rpcUrl = match[1];
  assertDevnetRpcUrl(rpcUrl);
  return rpcUrl;
}
