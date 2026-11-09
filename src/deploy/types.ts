/**
 * Types and interfaces for the Solana devnet deployment runner.
 * Strictly adheres to Agent.md §6 and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

export type DeployStep =
  | "config_check"
  | "balance_check"
  | "airdrop"
  | "build"
  | "deploy";

export interface DeployResult {
  ok: boolean;
  step: DeployStep;
  programId?: string;
  signature?: string;
  error?: string;
  output?: string[];
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type ProcessRunner = (
  file: string,
  args: string[],
  options: { cwd: string; timeout?: number }
) => Promise<ProcessResult>;

export interface DeployOptions {
  workspaceRoot: string;
  programName?: string;
  runner?: ProcessRunner;
  minBalanceSol?: number;
  maxAirdropRetries?: number;
  onOutput?: (line: string) => void;
  signal?: AbortSignal;
}
