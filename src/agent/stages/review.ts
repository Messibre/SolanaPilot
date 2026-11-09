/**
 * REVIEW Stage: Runs the security checklist audit over generated Rust code.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import type { LlmClient } from "../../ai/types";
import { generateStructured } from "../../ai/structured";
import { SkillLoader } from "../skills/loader";

export const FindingSeveritySchema = z.enum(["low", "medium", "high"]);

export const ReviewFindingSchema = z.object({
  severity: FindingSeveritySchema,
  location: z.string().min(1, "Location cannot be empty").max(200),
  issue: z.string().min(1, "Issue description cannot be empty").max(1000),
  suggestion: z.string().min(1, "Suggestion cannot be empty").max(1000),
});

export const ReviewOutputSchema = z.object({
  summary: z.string().min(1, "Summary cannot be empty").max(2000),
  findings: z.array(ReviewFindingSchema).max(50),
  needsHumanReview: z.boolean(),
  uncertainty: z.string().max(1000).optional(),
});

export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type ReviewOutputRaw = z.infer<typeof ReviewOutputSchema>;

export interface ReviewResult extends ReviewOutputRaw {
  blocksDeploy: boolean;
}

export interface ReviewStageInput {
  client: LlmClient;
  programCode: string;
  programName?: string;
  skillLoader?: SkillLoader;
  signal?: AbortSignal;
}

/**
 * Scans Rust code for obvious security defects to complement model audit.
 */
export function runStaticSecurityHeuristics(code: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  // Check 1: Missing signer check pattern (e.g. pub authority: AccountInfo without Signer)
  const missingSignerPattern = /pub\s+(?:authority|admin|owner|user)\s*:\s*AccountInfo<'info>/i;
  if (missingSignerPattern.test(code)) {
    findings.push({
      severity: "high",
      location: "Account validation struct",
      issue: "Authority account is declared as unverified AccountInfo<'info> instead of Signer<'info>",
      suggestion: "Replace AccountInfo<'info> with Signer<'info> to enforce signature validation",
    });
  }

  // Check 2: Unchecked math on balances or counters (naked + or - or *)
  const lines = code.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }
    if (
      /(?:\.|\b)(?:balance|amount|supply|count)\s*=[^;]*[+\-*]/.test(trimmed) &&
      !trimmed.includes("checked_")
    ) {
      findings.push({
        severity: "high",
        location: "Instruction handler logic",
        issue: "Unchecked arithmetic operation detected on balance or amount without overflow protection",
        suggestion: "Use checked_add, checked_sub, or checked_mul and handle overflow with custom error",
      });
      break;
    }
  }

  return findings;
}

/**
 * Executes the REVIEW stage, conducting a 10-point Solana security audit.
 */
export async function reviewStage(input: ReviewStageInput): Promise<ReviewResult> {
  const skillLoader = input.skillLoader ?? new SkillLoader();
  const progressive = skillLoader.buildProgressivePrompt({
    userPrompt: `Security audit of ${input.programName ?? "Anchor program"}: ${input.programCode.slice(0, 200)}`,
    stage: "REVIEW",
  });

  const promptContent = `Perform a rigorous 10-point Solana security checklist review on the following Anchor Rust program:
${input.programName ? `PROGRAM NAME: ${input.programName}\n` : ""}

SOURCE CODE:
${input.programCode}

Respond with a JSON object adhering to this schema:
{
  "summary": "Overall assessment of program security posture",
  "findings": [
    {
      "severity": "high",
      "location": "Instruction or struct name",
      "issue": "Detailed description of vulnerability",
      "suggestion": "Specific remediation recommendation"
    }
  ],
  "needsHumanReview": false
}

Rules:
1. Severity MUST be one of: "low", "medium", "high".
2. Flag ANY missing signer checks or unverified authorities as "high".
3. Flag ANY unchecked integer arithmetic as "high".
4. If no security issues are found, return an empty findings array: [] and a clean summary.`;

  const structuredResult = await generateStructured(
    input.client,
    ReviewOutputSchema,
    {
      messages: [{ role: "user", content: promptContent }],
      system: progressive.fullPrompt,
      signal: input.signal,
    },
    { maxRepairs: 1 }
  );

  const data = structuredResult.data;

  // Combine model findings with static heuristic findings (deduplicating by issue text)
  const heuristicFindings = runStaticSecurityHeuristics(input.programCode);
  const combinedFindings: ReviewFinding[] = [...data.findings];

  for (const hf of heuristicFindings) {
    const alreadyPresent = combinedFindings.some(
      (f) => f.severity === hf.severity && (f.issue.includes("signer") || f.issue.includes("arithmetic"))
    );
    if (!alreadyPresent) {
      combinedFindings.push(hf);
    }
  }

  // Any "high" severity finding blocks deployment
  const hasHighSeverity = combinedFindings.some((f) => f.severity === "high");
  const blocksDeploy = hasHighSeverity;
  const needsHumanReview = data.needsHumanReview || hasHighSeverity;

  return {
    summary: data.summary,
    findings: combinedFindings,
    needsHumanReview,
    uncertainty: data.uncertainty,
    blocksDeploy,
  };
}
