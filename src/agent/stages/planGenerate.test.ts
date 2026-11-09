/**
 * Unit tests for PLAN and GENERATE pipeline stages.
 * Tests scripted mock provider, malformed output, path traversal, oversized files, and overwrite guards.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { MockLlmClient } from "../../ai/providers/mock";
import { planStage, type PlanOutput } from "./plan";
import { generateStage } from "./generate";
import { SchemaViolationError, ToolRefusedError } from "../../core/errors";

const MOCK_WORKSPACE = process.platform === "win32" ? "C:\\mock\\workspace" : "/mock/workspace";

describe("Stage: PLAN", () => {
  it("produces valid structured plan on happy path with MockLlmClient", async () => {
    const validPlan = {
      programName: "solana_vault",
      description: "A secure vault program for hackathon deposits",
      accounts: [
        { name: "Vault", description: "State account for vault balances", isMut: true, isSigner: false },
        { name: "Authority", description: "Vault admin signer", isMut: true, isSigner: true },
      ],
      instructions: [
        { name: "initialize", description: "Creates a new vault PDA" },
        { name: "deposit", description: "Deposits funds into vault" },
      ],
      risks: ["Missing signer check on withdraw", "Arithmetic overflow in deposit"],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(validPlan));

    const plan = await planStage({
      client,
      userPrompt: "Build a secure vault program with deposits",
      programName: "solana_vault",
    });

    expect(plan.programName).toBe("solana_vault");
    expect(plan.description).toContain("vault");
    expect(plan.accounts.length).toBe(2);
    expect(plan.instructions.length).toBe(2);
    expect(plan.risks.length).toBe(2);
    expect(plan.needsHumanReview).toBe(false);
  });

  it("fails with SchemaViolationError when programName is not valid snake_case", async () => {
    const invalidPlan = {
      programName: "SolanaVaultProgram", // Invalid PascalCase
      description: "Vault description",
      accounts: ["Vault"],
      instructions: ["initialize"],
      risks: [],
      needsHumanReview: false,
    };

    // Client returns invalid plan twice (initial + 1 repair attempt)
    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(invalidPlan))
      .enqueueResponse(JSON.stringify(invalidPlan));

    await expect(
      planStage({
        client,
        userPrompt: "Build a vault",
        maxRepairs: 1,
      })
    ).rejects.toThrow(SchemaViolationError);
  });

  it("fails with SchemaViolationError when accounts array is empty", async () => {
    const invalidPlan = {
      programName: "empty_vault",
      description: "Vault description",
      accounts: [], // Empty accounts rejected
      instructions: ["initialize"],
      risks: [],
      needsHumanReview: false,
    };

    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(invalidPlan))
      .enqueueResponse(JSON.stringify(invalidPlan));

    await expect(
      planStage({
        client,
        userPrompt: "Build an empty vault",
        maxRepairs: 1,
      })
    ).rejects.toThrow(SchemaViolationError);
  });
});

describe("Stage: GENERATE", () => {
  const samplePlan: PlanOutput = {
    programName: "token_locker",
    description: "Lock tokens until timestamp",
    accounts: [{ name: "Locker", isMut: true, isSigner: false }],
    instructions: [{ name: "lock", description: "locks tokens" }],
    risks: ["Timestamp manipulation"],
    needsHumanReview: false,
  };

  it("produces validated files on happy path", async () => {
    const validGeneration = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: "programs/token_locker/src/lib.rs",
          content: "use anchor_lang::prelude::*;\n\ndeclare_id!(\"11111111111111111111111111111111\");",
        },
        {
          path: "Anchor.toml",
          content: "[programs.localnet]\ntoken_locker = \"11111111111111111111111111111111\"",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(validGeneration));

    const output = await generateStage({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      plan: samplePlan,
      fileExists: () => false,
    });

    expect(output.programName).toBe("token_locker");
    expect(output.files.length).toBe(2);
    expect(output.files[0].path).toBe("programs/token_locker/src/lib.rs");
  });

  it("rejects path traversal in file paths (relativeWorkspacePathSchema)", async () => {
    const traversalGeneration = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: "../outside/evil.rs",
          content: "// malicious file",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(traversalGeneration))
      .enqueueResponse(JSON.stringify(traversalGeneration));

    await expect(
      generateStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        plan: samplePlan,
        fileExists: () => false,
      })
    ).rejects.toThrow(SchemaViolationError);
  });

  it("rejects forbidden files in deny list via resolveInWorkspace (e.g. .git/config)", async () => {
    const forbiddenGeneration = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: ".git/config",
          content: "[core]\nrepositoryformatversion = 0",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(forbiddenGeneration));

    await expect(
      generateStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        plan: samplePlan,
        fileExists: () => false,
      })
    ).rejects.toThrow(ToolRefusedError);
  });

  it("rejects keypair and id.json files via resolveInWorkspace", async () => {
    const keypairGeneration = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: "target/deploy/my_program-keypair.json",
          content: "[1,2,3]",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(keypairGeneration));

    await expect(
      generateStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        plan: samplePlan,
        fileExists: () => false,
      })
    ).rejects.toThrow(ToolRefusedError);
  });

  it("rejects oversized single file content (> 1MB)", async () => {
    const oversizedContent = "a".repeat(1_000_001);
    const oversizedGeneration = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: "programs/token_locker/src/lib.rs",
          content: oversizedContent,
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(oversizedGeneration))
      .enqueueResponse(JSON.stringify(oversizedGeneration));

    await expect(
      generateStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        plan: samplePlan,
        fileExists: () => false,
      })
    ).rejects.toThrow(SchemaViolationError);
  });

  it("rejects overwriting existing file when allowOverwrite is false", async () => {
    const generation = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: "programs/token_locker/src/lib.rs",
          content: "// safe code",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(generation));

    // Simulate file existing in workspace
    const existingFile = path.resolve(MOCK_WORKSPACE, "programs/token_locker/src/lib.rs");
    const fileExistsFn = (p: string) => path.resolve(p) === existingFile;

    await expect(
      generateStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        plan: samplePlan,
        fileExists: fileExistsFn,
        allowOverwrite: false,
      })
    ).rejects.toThrow(/Refusing to overwrite existing file without confirmation/);
  });

  it("allows overwriting existing file when allowOverwrite is true", async () => {
    const generation = {
      type: "full_program",
      programName: "token_locker",
      description: "Lock tokens until timestamp",
      files: [
        {
          path: "programs/token_locker/src/lib.rs",
          content: "// overwrite confirmed",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(generation));

    const existingFile = path.resolve(MOCK_WORKSPACE, "programs/token_locker/src/lib.rs");
    const fileExistsFn = (p: string) => path.resolve(p) === existingFile;

    const output = await generateStage({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      plan: samplePlan,
      fileExists: fileExistsFn,
      allowOverwrite: true,
    });

    expect(output.files[0].content).toBe("// overwrite confirmed");
  });

  it("rejects when generated programName does not match plan programName", async () => {
    const mismatchedGeneration = {
      type: "full_program",
      programName: "different_program",
      description: "Mismatched program name",
      files: [
        {
          path: "programs/different_program/src/lib.rs",
          content: "// code",
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(mismatchedGeneration));

    await expect(
      generateStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        plan: samplePlan,
        fileExists: () => false,
      })
    ).rejects.toThrow(/does not match plan programName/);
  });
});
