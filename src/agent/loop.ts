/**
 * Agent loop orchestrator: Perceive -> Decide -> Act -> Observe.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import { BudgetExhaustedError } from "../core/errors";
import { generateStructured, type StructuredOutputBase } from "../ai/structured";
import type { LlmClient, LlmMessage } from "../ai/types";
import { BudgetTracker, type BudgetLimits } from "./budget";
import type { LoopReceipt, StepRecord, TerminalState } from "./receipts";
import type { ToolRegistry } from "./tools/registry";
import type { ToolContext } from "./tools/types";
import { wrapToolResult } from "./tools/wrap";

export interface AgentLoopState {
  stepCount: number;
  history: StepRecord[];
  observations: string[];
  task: string;
}

export interface AgentLoopOptions {
  task: string;
  workspaceRoot: string;
  client: LlmClient;
  toolRegistry: ToolRegistry;
  budget?: BudgetTracker;
  budgetOptions?: BudgetLimits;
  signal?: AbortSignal;
  successCondition?: (state: AgentLoopState) => boolean | Promise<boolean>;
  maxConsecutiveToolCrashes?: number;
  systemPrompt?: string;
  toolContext?: Partial<ToolContext>;
}

export const AgentDecisionSchema = z
  .object({
    thought: z.string().describe("Internal reasoning before taking action"),
    action: z.enum(["call_tool", "finish", "refuse"]).describe("Action to take"),
    toolName: z.string().optional().describe("Name of the tool to execute when action is call_tool"),
    toolArgs: z.record(z.unknown()).default({}).describe("Arguments object for the tool"),
    finishSummary: z.string().optional().describe("Summary of completion when action is finish"),
    refusalReason: z.string().optional().describe("Explanation when action is refuse"),
    needsHumanReview: z.boolean().default(false),
    uncertainty: z.string().optional(),
  })
  .strict();

export interface AgentDecision extends StructuredOutputBase {
  thought: string;
  action: "call_tool" | "finish" | "refuse";
  toolName?: string;
  toolArgs: Record<string, unknown>;
  finishSummary?: string;
  refusalReason?: string;
  needsHumanReview: boolean;
  uncertainty?: string;
}

function normalizeCallSignature(toolName: string, args: Record<string, unknown>): string {
  const sortedKeys = Object.keys(args).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    sortedObj[k] = args[k];
  }
  return `${toolName}:${JSON.stringify(sortedObj)}`;
}

/**
 * Runs the deterministic Perceive -> Decide -> Act -> Observe loop.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<LoopReceipt> {
  const startTime = Date.now();
  let stepCount = 0;
  const history: StepRecord[] = [];
  const toolNamesUsed: string[] = [];
  let consecutiveCrashes = 0;
  const maxConsecutiveCrashes = options.maxConsecutiveToolCrashes ?? 3;
  let successConditionMet = false;

  const budget =
    options.budget ??
    new BudgetTracker({
      maxSteps: options.budgetOptions?.maxSteps ?? 20,
      maxTokens: options.budgetOptions?.maxTokens ?? 100_000,
      maxWallClockSec: options.budgetOptions?.maxWallClockSec ?? 300,
    });

  const toolContext: ToolContext = {
    workspaceRoot: options.workspaceRoot,
    ...options.toolContext,
  };

  const makeReceipt = (state: TerminalState, reason: string): LoopReceipt => ({
    terminalState: state,
    reason,
    steps: stepCount,
    toolNames: Array.from(new Set(toolNamesUsed)),
    totalDurationMs: Date.now() - startTime,
    tokensUsed: budget.getUsage().tokens,
    history,
    successConditionMet,
  });

  const callSignatures: string[] = [];
  const observations: string[] = [];

  let isRunning = true;
  try {
    while (isRunning) {
      // 1. Cancellation check
      if (options.signal?.aborted) {
        return makeReceipt("cancelled", "Execution was cancelled by caller");
      }

      // 2. Budget check for step
      budget.recordStep();

      stepCount++;

      // 3. Perceive: build prompt
      const toolsOverview = options.toolRegistry
        .getAll()
        .map((t) => `- ${t.name}: ${t.description} (sideEffects: ${t.sideEffects})`)
        .join("\n");

      const observationsText =
        observations.length === 0
          ? "(None yet)"
          : observations.slice(-5).join("\n\n");

      const prompt = `Task: ${options.task}

Available Tools:
${toolsOverview}

Observations from previous tool executions:
${observationsText}

Decide on the next action: call a tool, finish, or refuse. Return structured JSON matching the schema.`;

      const messages: LlmMessage[] = [
        {
          role: "system",
          content:
            options.systemPrompt ??
            "You are an autonomous Solana program development agent. Plan and execute tools to complete the task.",
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      // 4. Decide: call model
      let decision: AgentDecision;
      try {
        const structuredResult = await generateStructured<AgentDecision>(
          options.client,
          AgentDecisionSchema as unknown as z.ZodType<AgentDecision>,
          { messages },
          {
            maxRepairs: 1,
          }
        );
        decision = structuredResult.data;

        // Record conservative token estimate or provider tokens
        budget.recordTokens(Math.max(1, Math.ceil(structuredResult.raw.length / 4)));
      } catch (err: unknown) {
        if (err instanceof BudgetExhaustedError) {
          return makeReceipt("budget_exhausted", err.message);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return makeReceipt("unrecoverable_tool_error", `Failed to obtain valid decision from model: ${msg}`);
      }

      // 5. Handle Model Action
      if (decision.action === "refuse") {
        return makeReceipt("refused", decision.refusalReason ?? "Model refused the task");
      }

      if (decision.action === "finish") {
        if (options.successCondition) {
          const state: AgentLoopState = {
            stepCount,
            history,
            observations,
            task: options.task,
          };
          const conditionMet = await options.successCondition(state);
          if (!conditionMet) {
            observations.push(
              `<system_notice>\nModel indicated completion, but the required success condition is not met yet. Continue working to fulfill the task.\n</system_notice>`
            );
            continue;
          }
        }
        successConditionMet = true;
        return makeReceipt("success", decision.finishSummary ?? "Task completed successfully");
      }

      // action === "call_tool"
      const toolName = decision.toolName;
      if (!toolName) {
        observations.push(
          `<system_notice>Action was call_tool but no toolName was specified.</system_notice>`
        );
        continue;
      }

      const toolArgs = decision.toolArgs || {};
      const callSig = normalizeCallSignature(toolName, toolArgs);

      // Duplicate-call detection
      if (callSignatures.length > 0 && callSignatures[callSignatures.length - 1] === callSig) {
        return makeReceipt(
          "cycle_detected",
          `Duplicate tool call detected: tool "${toolName}" called consecutively with identical arguments.`
        );
      }

      // Oscillation detection: A, B, A, B sequence
      if (callSignatures.length >= 3) {
        const s0 = callSignatures[callSignatures.length - 3];
        const s1 = callSignatures[callSignatures.length - 2];
        const s2 = callSignatures[callSignatures.length - 1];
        const s3 = callSig;

        if (s0 === s2 && s1 === s3 && s0 !== s1) {
          return makeReceipt(
            "cycle_detected",
            `Oscillation detected: alternating sequence [${s0.split(":")[0]}, ${s1.split(":")[0]}, ${s2.split(":")[0]}, ${s3.split(":")[0]}] detected.`
          );
        }
      }

      callSignatures.push(callSig);
      toolNamesUsed.push(toolName);

      // 6. Act & Observe
      const toolStart = Date.now();
      let stepStatus: "ok" | "refused" | "crashed" = "ok";
      let flaggedInjection = false;
      let observationOutput = "";

      try {
        const rawResult = await options.toolRegistry.execute(toolName, toolArgs, toolContext);
        const wrapped = wrapToolResult(toolName, rawResult);
        flaggedInjection = wrapped.flagged;
        observationOutput = wrapped.envelope;
        consecutiveCrashes = 0;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        consecutiveCrashes++;
        stepStatus = "crashed";
        observationOutput = `<tool_failure tool="${toolName}">\n${errMsg}\n</tool_failure>`;

        if (consecutiveCrashes >= maxConsecutiveCrashes) {
          history.push({
            step: stepCount,
            toolName,
            args: toolArgs,
            durationMs: Date.now() - toolStart,
            status: stepStatus,
            observationSummary: observationOutput.slice(0, 200),
            flaggedInjection,
          });
          return makeReceipt(
            "unrecoverable_tool_error",
            `Tool "${toolName}" crashed ${consecutiveCrashes} times consecutively: ${errMsg}`
          );
        }
      }

      const durationMs = Date.now() - toolStart;
      observations.push(observationOutput);

      history.push({
        step: stepCount,
        toolName,
        args: toolArgs,
        durationMs,
        status: stepStatus,
        observationSummary: observationOutput.slice(0, 200),
        flaggedInjection,
      });

      isRunning = stepCount < 10000;
    }

    return makeReceipt("unrecoverable_tool_error", "Loop completed without reaching terminal state");
  } catch (err: unknown) {
    if (err instanceof BudgetExhaustedError) {
      return makeReceipt("budget_exhausted", err.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return makeReceipt("unrecoverable_tool_error", `Fatal error in agent loop: ${msg}`);
  }
}
