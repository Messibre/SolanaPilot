/**
 * FIX Stage: Implements the targeted search-and-replace patch loop with error signature tracking.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import * as fs from "node:fs";
import { z } from "zod";
import { relativeWorkspacePathSchema } from "../../core/validation";
import { resolveInWorkspace } from "../../security/pathGuard";
import { ToolRefusedError } from "../../core/errors";
import type { LlmClient } from "../../ai/types";
import { generateStructured } from "../../ai/structured";
import { SkillLoader } from "../skills/loader";
import { buildStage, type BuildStageResult, type ParsedCompilerError } from "./build";
import type { TerminalState } from "../receipts";

export const PatchItemSchema = z.object({
  file: relativeWorkspacePathSchema,
  search: z.string().min(1, "Search pattern cannot be empty").max(10_000),
  replace: z.string().max(10_000),
  explanation: z.string().max(500).optional(),
});

export const FixOutputSchema = z.object({
  patches: z.array(PatchItemSchema).min(1, "Must provide at least one patch").max(10),
  strategy: z.string().min(1).max(1000).optional(),
  needsHumanReview: z.boolean(),
  uncertainty: z.string().max(1000).optional(),
});

export type PatchItem = z.infer<typeof PatchItemSchema>;
export type FixOutput = z.infer<typeof FixOutputSchema>;

export interface BuildFixHistoryEntry {
  round: number;
  errorSignature?: string;
  errors: ParsedCompilerError[];
  patchesApplied?: number;
  strategyUsed: string;
}

export interface BuildFixReceipt {
  terminalState: TerminalState;
  success: boolean;
  rounds: number;
  history: BuildFixHistoryEntry[];
  reason: string;
  finalError?: string;
}

export interface BuildAndFixLoopInput {
  client: LlmClient;
  workspaceRoot: string;
  programName: string;
  maxRounds?: number;
  runCheck?: (cwd: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readFile?: (filePath: string) => Promise<string> | string;
  writeFile?: (filePath: string, content: string) => Promise<void> | void;
  skillLoader?: SkillLoader;
  signal?: AbortSignal;
}

/**
 * Applies a single search-and-replace patch to a workspace file.
 */
export async function applyPatch(
  workspaceRoot: string,
  patch: PatchItem,
  readFileFn: (p: string) => Promise<string> | string,
  writeFileFn: (p: string, c: string) => Promise<void> | void
): Promise<void> {
  const fullPath = resolveInWorkspace(workspaceRoot, patch.file, "write");
  const original = await readFileFn(fullPath);

  if (!original.includes(patch.search)) {
    throw new ToolRefusedError(
      `Patch failed: search pattern not found in ${patch.file}`
    );
  }

  const updated = original.replace(patch.search, patch.replace);
  await writeFileFn(fullPath, updated);
}

/**
 * Runs the build-and-fix loop: builds, parses compiler errors, asks for patches,
 * tracks error signatures, adapts strategy prompt on repetition, and caps at 3 rounds.
 */
