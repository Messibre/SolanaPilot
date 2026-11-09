/**
 * Deploy runner: executes Anchor devnet deployments with safety guards, balance checks, and airdrops.
 * Strictly adheres to Agent.md §3, §6, §8, §9, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { defaultProcessRunner } from "../agent/tools/runCheck";
import { redactString } from "../security/redact";
import { verifyDevnetConfiguration } from "./devnetGuard";
import type { DeployOptions, DeployResult, ProcessRunner } from "./types";

export const DEFAULT_MIN_BALANCE_SOL = 2.0;
export const DEFAULT_MAX_AIRDROP_RETRIES = 2;

/**
 * Runs the full deployment sequence (devnet check, balance check, airdrop, build, deploy).
 */
export async function runDeploy(options: DeployOptions): Promise<DeployResult> {
  const runner: ProcessRunner = options.runner ?? defaultProcessRunner.execFile;
  const minBalance = options.minBalanceSol ?? DEFAULT_MIN_BALANCE_SOL;
  const maxAirdropRetries = options.maxAirdropRetries ?? DEFAULT_MAX_AIRDROP_RETRIES;
  const outputLines: string[] = [];

  const log = (msg: string) => {
    const redacted = redactString(msg);
    outputLines.push(redacted);
    options.onOutput?.(redacted);
  };

  log(`Starting deployment check for workspace: ${options.workspaceRoot}`);

  // 1. Step: config_check
  let rpcUrl = "";
  try {
    rpcUrl = await verifyDevnetConfiguration(runner, options.workspaceRoot);
    log(`Devnet configuration verified. RPC URL: ${rpcUrl}`);
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    log(`Config check failed: ${errorMsg}`);
    return {
      ok: false,
      step: "config_check",
      error: errorMsg,
      output: outputLines,
    };
  }

  // 2. Step: balance_check
  let balanceSol = 0;
  try {
    const balRes = await runner("solana", ["balance"], { cwd: options.workspaceRoot });
    if (balRes.exitCode !== 0) {
      const errorMsg = balRes.stderr || balRes.stdout;
      log(`Failed to fetch balance: ${errorMsg}`);
      return {
        ok: false,
        step: "balance_check",
        error: errorMsg,
        output: outputLines,
      };
    }
    const match = balRes.stdout.match(/([\d.]+)\s*SOL/i);
    balanceSol = match ? parseFloat(match[1]) : 0;
    log(`Current balance: ${balanceSol} SOL (minimum required: ${minBalance} SOL)`);
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    return {
      ok: false,
      step: "balance_check",
      error: errorMsg,
      output: outputLines,
    };
  }

  // 3. Step: airdrop if needed
  if (balanceSol < minBalance) {
    log(`Balance ${balanceSol} SOL is below ${minBalance} SOL. Requesting airdrop...`);
    let airdropSuccess = false;
    let lastAirdropError = "";

    for (let attempt = 1; attempt <= maxAirdropRetries + 1; attempt++) {
      log(`Airdrop attempt ${attempt} of ${maxAirdropRetries + 1}...`);
      const airdropRes = await runner("solana", ["airdrop", "2"], { cwd: options.workspaceRoot });
      if (airdropRes.exitCode === 0) {
        airdropSuccess = true;
        log("Airdrop request succeeded.");
        break;
      }
      lastAirdropError = (airdropRes.stderr || airdropRes.stdout).trim();
      log(`Airdrop attempt ${attempt} failed: ${lastAirdropError}`);
    }

    if (!airdropSuccess) {
      return {
        ok: false,
        step: "airdrop",
        error: `Airdrop failed after ${maxAirdropRetries + 1} attempts: ${lastAirdropError}`,
        output: outputLines,
      };
    }
  }

  // 4. Step: build
  log("Running 'anchor build'...");
  const buildRes = await runner("anchor", ["build"], { cwd: options.workspaceRoot });
  if (buildRes.exitCode !== 0) {
    const errorMsg = (buildRes.stderr || buildRes.stdout).trim();
    log(`Anchor build failed: ${errorMsg}`);
    return {
      ok: false,
      step: "build",
      error: errorMsg,
      output: outputLines,
    };
  }
  log("Anchor build completed successfully.");

  // 5. Step: deploy
  log("Running 'anchor deploy'...");
  const deployRes = await runner("anchor", ["deploy"], { cwd: options.workspaceRoot });
  if (deployRes.exitCode !== 0) {
    const errorMsg = (deployRes.stderr || deployRes.stdout).trim();
    log(`Anchor deploy failed: ${errorMsg}`);
    return {
      ok: false,
      step: "deploy",
      error: errorMsg,
      output: outputLines,
    };
  }

  const programIdMatch = deployRes.stdout.match(/Program Id:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
  const signatureMatch = deployRes.stdout.match(/Signature:\s*([1-9A-HJ-NP-Za-km-z]{64,88})/);
  const programId = programIdMatch ? programIdMatch[1] : undefined;
  const signature = signatureMatch ? signatureMatch[1] : undefined;

  log(`Anchor deploy succeeded! Program Id: ${programId ?? "unknown"}`);

  return {
    ok: true,
    step: "deploy",
    programId,
    signature,
    output: outputLines,
  };
}
