/**
 * Pipeline Runner: End-to-end execution of the SolanaPilot agent workflow.
 * Manages stage progression through the PipelineMachine.
 * Strictly adheres to Agent.md §6, §8, §9, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import * as fs from "node:fs";
import type { LlmClient } from "../../ai/types";
import { ToolCrashedError, SolanaPilotError } from "../../core/errors";
import type { ProcessRunner, DeployResult } from "../../deploy/types";
import { runDeploy } from "../../deploy/deployRunner";
import { defaultProcessRunner } from "../tools/runCheck";
import { RegistryClient } from "../../registry/client";
import type { RegistryClientInterface, RegisterProgramResult } from "../../registry/types";
import { PipelineMachine, type PipelineStage } from "../pipeline";
import { planStage, type PlanOutput } from "./plan";
import { generateStage, writeStage, type GeneratedFile } from "./generate";
import { runBuildAndFixLoop } from "./fix";
import { testStage } from "./test";
import { reviewStage } from "./review";
import { registerStage } from "./register";

export interface PipelineRunnerInput {
  workspaceRoot: string;
  client: LlmClient;
  userPrompt: string;
  programName?: string;
  runner?: ProcessRunner;
  confirmDeploy: () => Promise<boolean> | boolean;
  registryClient?: RegistryClientInterface;
  onTransition?: (stage: PipelineStage) => void;
  onOutput?: (msg: string) => void;
  maxFixes?: number;
  signal?: AbortSignal;
}

export interface PipelineRunnerResult {
  ok: boolean;
  finalStage: PipelineStage;
  machine: PipelineMachine;
  plan?: PlanOutput;
  files?: GeneratedFile[];
  deployResult?: DeployResult;
  registerResult?: RegisterProgramResult;
  error?: string;
}

/**
 * Runs the full agent generation, build, test, review, deploy, and register pipeline.
 */
