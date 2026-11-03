/**
 * Registry types for on-chain program registration.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

export interface RegistryProgramEntry {
  publicKey: string;
  programId: string;
  programName: string;
  description: string;
  instructionCount: number;
  creator: string;
  registeredAt: number;
  lastUpdated: number;
  generatorVersion: string;
  deploymentCount: number;
  bump: number;
}

export interface RegisterProgramInput {
  programId: string;
  programName: string;
  description: string;
  instructionCount: number;
  generatorVersion?: string;
}

export interface RegisterProgramResult {
  ok: boolean;
  txSignature?: string;
  programEntryPda?: string;
  error?: string;
}

export interface RegistryClientInterface {
  registerProgram(input: RegisterProgramInput): Promise<RegisterProgramResult>;
  fetchProgram(programId: string): Promise<RegistryProgramEntry | null>;
  fetchAllPrograms(): Promise<RegistryProgramEntry[]>;
  logDeployment(programId: string): Promise<RegisterProgramResult>;
}
