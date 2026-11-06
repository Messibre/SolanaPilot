import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { describe, it, expect, beforeAll } from "vitest";
import idl from "../target/idl/solanapilot_registry.json";

describe("solanapilot_registry Anchor Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(idl as any, provider);
  const PROGRAM_ID = program.programId;

  function deriveProgramEntryPda(progId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("program"), progId.toBuffer()],
      PROGRAM_ID
    );
  }

  async function fundAccount(target: PublicKey, amountLamports = 2 * LAMPORTS_PER_SOL) {
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: target,
        lamports: amountLamports,
      })
    );
    await provider.sendAndConfirm(tx);
  }

  it("happy path: registers a program, fetches account and validates all fields", async () => {
    const dummyProgram = Keypair.generate();
    const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

    const programName = "counter_program";
    const description = "A simple counter on Solana";
    const instructionCount = 3;
    const generatorVersion = "0.1.0";

    await program.methods
      .registerProgram(
        dummyProgram.publicKey,
        programName,
        description,
        instructionCount,
        generatorVersion
      )
      .accounts({
        programEntry: entryPda,
        creator: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await (program.account as any).programEntry.fetch(entryPda);
    expect(account.programId.toBase58()).toBe(dummyProgram.publicKey.toBase58());
    expect(account.programName).toBe(programName);
    expect(account.description).toBe(description);
    expect(account.instructionCount).toBe(instructionCount);
    expect(account.creator.toBase58()).toBe(provider.wallet.publicKey.toBase58());
    expect(account.generatorVersion).toBe(generatorVersion);
    expect(account.deploymentCount.toNumber()).toBe(0);
  });

  describe("register_program validation and boundaries", () => {
    it("accepts max allowed string lengths: name=50, desc=200, version=20, instructions=50", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      const maxName = "a".repeat(50);
      const maxDesc = "d".repeat(200);
      const maxVersion = "v".repeat(20);
      const maxInstructions = 50;

      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          maxName,
          maxDesc,
          maxInstructions,
          maxVersion
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const account = await (program.account as any).programEntry.fetch(entryPda);
      expect(account.programName).toBe(maxName);
      expect(account.description).toBe(maxDesc);
      expect(account.generatorVersion).toBe(maxVersion);
      expect(account.instructionCount).toBe(50);
    });

    it("rejects name > 50 characters (max+1) with InvalidProgramName", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);
      const badName = "a".repeat(51);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            badName,
            "Valid description",
            5,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidProgramName");
      }
    });

    it("rejects non-snake_case or uppercase program names with InvalidProgramName", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "Not_Snake_Case",
            "Valid description",
            5,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidProgramName");
      }
    });

    it("rejects description > 200 characters (max+1) with DescriptionTooLong", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);
      const badDesc = "d".repeat(201);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "good_name",
            badDesc,
            5,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("DescriptionTooLong");
      }
    });

    it("rejects empty / whitespace description with InvalidDescription", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "good_name",
            "   ",
            5,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidDescription");
      }
    });

    it("rejects instruction count = 0 with InvalidInstructionCount", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "good_name",
            "Valid description",
            0,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidInstructionCount");
      }
    });

    it("rejects instruction count = 51 (max+1) with InvalidInstructionCount", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "good_name",
            "Valid description",
            51,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidInstructionCount");
      }
    });

    it("rejects generator version > 20 characters (max+1) with GeneratorVersionTooLong", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);
      const badVersion = "v".repeat(21);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "good_name",
            "Valid description",
            5,
            badVersion
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("GeneratorVersionTooLong");
      }
    });

    it("rejects empty generator version with InvalidGeneratorVersion", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "good_name",
            "Valid description",
            5,
            "  "
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidGeneratorVersion");
      }
    });

    it("rejects system program ID with InvalidProgramId", async () => {
      const [entryPda] = deriveProgramEntryPda(SystemProgram.programId);

      try {
        await program.methods
          .registerProgram(
            SystemProgram.programId,
            "system_name",
            "Valid description",
            5,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Should have failed");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("InvalidProgramId");
      }
    });

    it("rejects duplicate registration of the same program ID", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      // First registration succeeds
      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "original_prog",
          "Initial registration",
          3,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Second registration fails because PDA is already initialized
      try {
        await program.methods
          .registerProgram(
            dummyProgram.publicKey,
            "duplicate_prog",
            "Second attempt",
            3,
            "1.0.0"
          )
          .accounts({
            programEntry: entryPda,
            creator: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.unreachable("Duplicate should fail");
      } catch (err: any) {
        // Anchor reports already initialized / 0x0
        expect(err).toBeDefined();
      }
    });
  });

  describe("log_deployment", () => {
    it("happy path: creator increments deployment_count", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "deployed_prog",
          "Deployment test",
          2,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .logDeployment()
        .accounts({
          programEntry: entryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      let account = await (program.account as any).programEntry.fetch(entryPda);
      expect(account.deploymentCount.toNumber()).toBe(1);

      await program.methods
        .logDeployment()
        .accounts({
          programEntry: entryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      account = await (program.account as any).programEntry.fetch(entryPda);
      expect(account.deploymentCount.toNumber()).toBe(2);
    });

    it("rejects non-authority / wrong signer with Unauthorized", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "auth_test_prog",
          "Unauthorized test",
          2,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const impostor = Keypair.generate();
      await fundAccount(impostor.publicKey);

      try {
        await program.methods
          .logDeployment()
          .accounts({
            programEntry: entryPda,
            authority: impostor.publicKey,
          })
          .signers([impostor])
          .rpc();
        expect.unreachable("Non-creator should fail");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("Unauthorized");
      }
    });
  });

  describe("update_program_info", () => {
    it("happy path: creator updates description and instruction count", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "updateable_prog",
          "Initial description",
          4,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const newDesc = "Updated description text";
      const newCount = 8;

      await program.methods
        .updateProgramInfo(newDesc, newCount)
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
        })
        .rpc();

      const account = await (program.account as any).programEntry.fetch(entryPda);
      expect(account.description).toBe(newDesc);
      expect(account.instructionCount).toBe(newCount);
    });

    it("rejects non-creator trying to update info with Unauthorized", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "protected_prog",
          "Initial",
          2,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const attacker = Keypair.generate();
      await fundAccount(attacker.publicKey);

      try {
        await program.methods
          .updateProgramInfo("Malicious update", 10)
          .accounts({
            programEntry: entryPda,
            creator: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        expect.unreachable("Non-creator update should fail");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("Unauthorized");
      }
    });
  });

  describe("close_program_entry", () => {
    it("rejects non-creator trying to close with Unauthorized", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "close_secure_prog",
          "Close security test",
          2,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const attacker = Keypair.generate();
      await fundAccount(attacker.publicKey);

      try {
        await program.methods
          .closeProgramEntry()
          .accounts({
            programEntry: entryPda,
            creator: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        expect.unreachable("Non-creator close should fail");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).toBe("Unauthorized");
      }
    });

    it("happy path: creator closes entry, refunds rent, and second close fails", async () => {
      const dummyProgram = Keypair.generate();
      const [entryPda] = deriveProgramEntryPda(dummyProgram.publicKey);

      const creator = Keypair.generate();
      await fundAccount(creator.publicKey, 2 * LAMPORTS_PER_SOL);

      const balBefore = await provider.connection.getBalance(creator.publicKey);

      // Register program
      await program.methods
        .registerProgram(
          dummyProgram.publicKey,
          "closable_prog",
          "Testing close and refund",
          3,
          "1.0.0"
        )
        .accounts({
          programEntry: entryPda,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const balAfterRegister = await provider.connection.getBalance(creator.publicKey);
      expect(balAfterRegister).toBeLessThan(balBefore);

      // Close program entry
      await program.methods
        .closeProgramEntry()
        .accounts({
          programEntry: entryPda,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      const balAfterClose = await provider.connection.getBalance(creator.publicKey);
      // Rent was refunded (minus small tx fee)
      expect(balAfterClose).toBeGreaterThan(balAfterRegister);

      // Account should no longer exist
      const closedAccount = await (program.account as any).programEntry.fetchNullable(entryPda);
      expect(closedAccount).toBeNull();

      // Attempting to close twice fails
      try {
        await program.methods
          .closeProgramEntry()
          .accounts({
            programEntry: entryPda,
            creator: creator.publicKey,
          })
          .signers([creator])
          .rpc();
        expect.unreachable("Closing twice must fail");
      } catch (err) {
        expect(err).toBeDefined();
      }
    });
  });
});