export async function runPipeline(input: PipelineRunnerInput): Promise<PipelineRunnerResult> {
  const machine = new PipelineMachine({ maxFixes: input.maxFixes ?? 3 });
  input.onTransition?.(machine.getStage());

  let plan: PlanOutput | undefined;
  let generatedFiles: GeneratedFile[] | undefined;
  let deployResult: DeployResult | undefined;
  let registerResult: RegisterProgramResult | undefined;

  const fail = (errMsg: string): PipelineRunnerResult => {
    try {
      if (machine.canTransitionTo("FAILED")) {
        machine.transitionTo("FAILED", errMsg);
        input.onTransition?.("FAILED");
      }
    } catch {
      // already in terminal state
    }
    input.onOutput?.(`Pipeline FAILED: ${errMsg}`);
    return {
      ok: false,
      finalStage: machine.getStage(),
      machine,
      plan,
      files: generatedFiles,
      deployResult,
      registerResult,
      error: errMsg,
    };
  };

  try {
    // 1. PLAN stage
    input.onOutput?.(`[PLAN] Generating plan for: "${input.userPrompt}"`);
    plan = await planStage({
      client: input.client,
      userPrompt: input.userPrompt,
      programName: input.programName,
      signal: input.signal,
    });

    machine.transitionTo("GENERATE", "Plan created successfully");
    input.onTransition?.(machine.getStage());

    // 2. GENERATE stage
    input.onOutput?.(`[GENERATE] Generating program files for "${plan.programName}"`);
    const genResult = await generateStage({
      client: input.client,
      workspaceRoot: input.workspaceRoot,
      plan,
      signal: input.signal,
    });
    generatedFiles = genResult.files;

    machine.transitionTo("VALIDATE", "Code generated");
    input.onTransition?.(machine.getStage());

    // 3. VALIDATE stage
    if (!generatedFiles || generatedFiles.length === 0) {
      throw new ToolCrashedError("GENERATE produced no files");
    }

    machine.transitionTo("WRITE", "Files validated");
    input.onTransition?.(machine.getStage());

    // 4. WRITE stage
    input.onOutput?.(`[WRITE] Writing ${generatedFiles.length} files to ${input.workspaceRoot}`);
    await writeStage({
      workspaceRoot: input.workspaceRoot,
      files: generatedFiles,
      allowOverwrite: true,
    });

    machine.transitionTo("BUILD", "Files written to workspace");
    input.onTransition?.(machine.getStage());

    // 5. BUILD & FIX stage
    input.onOutput?.(`[BUILD] Running cargo/anchor build and fix loop`);
    const runner = input.runner ?? defaultProcessRunner.execFile;
    const runCheckFn = async (cwd: string) => {
      const res = await runner("cargo", ["check"], { cwd });
      return {
        exitCode: res.exitCode ?? 0,
        stdout: res.stdout,
        stderr: res.stderr,
      };
    };

    const buildReceipt = await runBuildAndFixLoop({
      client: input.client,
      workspaceRoot: input.workspaceRoot,
      programName: plan.programName,
      maxRounds: input.maxFixes ?? 3,
      runCheck: runCheckFn,
      signal: input.signal,
    });

    // Mirror rounds into state machine transitions
    for (let r = 0; r < buildReceipt.rounds; r++) {
      if (machine.canTransitionTo("FIX")) {
        machine.transitionTo("FIX", `Build fix round ${r + 1}`);
        input.onTransition?.(machine.getStage());
        if (machine.canTransitionTo("BUILD")) {
          machine.transitionTo("BUILD", `Rebuild after round ${r + 1}`);
          input.onTransition?.(machine.getStage());
        }
      }
    }

    if (!buildReceipt.success) {
      throw new ToolCrashedError(
        `Build failed and fix cycles exceeded: ${buildReceipt.reason}`
      );
    }

    machine.transitionTo("TEST", "Build passed");
    input.onTransition?.(machine.getStage());

    // Extract Rust code for tests & review
    const mainRustFile = generatedFiles.find(
      (f) => f.path.endsWith("lib.rs") || f.path.endsWith(".rs")
    );
    const mainRustCode =
      mainRustFile?.content ??
      (fs.existsSync(`${input.workspaceRoot}/programs/${plan.programName}/src/lib.rs`)
        ? fs.readFileSync(`${input.workspaceRoot}/programs/${plan.programName}/src/lib.rs`, "utf8")
        : "");

    // 6. TEST stage
    input.onOutput?.(`[TEST] Generating Anchor TS tests`);
    await testStage({
      client: input.client,
      workspaceRoot: input.workspaceRoot,
      programName: plan.programName,
      programCode: mainRustCode,
      instructions: plan.instructions.map((i) => (typeof i === "string" ? i : i.name)),
      signal: input.signal,
    });

    machine.transitionTo("REVIEW", "Tests generated");
    input.onTransition?.(machine.getStage());

    // 7. REVIEW stage
    input.onOutput?.(`[REVIEW] Running security checklist review`);
    const reviewRes = await reviewStage({
      client: input.client,
      programCode: mainRustCode,
      programName: plan.programName,
      signal: input.signal,
    });

    if (reviewRes.blocksDeploy) {
      input.onOutput?.(
        `[REVIEW WARNING] Security review found high-severity issues: ${reviewRes.findings.length} findings`
      );
    }

    machine.transitionTo("AWAIT_DEPLOY_CONFIRM", "Review completed");
    input.onTransition?.(machine.getStage());

    // 8. AWAIT_DEPLOY_CONFIRM stage
    input.onOutput?.(`[AWAIT_DEPLOY_CONFIRM] Requesting user confirmation for devnet deploy...`);
    const confirmed = await input.confirmDeploy();
    if (!confirmed) {
      input.onOutput?.(`Deployment declined by user. Concluding pipeline at generation.`);
      machine.transitionTo("DONE", "Deploy declined; pipeline completed");
      input.onTransition?.(machine.getStage());
      return {
        ok: true,
        finalStage: machine.getStage(),
        machine,
        plan,
        files: generatedFiles,
      };
    }

    machine.transitionTo("DEPLOY", "Deploy confirmed by user");
    input.onTransition?.(machine.getStage());

    // 9. DEPLOY stage
    input.onOutput?.(`[DEPLOY] Executing devnet deployment...`);
    deployResult = await runDeploy({
      workspaceRoot: input.workspaceRoot,
      runner: input.runner,
      onOutput: input.onOutput,
    });

    if (!deployResult.ok) {
      throw new ToolCrashedError(`Deploy failed at step ${deployResult.step}: ${deployResult.error}`);
    }

    machine.transitionTo("REGISTER", "Deployment succeeded");
    input.onTransition?.(machine.getStage());

    // 10. REGISTER stage
    const regClient = input.registryClient ?? new RegistryClient();
    const deployedProgramId = deployResult.programId ?? "11111111111111111111111111111111";
    input.onOutput?.(`[REGISTER] Registering deployed program ${deployedProgramId} on-chain`);

    registerResult = await registerStage({
      client: regClient,
      programId: deployedProgramId,
      programName: plan.programName,
      description: plan.description,
      instructionCount: plan.instructions.length,
      onOutput: input.onOutput,
    });

    machine.transitionTo("DONE", "Program registered successfully");
    input.onTransition?.(machine.getStage());

    return {
      ok: true,
      finalStage: machine.getStage(),
      machine,
      plan,
      files: generatedFiles,
      deployResult,
      registerResult,
    };
  } catch (err: unknown) {
    const message = err instanceof SolanaPilotError ? err.userMessage : (err as Error).message;
    return fail(message);
  }
}
