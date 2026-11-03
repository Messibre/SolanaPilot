/**
 * Unit tests for the Solana devnet deployment runner and devnet guard.
 * Tests fake process runner scenarios: devnet ok, mainnet refused, airdrop fail path, build fail path, Windows path with spaces.
 */

import { describe, it, expect } from "vitest";
import { runDeploy } from "./deployRunner";
import { assertDevnetRpcUrl } from "./devnetGuard";
import type { ProcessRunner, ProcessResult } from "./types";
import { ToolRefusedError } from "../core/errors";

describe("devnetGuard - assertDevnetRpcUrl", () => {
  it("allows devnet and localhost URLs", () => {
    expect(() => assertDevnetRpcUrl("https://api.devnet.solana.com")).not.toThrow();
    expect(() => assertDevnetRpcUrl("http://127.0.0.1:8899")).not.toThrow();
    expect(() => assertDevnetRpcUrl("http://localhost:8899")).not.toThrow();
    expect(() => assertDevnetRpcUrl("https://api.testnet.solana.com")).not.toThrow();
  });

  it("strictly rejects mainnet URLs", () => {
    expect(() => assertDevnetRpcUrl("https://api.mainnet-beta.solana.com")).toThrow(ToolRefusedError);
    expect(() => assertDevnetRpcUrl("https://solana-mainnet.g.alchemy.com/v2/xyz")).toThrow(ToolRefusedError);
    expect(() => assertDevnetRpcUrl("https://mainnet.helius-rpc.com/?api-key=123")).toThrow(ToolRefusedError);
  });

  it("rejects non-devnet external URLs", () => {
    expect(() => assertDevnetRpcUrl("https://custom-node.example.com")).toThrow(ToolRefusedError);
  });
});

