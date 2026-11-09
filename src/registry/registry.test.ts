import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { RegistryClient, DEFAULT_REGISTRY_PROGRAM_ID } from "./client";
import { registerProgramInputSchema } from "./validation";
import { SchemaViolationError } from "../core/errors";

describe("Registry Validation & Client", () => {
  const validPubkey = "11111111111111111111111111111111";

  it("validates correct registration inputs", () => {
    const valid = {
      programId: validPubkey,
      programName: "my_token_vault",
      description: "A secure token vault for Solana",
      instructionCount: 4,
    };
    const parsed = registerProgramInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.generatorVersion).toBe("1.0.0");
    }
  });

  it("rejects invalid programId", () => {
    const invalid = {
      programId: "not-a-pubkey",
      programName: "my_vault",
      description: "desc",
      instructionCount: 1,
    };
    const parsed = registerProgramInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects non-snake-case program name", () => {
    const invalid = {
      programId: validPubkey,
      programName: "MyProgram",
      description: "desc",
      instructionCount: 1,
    };
    const parsed = registerProgramInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects instruction counts <= 0 or > 50", () => {
    const zero = registerProgramInputSchema.safeParse({
      programId: validPubkey,
      programName: "my_vault",
      description: "desc",
      instructionCount: 0,
    });
    expect(zero.success).toBe(false);

    const tooMany = registerProgramInputSchema.safeParse({
      programId: validPubkey,
      programName: "my_vault",
      description: "desc",
      instructionCount: 51,
    });
    expect(tooMany.success).toBe(false);
  });

  it("derives deterministic programEntry PDA", () => {
    const client = new RegistryClient();
    const [pda1, bump1] = client.deriveProgramEntryPda(validPubkey);
    const [pda2, bump2] = client.deriveProgramEntryPda(validPubkey);

    expect(pda1.toBase58()).toBe(pda2.toBase58());
    expect(bump1).toBe(bump2);

    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from("program"), new PublicKey(validPubkey).toBuffer()],
      new PublicKey(DEFAULT_REGISTRY_PROGRAM_ID)
    );
    expect(pda1.toBase58()).toBe(expected[0].toBase58());
  });

  it("registers program with simulated default signature", async () => {
    const client = new RegistryClient();
    const result = await client.registerProgram({
      programId: validPubkey,
      programName: "vault_prog",
      description: "Vault program",
      instructionCount: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.txSignature).toBeDefined();
    expect(result.programEntryPda).toBeDefined();
  });

  it("throws SchemaViolationError on bad inputs in registerProgram", async () => {
    const client = new RegistryClient();
    await expect(
      client.registerProgram({
        programId: "bad",
        programName: "bad",
        description: "",
        instructionCount: -1,
      })
    ).rejects.toThrow(SchemaViolationError);
  });

  it("invokes custom txSender if provided", async () => {
    let called = false;
    const client = new RegistryClient({
      txSender: async (input, pda) => {
        called = true;
        expect(input.programName).toBe("custom_prog");
        expect(pda).toBeDefined();
        return "custom_sig_123";
      },
    });

    const result = await client.registerProgram({
      programId: validPubkey,
      programName: "custom_prog",
      description: "A custom program",
      instructionCount: 2,
    });

    expect(called).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.txSignature).toBe("custom_sig_123");
  });
});
