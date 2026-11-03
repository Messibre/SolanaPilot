/**
 * FRONTEND Stage: Generates React + Vite frontend files from Anchor IDL and program ID.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import type { LlmClient } from "../../ai/types";
import { generateStructured } from "../../ai/structured";
import { relativeWorkspacePathSchema } from "../../core/validation";
import { FRONTEND_PROMPT } from "../../systemPrompt";

export const FrontendFileSchema = z.object({
  path: relativeWorkspacePathSchema,
  content: z.string().max(1_000_000, "Frontend file exceeds 1MB limit"),
});

export const FrontendGenerationSchema = z.object({
  type: z.literal("frontend"),
  files: z.array(FrontendFileSchema).min(1, "At least one frontend file required"),
  startCommand: z.string().max(200).optional(),
  needsHumanReview: z.boolean(),
  uncertainty: z.string().max(1000).optional(),
});

export type FrontendGenerationResponse = z.infer<typeof FrontendGenerationSchema>;

export interface FrontendStageInput {
  client: LlmClient;
  idlJson: unknown;
  programId: string;
  maxRepairs?: number;
  signal?: AbortSignal;
}

export function buildFrontendPrompt(idlJson: unknown, programId: string): string {
  return FRONTEND_PROMPT.replace(
    "{IDL}",
    JSON.stringify(idlJson, null, 2)
  ).replace("{PROGRAM_ID}", programId);
}

/**
 * Pipeline stage generating React + Vite frontend files from Anchor IDL and program ID.
 * Strictly adheres to structured output and validation schemas.
 */
export async function frontendStage(input: FrontendStageInput): Promise<FrontendGenerationResponse> {
  const prompt = buildFrontendPrompt(input.idlJson, input.programId);
  const result = await generateStructured(
    input.client,
    FrontendGenerationSchema,
    {
      messages: [{ role: "user", content: prompt }],
      signal: input.signal,
    },
    { maxRepairs: input.maxRepairs ?? 1 }
  );
  return result.data;
}
