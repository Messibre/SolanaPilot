/**
 * DEPLOY Stage: Manages deployment confirmation and executes devnet deployment.
 * Strictly adheres to Agent.md §3, §6, §8, §9, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { ToolCrashedError } from "../../core/errors";
import { runDeploy } from "../../deploy/deployRunner";
import type { DeployResult, ProcessRunner } from "../../deploy/types";

export interface DeployStageInput {
  workspaceRoot: string;
  confirmDeploy: () => Promise<boolean> | boolean;
  runner?: ProcessRunner;
  onOutput?: (msg: string) => void;
  minBalanceSol?: number;
  maxAirdropRetries?: number;
}

export interface DeployStageResult {
  confirmed: boolean;
  deployResult?: DeployResult;
  error?: string;
}

/**
 * Executes the DEPLOY stage.
 * Waits at AWAIT_DEPLOY_CONFIRM via the injected confirmDeploy callback.
 * If confirmed, runs devnet deployment.
 */
export async function deployStage(input: DeployStageInput): Promise<DeployStageResult> {
  const confirmed = await input.confirmDeploy();
  if (!confirmed) {
    input.onOutput?.("Deployment was not confirmed by user. Skipping deployment.");
    return {
      confirmed: false,
    };
  }

  input.onOutput?.("Deployment confirmed. Executing devnet deployment...");
  const deployResult = await runDeploy({
    workspaceRoot: input.workspaceRoot,
    runner: input.runner,
    onOutput: input.onOutput,
    minBalanceSol: input.minBalanceSol,
    maxAirdropRetries: input.maxAirdropRetries,
  });

  if (!deployResult.ok) {
    const errorMsg = deployResult.error ?? `Deployment failed at step ${deployResult.step}`;
    throw new ToolCrashedError(`Deploy failed: ${errorMsg}`);
  }

  return {
    confirmed: true,
    deployResult,
  };
}
