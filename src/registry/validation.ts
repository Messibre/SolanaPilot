/**
 * Registry validation schemas.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";
import { pubkeySchema, programNameSchema } from "../core/validation";

export const registerProgramInputSchema = z.object({
  programId: pubkeySchema,
  programName: programNameSchema,
  description: z
    .string()
    .trim()
    .min(1, "Description cannot be empty")
    .max(2000, "Description cannot exceed 2000 characters"),
  instructionCount: z
    .number()
    .int("Instruction count must be an integer")
    .min(1, "Instruction count must be at least 1")
    .max(50, "Instruction count must not exceed 50"),
  generatorVersion: z.string().trim().max(32).default("1.0.0"),
});

export type ValidatedRegisterProgramInput = z.infer<typeof registerProgramInputSchema>;
