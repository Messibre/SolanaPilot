/**
 * PLAN Stage: Produces a structured Solana program architecture plan.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import { programNameSchema } from "../../core/validation";
import type { LlmClient } from "../../ai/types";
import { generateStructured } from "../../ai/structured";
import { SkillLoader } from "../skills/loader";

export const PlanAccountSchema = z.object({
  name: z.string().min(1, "Account name cannot be empty").max(64, "Account name exceeds 64 chars"),
  description: z.string().max(500, "Account description exceeds 500 chars").optional(),
  isMut: z.boolean().optional(),
  isSigner: z.boolean().optional(),
  seeds: z.array(z.string().max(64)).optional(),
});

export const PlanInstructionSchema = z.object({
  name: z.string().min(1, "Instruction name cannot be empty").max(64, "Instruction name exceeds 64 chars"),
  description: z.string().max(500, "Instruction description exceeds 500 chars").optional(),
  accounts: z.array(z.string().max(64)).optional(),
  args: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        type: z.string().min(1).max(64),
      })
    )
    .optional(),
});

export const PlanOutputSchema = z.object({
  programName: programNameSchema,
  description: z.string().min(1, "Description cannot be empty").max(2000, "Description exceeds 2000 chars"),
  accounts: z
    .array(z.union([z.string().min(1).max(100), PlanAccountSchema]))
    .min(1, "Plan must define at least one account")
    .max(50, "Too many accounts"),
  instructions: z
    .array(z.union([z.string().min(1).max(100), PlanInstructionSchema]))
    .min(1, "Plan must define at least one instruction")
    .max(50, "Too many instructions"),
  risks: z.array(z.string().min(1).max(1000)),
  needsHumanReview: z.boolean(),
  uncertainty: z.string().max(1000).optional(),
});

export type PlanAccount = z.infer<typeof PlanAccountSchema>;
export type PlanInstruction = z.infer<typeof PlanInstructionSchema>;
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

export interface PlanStageInput {
  client: LlmClient;
  userPrompt: string;
  programName?: string;
  skillLoader?: SkillLoader;
  maxRepairs?: number;
  signal?: AbortSignal;
}

/**
 * Executes the PLAN stage, generating a structured architecture plan.
 */
export async function planStage(input: PlanStageInput): Promise<PlanOutput> {
  const skillLoader = input.skillLoader ?? new SkillLoader();
  const progressive = skillLoader.buildProgressivePrompt({
    userPrompt: input.userPrompt,
    stage: "PLAN",
  });

  const promptContent = `Generate a structured architecture and implementation plan for the following Solana program request:
REQUEST: ${input.userPrompt}
${input.programName ? `REQUESTED PROGRAM NAME (snake_case): ${input.programName}\n` : ""}

Respond with a JSON object that adheres strictly to the required schema:
{
  "programName": "snake_case_name",
  "description": "one or two sentence summary",
  "accounts": [
    { "name": "AccountName", "description": "purpose", "isMut": true, "isSigner": false }
  ],
  "instructions": [
    { "name": "instruction_name", "description": "purpose" }
  ],
  "risks": [
    "Identified security or implementation risk"
  ],
  "needsHumanReview": false,
  "uncertainty": "optional notes if anything was ambiguous"
}

Constraints:
1. Program name MUST be valid snake_case, between 3 and 32 characters.
2. Define accounts, PDAs, signers, and instructions needed for Anchor.
3. If anything is ambiguous, high-risk, or touches custody without clear rules, set needsHumanReview to true.`;

  const result = await generateStructured(
    input.client,
    PlanOutputSchema,
    {
      messages: [{ role: "user", content: promptContent }],
      system: progressive.fullPrompt,
      signal: input.signal,
    },
    { maxRepairs: input.maxRepairs ?? 1 }
  );

  return result.data;
}
