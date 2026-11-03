import { describe, it, expect, vi } from "vitest";
import { deployStage } from "./deploy";
import { registerStage } from "./register";
import { frontendStage } from "./frontend";
import { MockLlmClient } from "../../ai/providers/mock";
import { SchemaViolationError, ToolCrashedError } from "../../core/errors";
import type { ProcessRunner } from "../../deploy/types";
import type { RegistryClientInterface } from "../../registry/types";

describe("deployStage", () => {
  const dummyRunner: ProcessRunner = async () => ({ stdout: "", stderr: "", exitCode: 0 });

  it("returns confirmed: false when user declines deployment", async () => {
    let deployCalled = false;
    const result = await deployStage({
      workspaceRoot: "/test/workspace",
      runner: dummyRunner,
      confirmDeploy: async () => false,
      onOutput: () => {
        deployCalled = true;
      },
    });

    expect(result.confirmed).toBe(false);
    expect(result.deployResult).toBeUndefined();
    expect(deployCalled).toBe(true);
  });

  it("runs deployment when user confirms", async () => {
    const fakeRunner: ProcessRunner = async (cmd, args) => {
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
        return { stdout: "Build success", stderr: "", exitCode: 0 };
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

    const result = await deployStage({
      workspaceRoot: "/test/workspace",
      runner: fakeRunner,
      confirmDeploy: async () => true,
    });

    expect(result.confirmed).toBe(true);
    expect(result.deployResult?.ok).toBe(true);
    expect(result.deployResult?.programId).toBe("11111111111111111111111111111111");
  });

  it("throws ToolCrashedError when deployment fails", async () => {
    const failingRunner: ProcessRunner = async (cmd, args) => {
      if (cmd === "solana" && args.includes("config") && args.includes("get")) {
        return {
          stdout: "RPC URL: https://api.mainnet-beta.solana.com\nKeypair: /test/id.json",
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    await expect(
      deployStage({
        workspaceRoot: "/test/workspace",
        runner: failingRunner,
        confirmDeploy: async () => true,
      })
    ).rejects.toThrow(ToolCrashedError);
  });
});

describe("registerStage", () => {
  const validPubkey = "11111111111111111111111111111111";

  it("successfully registers program with valid inputs", async () => {
    const mockClient: RegistryClientInterface = {
      registerProgram: vi.fn().mockResolvedValue({
        ok: true,
        txSignature: "tx_mock_123",
        programEntryPda: "pda_mock_123",
      }),
      fetchProgram: vi.fn().mockResolvedValue(null),
      fetchAllPrograms: vi.fn().mockResolvedValue([]),
      logDeployment: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await registerStage({
      client: mockClient,
      programId: validPubkey,
      programName: "my_token_vault",
      description: "A secure vault",
      instructionCount: 3,
    });

    expect(result.ok).toBe(true);
    expect(result.txSignature).toBe("tx_mock_123");
    expect(mockClient.registerProgram).toHaveBeenCalledTimes(1);
  });

  it("throws SchemaViolationError on invalid inputs", async () => {
    const mockClient: RegistryClientInterface = {
      registerProgram: vi.fn(),
      fetchProgram: vi.fn(),
      fetchAllPrograms: vi.fn(),
      logDeployment: vi.fn(),
    };

    await expect(
      registerStage({
        client: mockClient,
        programId: "not-a-pubkey",
        programName: "BadName",
        description: "",
        instructionCount: 0,
      })
    ).rejects.toThrow(SchemaViolationError);
  });

  it("throws ToolCrashedError when registry client reports error", async () => {
    const mockClient: RegistryClientInterface = {
      registerProgram: vi.fn().mockResolvedValue({
        ok: false,
        error: "On-chain transaction simulation failed",
      }),
      fetchProgram: vi.fn(),
      fetchAllPrograms: vi.fn(),
      logDeployment: vi.fn(),
    };

    await expect(
      registerStage({
        client: mockClient,
        programId: validPubkey,
        programName: "vault_prog",
        description: "Valid description",
        instructionCount: 2,
      })
    ).rejects.toThrow(ToolCrashedError);
  });
});

describe("frontendStage", () => {
  it("generates structured frontend files from IDL", async () => {
    const mockClient = new MockLlmClient();
    mockClient.enqueueResponse(
      JSON.stringify({
        type: "frontend",
        files: [
          {
            path: "app/src/App.tsx",
            content: "export default function App() { return <div>Solana App</div>; }",
          },
          {
            path: "app/package.json",
            content: '{"name": "solana-frontend"}',
          },
        ],
        startCommand: "npm run dev",
        needsHumanReview: false,
      })
    );

    const result = await frontendStage({
      client: mockClient,
      idlJson: { version: "0.1.0", name: "my_program" },
      programId: "11111111111111111111111111111111",
    });

    expect(result.type).toBe("frontend");
    expect(result.files.length).toBe(2);
    expect(result.files[0].path).toBe("app/src/App.tsx");
    expect(result.startCommand).toBe("npm run dev");
  });
});
