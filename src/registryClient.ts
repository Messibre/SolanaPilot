import * as vscode from "vscode";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// Registry program ID placeholder. Must be valid Base58 so extension activation does not fail before deployment.
// Replace with the deployed registry program ID once available.
const REGISTRY_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

export interface RegistryConfig {
  programId: string;
  programName: string;
  description: string;
  instructionCount: number;
}

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

export class RegistryClient {
  private program: Program | null = null;
  private connection: Connection;

  constructor(rpcUrl: string = "https://api.devnet.solana.com") {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  /**
   * Initialize the program client with a wallet provider
   */
  async initialize(provider: AnchorProvider): Promise<void> {
    try {
      // Load the IDL
      const idlPath = path.join(
        __dirname,
        "..",
        "..",
        "idl",
        "solanapilot_registry.json",
      );

      if (!fs.existsSync(idlPath)) {
        const message =
          "[Registry] IDL file not found. Registry integration may not work.";
        vscode.window.showErrorMessage(message);
        throw new Error(message);
      }

      const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8")) as Idl;
      idl.address = REGISTRY_PROGRAM_ID.toString();
      this.program = new Program(idl, provider);
    } catch (error) {
      console.error("[Registry] Failed to initialize client:", error);
      throw error;
    }
  }

  /**
   * Register a generated program in the on-chain registry
   */
  async registerProgram(config: RegistryConfig): Promise<string> {
    if (!this.program) {
      throw new Error(
        "Registry client not initialized. Call initialize() first.",
      );
    }

    try {
      if (!config.programName.trim()) {
        throw new Error("Program name is required.");
      }
      if (!config.description.trim()) {
        throw new Error("Program description is required.");
      }
      if (config.instructionCount <= 0) {
        throw new Error("Instruction count must be greater than zero.");
      }
      if (config.instructionCount > 50) {
        throw new Error("Instruction count must be 50 or less.");
      }

      const programId = new PublicKey(config.programId);

      // Derive the PDA for this program entry
      const [programEntry] = PublicKey.findProgramAddressSync(
        [Buffer.from("program"), programId.toBuffer()],
        REGISTRY_PROGRAM_ID,
      );

      // Call the register_program instruction
      const tx = await this.program.methods
        .registerProgram(
          programId,
          config.programName,
          config.description,
          config.instructionCount,
          "1.0.0", // SolanaPilot version
        )
        .accounts({
          programEntry,
          creator: (this.program.provider as AnchorProvider).wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("[Registry] Failed to register program:", error);
      throw error;
    }
  }

  /**
   * Fetch all registered programs from the registry
   */
  async fetchAllPrograms(): Promise<RegistryProgramEntry[]> {
    if (!this.program) {
      throw new Error(
        "Registry client not initialized. Call initialize() first.",
      );
    }

    try {
      const accountApi = this.program.account as any;
      const accounts = await accountApi.programEntry.all();
      return accounts.map(
        (acc: { publicKey: PublicKey; account: Record<string, unknown> }) => ({
          publicKey: acc.publicKey.toString(),
          ...acc.account,
        }),
      ) as RegistryProgramEntry[];
    } catch (error) {
      console.error("[Registry] Failed to fetch programs:", error);
      return [];
    }
  }

  /**
   * Fetch a specific program entry
   */
  async fetchProgram(programId: string): Promise<RegistryProgramEntry | null> {
    if (!this.program) {
      throw new Error(
        "Registry client not initialized. Call initialize() first.",
      );
    }

    try {
      const pubkey = new PublicKey(programId);
      const [programEntry] = PublicKey.findProgramAddressSync(
        [Buffer.from("program"), pubkey.toBuffer()],
        REGISTRY_PROGRAM_ID,
      );

      const accountApi = this.program.account as any;
      const account = await accountApi.programEntry.fetch(programEntry);
      return {
        publicKey: programEntry.toString(),
        ...account,
      } as RegistryProgramEntry;
    } catch (error) {
      console.error("[Registry] Failed to fetch program:", error);
      return null;
    }
  }

  /**
   * Increment deployment count for a registered program.
   * Only the original creator can call this instruction on-chain.
   */
  async logDeployment(programId: string): Promise<string> {
    if (!this.program) {
      throw new Error(
        "Registry client not initialized. Call initialize() first.",
      );
    }

    try {
      const pubkey = new PublicKey(programId);
      const [programEntry] = PublicKey.findProgramAddressSync(
        [Buffer.from("program"), pubkey.toBuffer()],
        REGISTRY_PROGRAM_ID,
      );

      const tx = await this.program.methods
        .logDeployment()
        .accounts({
          programEntry,
          authority: (this.program.provider as AnchorProvider).wallet.publicKey,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error("[Registry] Failed to log deployment:", error);
      throw error;
    }
  }
}

export async function promptToRegisterProgram(
  config: RegistryConfig,
): Promise<boolean> {
  const response = await vscode.window.showInformationMessage(
    `🎯 Register "${config.programName}" in the SolanaPilot Registry?\n\nThis creates an on-chain record of your AI-generated program, making it discoverable by other developers.`,
    "Register",
    "Skip",
  );

  return response === "Register";
}
