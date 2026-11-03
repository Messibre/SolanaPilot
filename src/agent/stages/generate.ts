/**
 * GENERATE Stage: Generates files for an Anchor program based on a plan.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import * as fs from "node:fs";
import { z } from "zod";
import { programNameSchema, relativeWorkspacePathSchema } from "../../core/validation";
import { resolveInWorkspace } from "../../security/pathGuard";
import { ToolRefusedError, SchemaViolationError } from "../../core/errors";
import type { LlmClient } from "../../ai/types";
import { generateStructured } from "../../ai/structured";
import { SkillLoader } from "../skills/loader";
import type { PlanOutput } from "./plan";

export const MAX_FILE_SIZE_BYTES = 1_000_000; // 1 MB
export const MAX_TOTAL_FILES_BYTES = 5_000_000; // 5 MB
export const MAX_FILES_COUNT = 50;

export const GeneratedFileSchema = z.object({
  path: relativeWorkspacePathSchema,
  content: z
    .string()
    .min(1, "File content cannot be empty")
    .max(MAX_FILE_SIZE_BYTES, `File content exceeds ${MAX_FILE_SIZE_BYTES} bytes limit`),
});

export const GenerateOutputSchema = z.object({
  type: z.literal("full_program").optional(),
  programName: programNameSchema,
  description: z.string().min(1, "Description cannot be empty").max(2000, "Description exceeds 2000 chars"),
  files: z
    .array(GeneratedFileSchema)
    .min(1, "At least one file must be generated")
    .max(MAX_FILES_COUNT, `Cannot generate more than ${MAX_FILES_COUNT} files`),
  needsHumanReview: z.boolean(),
  uncertainty: z.string().max(1000).optional(),
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;
export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

export interface GenerateStageInput {
  client: LlmClient;
  workspaceRoot: string;
  plan: PlanOutput;
  skillLoader?: SkillLoader;
  allowOverwrite?: boolean;
  fileExists?: (filePath: string) => boolean;
  maxRepairs?: number;
  signal?: AbortSignal;
}

/**
 * Executes the GENERATE stage, producing validated, path-guarded program files.
 */
export async function generateStage(input: GenerateStageInput): Promise<GenerateOutput> {
  const skillLoader = input.skillLoader ?? new SkillLoader();
  const progressive = skillLoader.buildProgressivePrompt({
    userPrompt: `${input.plan.description} ${input.plan.programName}`,
    stage: "GENERATE",
  });

  const promptContent = `Generate all necessary Anchor program files for the following plan:
PROGRAM NAME: ${input.plan.programName}
DESCRIPTION: ${input.plan.description}
ACCOUNTS: ${JSON.stringify(input.plan.accounts, null, 2)}
INSTRUCTIONS: ${JSON.stringify(input.plan.instructions, null, 2)}
RISKS: ${JSON.stringify(input.plan.risks, null, 2)}

Respond with a JSON object adhering to this schema:
{
  "type": "full_program",
  "programName": "${input.plan.programName}",
  "description": "${input.plan.description}",
  "files": [
    {
      "path": "programs/${input.plan.programName}/src/lib.rs",
      "content": "// complete Rust source code"
    },
    {
      "path": "Anchor.toml",
      "content": "..."
    }
  ],
  "needsHumanReview": false
}

Rules:
1. Every file path must be relative to the workspace root. Never use absolute paths or '..' traversal.
2. Provide complete, fully compilable Anchor code. Do not leave placeholder comments.
3. Use Anchor 0.30+ idioms, check all arithmetic, validate signers and mutability.`;

  const result = await generateStructured(
    input.client,
    GenerateOutputSchema,
    {
      messages: [{ role: "user", content: promptContent }],
      system: progressive.fullPrompt,
      signal: input.signal,
    },
    { maxRepairs: input.maxRepairs ?? 1 }
  );

  const output = result.data;
  const fileExistsFn = input.fileExists ?? fs.existsSync;

  // Validate that generated program name matches the plan
  if (output.programName !== input.plan.programName) {
    throw new SchemaViolationError(
      `Generated programName '${output.programName}' does not match plan programName '${input.plan.programName}'`
    );
  }

  // Validate total payload size cap
  let totalBytes = 0;
  for (const file of output.files) {
    totalBytes += Buffer.byteLength(file.content, "utf8");
  }
  if (totalBytes > MAX_TOTAL_FILES_BYTES) {
    throw new ToolRefusedError(
      `Total generated files size (${totalBytes} bytes) exceeds maximum allowed limit (${MAX_TOTAL_FILES_BYTES} bytes)`
    );
  }

  // Path guarding and overwrite verification
  for (const file of output.files) {
    // 1. Enforce workspace containment and deny list (.git, .ssh, id.json, etc.)
    const resolvedPath = resolveInWorkspace(input.workspaceRoot, file.path, "write");

    // 2. Prevent overwriting existing workspace files without confirmation
    if (fileExistsFn(resolvedPath) && !input.allowOverwrite) {
      throw new ToolRefusedError(
        `Refusing to overwrite existing file without confirmation: ${file.path}`
      );
    }
  }

  return output;
}
