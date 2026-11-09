/**
 * TEST Stage: Generates Anchor TypeScript integration test suites (happy + failure paths).
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import * as fs from "node:fs";
import { z } from "zod";
import { resolveInWorkspace } from "../../security/pathGuard";
import { ToolRefusedError } from "../../core/errors";
import type { LlmClient } from "../../ai/types";
import { generateStructured } from "../../ai/structured";
import { SkillLoader } from "../skills/loader";
import { GeneratedFileSchema } from "./generate";

export const InstructionCoverageSchema = z.object({
  instructionName: z.string().min(1, "Instruction name cannot be empty").max(64),
  hasHappyPath: z.boolean(),
  hasFailurePath: z.boolean(),
});

export const TestOutputSchema = z.object({
  testFiles: z
    .array(GeneratedFileSchema)
    .min(1, "Must generate at least one test file")
    .max(10, "Too many test files"),
  coverage: z
    .array(InstructionCoverageSchema)
    .min(1, "Must cover at least one instruction"),
  needsHumanReview: z.boolean(),
  uncertainty: z.string().max(1000).optional(),
});

export type InstructionCoverage = z.infer<typeof InstructionCoverageSchema>;
export type TestOutput = z.infer<typeof TestOutputSchema>;

export interface TestStageInput {
  client: LlmClient;
  workspaceRoot: string;
  programName: string;
  programCode: string;
  instructions?: string[];
  skillLoader?: SkillLoader;
  allowOverwrite?: boolean;
  fileExists?: (filePath: string) => boolean;
  signal?: AbortSignal;
}

/**
 * Executes the TEST stage, generating Anchor Mocha/Chai integration tests.
 */
export async function testStage(input: TestStageInput): Promise<TestOutput> {
  const skillLoader = input.skillLoader ?? new SkillLoader();
  const progressive = skillLoader.buildProgressivePrompt({
    userPrompt: `Generate comprehensive tests for ${input.programName}`,
    stage: "TEST",
  });

  const promptContent = `Generate complete Anchor TypeScript integration tests using Mocha and Chai for the following program:
PROGRAM NAME: ${input.programName}
${input.instructions ? `INSTRUCTIONS TO TEST: ${input.instructions.join(", ")}\n` : ""}

SOURCE CODE:
${input.programCode}

Respond with a JSON object adhering to this schema:
{
  "testFiles": [
    {
      "path": "tests/${input.programName}.ts",
      "content": "import * as anchor from '@coral-xyz/anchor';\nimport { expect } from 'chai';\n..."
    }
  ],
  "coverage": [
    {
      "instructionName": "instruction_name",
      "hasHappyPath": true,
      "hasFailurePath": true
    }
  ],
  "needsHumanReview": false
}

Rules:
1. Every instruction must have both a happy path test and at least one failure path test (e.g. unauthorized signer, overflow, invalid PDA).
2. Test files must use relative paths in tests/ folder (e.g. tests/${input.programName}.ts).
3. Do not use placeholder code or skipped tests.`;

  const result = await generateStructured(
    input.client,
    TestOutputSchema,
    {
      messages: [{ role: "user", content: promptContent }],
      system: progressive.fullPrompt,
      signal: input.signal,
    },
    { maxRepairs: 1 }
  );

  const output = result.data;
  const fileExistsFn = input.fileExists ?? fs.existsSync;

  // Path guarding and overwrite verification for generated test files
  for (const file of output.testFiles) {
    const resolvedPath = resolveInWorkspace(input.workspaceRoot, file.path, "write");
    if (fileExistsFn(resolvedPath) && !input.allowOverwrite) {
      throw new ToolRefusedError(
        `Refusing to overwrite existing file without confirmation: ${file.path}`
      );
    }
  }

  // Ensure coverage includes failure paths
  const missingFailurePaths = output.coverage.filter((c) => !c.hasFailurePath);
  if (missingFailurePaths.length > 0) {
    output.needsHumanReview = true;
    output.uncertainty = `Missing failure path test coverage for: ${missingFailurePaths.map((c) => c.instructionName).join(", ")}`;
  }

  return output;
}
