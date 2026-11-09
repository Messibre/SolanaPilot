import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runPipeline } from "./pipelineRunner";
import { MockLlmClient } from "../../ai/providers/mock";
import type { ProcessRunner } from "../../deploy/types";
import type { RegistryClientInterface } from "../../registry/types";

describe("runPipeline End-to-End", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "solanapilot-pipeline-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const validPlanResponse = JSON.stringify({
    programName: "my_vault",
    description: "A secure vault program",
    accounts: [
      { name: "Vault", description: "Holds funds", isMut: true, isSigner: false },
    ],
    instructions: [
      { name: "initialize", description: "Initializes the vault" },
    ],
    risks: [],
    needsHumanReview: false,
  });

  const validGenerateResponse = JSON.stringify({
    type: "full_program",
    programName: "my_vault",
    description: "A secure vault program",
    files: [
      {
        path: "programs/my_vault/src/lib.rs",
        content: `use anchor_lang::prelude::*;
declare_id!("11111111111111111111111111111111");
#[program]
pub mod my_vault {
    use super::*;
    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Initialize {}
`,
      },
    ],
    needsHumanReview: false,
  });

  const validTestResponse = JSON.stringify({
    testFiles: [
      {
        path: "tests/my_vault.ts",
        content: `import * as anchor from "@coral-xyz/anchor";
describe("my_vault", () => {
  it("initializes", async () => {});
});`,
      },
    ],
    coverage: [
      {
        instructionName: "initialize",
        hasHappyPath: true,
        hasFailurePath: true,
      },
    ],
    needsHumanReview: false,
  });

  const validReviewResponse = JSON.stringify({
    summary: "No vulnerabilities detected in static analysis",
    findings: [],
    needsHumanReview: false,
  });

  const createSuccessfulFakeRunner = (): ProcessRunner => {
    return async (cmd, args) => {
      if (cmd === "cargo" && args.includes("check")) {
        return { stdout: "Finished cargo check", stderr: "", exitCode: 0 };
      }
      if (cmd === "solana" && args.includes("config") && args.includes("get")) {
        return {
          stdout: "RPC URL: https://api.devnet.solana.com\nKeypair: /test/id.json",
          stderr: "",
          exitCode: 0,
        };
      }
      if (cmd === "solana" && args.includes("balance")) {
        return { stdout: "5.0 SOL", stderr: "", exitCode: 0 };
      }
      if (cmd === "anchor" && args.includes("build")) {
        return { stdout: "Anchor build success", stderr: "", exitCode: 0 };
      }
      if (cmd === "anchor" && args.includes("deploy")) {
        return {
          stdout: "Deploy success\nProgram Id: 11111111111111111111111111111111",
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
  };

  const createMockRegistryClient = (): RegistryClientInterface => ({
    registerProgram: vi.fn().mockResolvedValue({
      ok: true,
      txSignature: "mock_tx_signature",
      programEntryPda: "mock_entry_pda",
    }),
    fetchProgram: vi.fn().mockResolvedValue(null),
    fetchAllPrograms: vi.fn().mockResolvedValue([]),
    logDeployment: vi.fn().mockResolvedValue({ ok: true }),
  });

  it("completes full pipeline and reaches DONE when user confirms deploy", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);
    mockClient.enqueueResponse(validTestResponse);
    mockClient.enqueueResponse(validReviewResponse);

    const runner = createSuccessfulFakeRunner();
    const registryClient = createMockRegistryClient();
    const transitions: string[] = [];

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner,
      registryClient,
      confirmDeploy: async () => true,
      onTransition: (st) => transitions.push(st),
    });

    expect(result.ok).toBe(true);
    expect(result.finalStage).toBe("DONE");
    expect(result.deployResult?.ok).toBe(true);
    expect(result.registerResult?.ok).toBe(true);
    expect(registryClient.registerProgram).toHaveBeenCalledTimes(1);

    // Verify transitions sequence
    expect(transitions).toContain("PLAN");
    expect(transitions).toContain("GENERATE");
    expect(transitions).toContain("VALIDATE");
    expect(transitions).toContain("WRITE");
    expect(transitions).toContain("BUILD");
    expect(transitions).toContain("TEST");
    expect(transitions).toContain("REVIEW");
    expect(transitions).toContain("AWAIT_DEPLOY_CONFIRM");
    expect(transitions).toContain("DEPLOY");
    expect(transitions).toContain("REGISTER");
    expect(transitions[transitions.length - 1]).toBe("DONE");
  });

  it("reaches DONE at generation when user declines deploy confirmation", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);
    mockClient.enqueueResponse(validTestResponse);
    mockClient.enqueueResponse(validReviewResponse);

    const runner = createSuccessfulFakeRunner();
    const registryClient = createMockRegistryClient();

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner,
      registryClient,
      confirmDeploy: async () => false,
    });

    expect(result.ok).toBe(true);
    expect(result.finalStage).toBe("DONE");
    expect(result.deployResult).toBeUndefined();
    expect(registryClient.registerProgram).not.toHaveBeenCalled();
  });

  it("reaches FAILED when PLAN stage fails", async () => {
    const mockClient = new MockLlmClient();
    // Enqueue an invalid plan response that fails schema validation
    mockClient.enqueueResponse(JSON.stringify({ not_a_plan: true }));
    mockClient.enqueueResponse(JSON.stringify({ still_not_a_plan: true }));

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      confirmDeploy: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
    expect(result.error).toBeDefined();
  });

  it("reaches FAILED when GENERATE stage fails", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    // Bad response for GENERATE
    mockClient.enqueueResponse(JSON.stringify({ wrong: 1 }));
    mockClient.enqueueResponse(JSON.stringify({ wrong: 2 }));

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      confirmDeploy: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
  });

  it("reaches FAILED when BUILD/FIX stage exhausts fix attempts", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);

    // Enqueue 4 mock fix patches
    for (let i = 0; i < 4; i++) {
      mockClient.enqueueResponse(
        JSON.stringify({
          patches: [
            {
              file: "programs/my_vault/src/lib.rs",
              search: "use anchor_lang::prelude::*;",
              replace: "use anchor_lang::prelude::*; // patch",
            },
          ],
          needsHumanReview: false,
        })
      );
    }

    // Runner that always fails cargo check
    const failingRunner: ProcessRunner = async () => ({
      stdout: "",
      stderr: "error[E0425]: cannot find value `foo` in this scope --> programs/my_vault/src/lib.rs:10:5",
      exitCode: 1,
    });

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner: failingRunner,
      confirmDeploy: async () => true,
      maxFixes: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
    expect(result.error).toContain("Build failed and fix cycles exceeded");
  });

  it("reaches FAILED when TEST stage fails", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);
    // Invalid test response
    mockClient.enqueueResponse(JSON.stringify({ wrong: "test" }));
    mockClient.enqueueResponse(JSON.stringify({ wrong: "test2" }));

    const runner = createSuccessfulFakeRunner();

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner,
      confirmDeploy: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
  });

  it("reaches FAILED when REVIEW stage fails", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);
    mockClient.enqueueResponse(validTestResponse);
    // Invalid review response
    mockClient.enqueueResponse(JSON.stringify({ bad: "review" }));
    mockClient.enqueueResponse(JSON.stringify({ bad: "review2" }));

    const runner = createSuccessfulFakeRunner();

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner,
      confirmDeploy: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
  });

  it("reaches FAILED when DEPLOY stage fails", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);
    mockClient.enqueueResponse(validTestResponse);
    mockClient.enqueueResponse(validReviewResponse);

    // Runner where deploy fails (mainnet refused)
    const failingDeployRunner: ProcessRunner = async (cmd, args) => {
      if (cmd === "cargo" && args.includes("check")) {
        return { stdout: "Finished cargo check", stderr: "", exitCode: 0 };
      }
      if (cmd === "solana" && args.includes("config") && args.includes("get")) {
        return {
          stdout: "RPC URL: https://api.mainnet-beta.solana.com\nKeypair: /test/id.json",
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner: failingDeployRunner,
      confirmDeploy: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
    expect(result.error).toContain("mainnet");
  });

  it("reaches FAILED when REGISTER stage fails", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(validPlanResponse);
    mockClient.enqueueResponse(validGenerateResponse);
    mockClient.enqueueResponse(validTestResponse);
    mockClient.enqueueResponse(validReviewResponse);

    const runner = createSuccessfulFakeRunner();
    const failingRegistryClient: RegistryClientInterface = {
      registerProgram: vi.fn().mockResolvedValue({
        ok: false,
        error: "Registry transaction reverted on-chain",
      }),
      fetchProgram: vi.fn(),
      fetchAllPrograms: vi.fn(),
      logDeployment: vi.fn(),
    };

    const result = await runPipeline({
      workspaceRoot: tempDir,
      client: mockClient,
      userPrompt: "Create a vault program",
      runner,
      registryClient: failingRegistryClient,
      confirmDeploy: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.finalStage).toBe("FAILED");
    expect(result.error).toContain("Registry transaction reverted");
  });
});