export async function runBuildAndFixLoop(
  input: BuildAndFixLoopInput
): Promise<BuildFixReceipt> {
  const maxRounds = input.maxRounds ?? 3;
  const readFileFn =
    input.readFile ?? ((p: string) => fs.readFileSync(p, "utf-8"));
  const writeFileFn =
    input.writeFile ?? ((p: string, c: string) => fs.writeFileSync(p, c, "utf-8"));
  const skillLoader = input.skillLoader ?? new SkillLoader();

  // 1. Initial build check
  const initialBuild: BuildStageResult = await buildStage({
    workspaceRoot: input.workspaceRoot,
    runCheck: input.runCheck,
  });

  if (initialBuild.success) {
    return {
      terminalState: "success",
      success: true,
      rounds: 0,
      history: [],
      reason: "Initial build passed without compiler errors",
    };
  }

  const history: BuildFixHistoryEntry[] = [];
  const signatureCounts = new Map<string, number>();
  let currentErrors = initialBuild.errors;
  let currentSig = initialBuild.signature ?? "unknown_error";
  signatureCounts.set(currentSig, 1);

  for (let round = 1; round <= maxRounds; round++) {
    // Check if stuck on the same error signature a third time
    if ((signatureCounts.get(currentSig) ?? 0) >= 3) {
      return {
        terminalState: "cycle_detected",
        success: false,
        rounds: round - 1,
        history,
        reason: `Build and fix aborted: repeated error signature 3 times (${currentSig})`,
        finalError: currentSig,
      };
    }

    // Determine strategy prompt based on signature repetition
    const repeatedCount = signatureCounts.get(currentSig) ?? 1;
    let strategyPrompt = "Provide targeted search-and-replace patches to resolve compiler errors.";
    if (repeatedCount >= 2) {
      strategyPrompt =
        "ALTERNATIVE STRATEGY REQUIRED: The previous patch did not resolve the compiler error signature. Do not repeat minor syntax edits. Re-examine account structures, seeds, lifetime annotations, or Anchor attribute constraints.";
    }

    const progressive = skillLoader.buildProgressivePrompt({
      userPrompt: `Fix compiler error for ${input.programName}: ${currentSig}`,
      stage: "FIX",
    });

    const userMessageContent = `The Anchor build failed with the following errors:
PROGRAM: ${input.programName}
ROUND: ${round} of ${maxRounds}
STRATEGY DIRECTIVE: ${strategyPrompt}

COMPILER ERRORS:
${currentErrors.map((e) => `- ${e.code ? `[${e.code}] ` : ""}${e.message}${e.file ? ` (${e.file}:${e.line ?? "?"})` : ""}`).join("\n")}

RAW COMPILER OUTPUT:
${currentErrors.map((e) => e.raw).join("\n\n").slice(0, 3000)}

Respond with a JSON patch object:
{
  "patches": [
    {
      "file": "programs/${input.programName}/src/lib.rs",
      "search": "exact string to replace",
      "replace": "replacement string",
      "explanation": "why this fixes the issue"
    }
  ],
  "strategy": "summary of the approach used",
  "needsHumanReview": false
}

Rules:
1. Provide SURGICAL patches (file, search, replace). Do NOT rewrite entire files.
2. Search string must match exactly in the target file.
3. Use correct Anchor 0.30+ idioms.`;

    const fixResult = await generateStructured(
      input.client,
      FixOutputSchema,
      {
        messages: [{ role: "user", content: userMessageContent }],
        system: progressive.fullPrompt,
        signal: input.signal,
      },
      { maxRepairs: 1 }
    );

    const fixData = fixResult.data;

    // Apply each patch
    for (const patch of fixData.patches) {
      await applyPatch(input.workspaceRoot, patch, readFileFn, writeFileFn);
    }

    // Rebuild
    const rebuild: BuildStageResult = await buildStage({
      workspaceRoot: input.workspaceRoot,
      runCheck: input.runCheck,
    });

    history.push({
      round,
      errorSignature: currentSig,
      errors: currentErrors,
      patchesApplied: fixData.patches.length,
      strategyUsed: strategyPrompt,
    });

    if (rebuild.success) {
      return {
        terminalState: "success",
        success: true,
        rounds: round,
        history,
        reason: `Build succeeded after fix round ${round}`,
      };
    }

    // Update errors and signature counts for next round
    currentErrors = rebuild.errors;
    currentSig = rebuild.signature ?? "unknown_error";
    signatureCounts.set(currentSig, (signatureCounts.get(currentSig) ?? 0) + 1);
  }

  const finalSigCount = signatureCounts.get(currentSig) ?? 0;
  return {
    terminalState: finalSigCount >= 3 ? "cycle_detected" : "unrecoverable_tool_error",
    success: false,
    rounds: maxRounds,
    history,
    reason: `Build still failing after maximum fix rounds (${maxRounds})`,
    finalError: currentSig,
  };
}