describe("deployRunner - runDeploy", () => {
  it("succeeds on devnet happy path (devnet ok)", async () => {
    const executedCalls: Array<{ file: string; args: string[]; cwd?: string }> = [];

    const fakeRunner: ProcessRunner = async (file, args, options): Promise<ProcessResult> => {
      executedCalls.push({ file, args, cwd: options.cwd });

      if (file === "solana" && args[0] === "config" && args[1] === "get") {
        return {
          exitCode: 0,
          stdout: "Config File: ...\nRPC URL: https://api.devnet.solana.com\nWebSocket URL: ...",
          stderr: "",
        };
      }
      if (file === "solana" && args[0] === "balance") {
        return { exitCode: 0, stdout: "5.5 SOL", stderr: "" };
      }
      if (file === "anchor" && args[0] === "build") {
        return { exitCode: 0, stdout: "Anchor build completed", stderr: "" };
      }
      if (file === "anchor" && args[0] === "deploy") {
        return {
          exitCode: 0,
          stdout: "Deploying cluster: https://api.devnet.solana.com\nProgram Id: 4Nd1mBQtrMJVYVfKf2PJy9NZzqD3ChLQ8rGoUibpmwaZ\nSignature: 5VERv8NMvzbJMEdV8xazVUieY2AW5y5HziSrq7UVspDvpDJaGHSrxLjnK87HGqYv62ag",
          stderr: "",
        };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await runDeploy({
      workspaceRoot: "/workspace/my_vault",
      runner: fakeRunner,
    });

    expect(result.ok).toBe(true);
    expect(result.step).toBe("deploy");
    expect(result.programId).toBe("4Nd1mBQtrMJVYVfKf2PJy9NZzqD3ChLQ8rGoUibpmwaZ");
    expect(result.signature).toBeDefined();

    // Verify correct command execution order and absence of shell joining
    expect(executedCalls.map((c) => `${c.file} ${c.args.join(" ")}`)).toEqual([
      "solana config get",
      "solana balance",
      "anchor build",
      "anchor deploy",
    ]);
  });

  it("strictly refuses execution when RPC URL targets mainnet (mainnet refused)", async () => {
    const executedCalls: Array<{ file: string; args: string[] }> = [];

    const fakeRunner: ProcessRunner = async (file, args): Promise<ProcessResult> => {
      executedCalls.push({ file, args });
      if (file === "solana" && args[0] === "config" && args[1] === "get") {
        return {
          exitCode: 0,
          stdout: "RPC URL: https://api.mainnet-beta.solana.com",
          stderr: "",
        };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await runDeploy({
      workspaceRoot: "/workspace/my_vault",
      runner: fakeRunner,
    });

    expect(result.ok).toBe(false);
    expect(result.step).toBe("config_check");
    expect(result.error).toContain("Mainnet target is strictly prohibited");

    // Must NEVER execute balance, airdrop, build, or deploy on mainnet!
    expect(executedCalls.length).toBe(1);
    expect(executedCalls[0].args).toEqual(["config", "get"]);
  });

  it("handles airdrop failure when balance is low and retries fail (airdrop fail path)", async () => {
    const executedCalls: Array<{ file: string; args: string[] }> = [];

    const fakeRunner: ProcessRunner = async (file, args): Promise<ProcessResult> => {
      executedCalls.push({ file, args });

      if (file === "solana" && args[0] === "config") {
        return { exitCode: 0, stdout: "RPC URL: https://api.devnet.solana.com", stderr: "" };
      }
      if (file === "solana" && args[0] === "balance") {
        return { exitCode: 0, stdout: "0.1 SOL", stderr: "" }; // Low balance triggers airdrop
      }
      if (file === "solana" && args[0] === "airdrop") {
        return { exitCode: 1, stdout: "", stderr: "Error: 429 Too Many Requests (rate limited)" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await runDeploy({
      workspaceRoot: "/workspace/my_vault",
      runner: fakeRunner,
      maxAirdropRetries: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.step).toBe("airdrop");
    expect(result.error).toContain("Airdrop failed after 3 attempts");

    // Build and deploy must NOT be invoked when airdrop fails
    expect(executedCalls.some((c) => c.file === "anchor")).toBe(false);
  });

  it("stops and reports error when build fails (build fail path)", async () => {
    const executedCalls: Array<{ file: string; args: string[] }> = [];

    const fakeRunner: ProcessRunner = async (file, args): Promise<ProcessResult> => {
      executedCalls.push({ file, args });

      if (file === "solana" && args[0] === "config") {
        return { exitCode: 0, stdout: "RPC URL: https://api.devnet.solana.com", stderr: "" };
      }
      if (file === "solana" && args[0] === "balance") {
        return { exitCode: 0, stdout: "10.0 SOL", stderr: "" };
      }
      if (file === "anchor" && args[0] === "build") {
        return { exitCode: 1, stdout: "", stderr: "error[E0425]: cannot find value `foo` in this scope" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await runDeploy({
      workspaceRoot: "/workspace/my_vault",
      runner: fakeRunner,
    });

    expect(result.ok).toBe(false);
    expect(result.step).toBe("build");
    expect(result.error).toContain("cannot find value `foo`");

    // Deploy must NOT be called when build fails
    expect(executedCalls.some((c) => c.args[0] === "deploy")).toBe(false);
  });

  it("handles Windows paths with spaces cleanly without shell quoting errors", async () => {
    const windowsPath = "C:\\Users\\John Doe\\Workspace With Spaces\\my vault";
    const cwdRecords: string[] = [];

    const fakeRunner: ProcessRunner = async (file, args, options): Promise<ProcessResult> => {
      if (options.cwd) {
        cwdRecords.push(options.cwd);
      }
      if (file === "solana" && args[0] === "config") {
        return { exitCode: 0, stdout: "RPC URL: http://localhost:8899", stderr: "" };
      }
      if (file === "solana" && args[0] === "balance") {
        return { exitCode: 0, stdout: "20.0 SOL", stderr: "" };
      }
      if (file === "anchor" && args[0] === "build") {
        return { exitCode: 0, stdout: "Build finished", stderr: "" };
      }
      if (file === "anchor" && args[0] === "deploy") {
        return {
          exitCode: 0,
          stdout: "Program Id: 11111111111111111111111111111111",
          stderr: "",
        };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await runDeploy({
      workspaceRoot: windowsPath,
      runner: fakeRunner,
    });

    expect(result.ok).toBe(true);
    expect(result.step).toBe("deploy");
    expect(result.programId).toBe("11111111111111111111111111111111");

    // Every command received the exact uncorrupted Windows path with spaces
    expect(cwdRecords.length).toBe(4);
    for (const cwd of cwdRecords) {
      expect(cwd).toBe(windowsPath);
    }
  });
});
