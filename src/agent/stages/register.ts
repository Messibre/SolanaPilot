/**
 * REGISTER Stage: Validates metadata and registers the deployed program in the on-chain registry.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { ToolCrashedError, SchemaViolationError } from "../../core/errors";
import type {
  RegistryClientInterface,
  RegisterProgramInput,
  RegisterProgramResult,
} from "../../registry/types";
import { registerProgramInputSchema } from "../../registry/validation";

export interface RegisterStageInput extends RegisterProgramInput {
  client: RegistryClientInterface;
  onOutput?: (msg: string) => void;
}

export async function registerStage(input: RegisterStageInput): Promise<RegisterProgramResult> {
  const parsed = registerProgramInputSchema.safeParse({
    programId: input.programId,
    programName: input.programName,
    description: input.description,
    instructionCount: input.instructionCount,
    generatorVersion: input.generatorVersion,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? "Invalid metadata";
    throw new SchemaViolationError(`Registration input validation failed: ${issue}`);
  }

  input.onOutput?.(`Registering program "${parsed.data.programName}" (${parsed.data.programId}) on-chain...`);

  const result = await input.client.registerProgram(parsed.data);
  if (!result.ok) {
    const err = result.error ?? "Unknown registry error";
    throw new ToolCrashedError(`Registration failed: ${err}`);
  }

  input.onOutput?.(
    `Program successfully registered! Tx: ${result.txSignature ?? "n/a"}, PDA: ${
      result.programEntryPda ?? "n/a"
    }`
  );

  return result;
}
