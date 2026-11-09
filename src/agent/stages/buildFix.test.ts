/**
 * Unit tests for BUILD and FIX pipeline stages.
 * Tests compiler error parsing, patch application, strategy adaptation, and 3-round cap.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { MockLlmClient } from "../../ai/providers/mock";
import { parseCompilerErrors, computeErrorSignature } from "./build";
import { applyPatch, runBuildAndFixLoop } from "./fix";
import { ToolRefusedError } from "../../core/errors";

const MOCK_WORKSPACE = process.platform === "win32" ? "C:\\mock\\workspace" : "/mock/workspace";

describe("BUILD stage error parser and signature", () => {
  it("parses rustc/anchor structured error blocks", () => {
    const rawOutput = `error[E0425]: cannot find value \`system_program\` in this scope
  --> programs/my_vault/src/lib.rs:14:9
   |
14 |         system_program::transfer(cpi_ctx, amount)?;
   |         ^^^^^^^^^^^^^^ not found in this scope

warning: unused variable: \`authority\`
  --> programs/my_vault/src/lib.rs:20:9

error[E0308]: mismatched types
  --> programs/my_vault/src/lib.rs:25:18
   |
25 |         let x: u64 = "wrong";
   |                ---   ^^^^^^^ expected \`u64\`, found \`&str\`

error: aborting due to 2 previous errors`;

    const errors = parseCompilerErrors(rawOutput);
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe("E0425");
    expect(errors[0].message).toContain("cannot find value");
    expect(errors[0].file).toBe("programs/my_vault/src/lib.rs");
    expect(errors[0].line).toBe(14);
    expect(errors[0].column).toBe(9);

    expect(errors[1].code).toBe("E0308");
    expect(errors[1].message).toContain("mismatched types");

    const sig = computeErrorSignature(errors, rawOutput);
    expect(sig).toContain("[E0425]");
    expect(sig).toContain("SYM"); // normalized value
  });

  it("handles unstructured build failure output", () => {
    const raw = "fatal: cargo binary not found or build failed unexpectedly";
    const errors = parseCompilerErrors(raw);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("cargo binary not found");
  });
});

describe("applyPatch security and functionality", () => {
  it("successfully applies search and replace patch", async () => {
    const memoryFs: Record<string, string> = {
      [path.resolve(MOCK_WORKSPACE, "programs/my_vault/src/lib.rs")]: "let x: u32 = 10;",
    };

    await applyPatch(
      MOCK_WORKSPACE,
      {
        file: "programs/my_vault/src/lib.rs",
        search: "let x: u32 = 10;",
        replace: "let x: u64 = 10;",
      },
      (p) => memoryFs[path.resolve(p)],
      (p, c) => {
        memoryFs[path.resolve(p)] = c;
      }
    );

    expect(memoryFs[path.resolve(MOCK_WORKSPACE, "programs/my_vault/src/lib.rs")]).toBe("let x: u64 = 10;");
  });

  it("refuses patch targeting forbidden file in deny list (e.g. .git/config)", async () => {
    await expect(
      applyPatch(
        MOCK_WORKSPACE,
        {
          file: ".git/config",
          search: "foo",
          replace: "bar",
        },
        () => "foo",
        () => {}
      )
    ).rejects.toThrow(ToolRefusedError);
  });

  it("refuses patch when search pattern is not found", async () => {
    await expect(
      applyPatch(
        MOCK_WORKSPACE,
        {
          file: "programs/my_vault/src/lib.rs",
          search: "non_existent_code_block",
          replace: "new_code",
        },
        () => "actual content here",
        () => {}
      )
    ).rejects.toThrow(/search pattern not found/);
  });
});

describe("BUILD and FIX loop", () => {
  it("returns immediate success receipt when initial build passes (round 0)", async () => {
    const client = new MockLlmClient();

    const receipt = await runBuildAndFixLoop({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      programName: "my_vault",
      runCheck: async () => ({ exitCode: 0, stdout: "Build succeeded", stderr: "" }),
    });

    expect(receipt.terminalState).toBe("success");
    expect(receipt.success).toBe(true);
    expect(receipt.rounds).toBe(0);
    expect(client.calls.length).toBe(0);
  });

  it("succeeds after 1 fix round when patch resolves build error", async () => {
    let buildAttempts = 0;
    const runCheck = async () => {
      buildAttempts++;
      if (buildAttempts === 1) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "error[E0425]: cannot find value `system_program` in this scope\n  --> programs/my_vault/src/lib.rs:10:5",
        };
      }
      return { exitCode: 0, stdout: "Compiling my_vault... Finished", stderr: "" };
    };

    const fixResponse = {
      patches: [
        {
          file: "programs/my_vault/src/lib.rs",
          search: "system_program::transfer",
          replace: "anchor_lang::system_program::transfer",
          explanation: "Add anchor_lang qualifier",
        },
      ],
      strategy: "Add namespace qualification",
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(fixResponse));

    const memoryFs: Record<string, string> = {
      [path.resolve(MOCK_WORKSPACE, "programs/my_vault/src/lib.rs")]: "system_program::transfer(ctx);",
    };

    const receipt = await runBuildAndFixLoop({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      programName: "my_vault",
      runCheck,
      readFile: (p) => memoryFs[path.resolve(p)],
      writeFile: (p, c) => {
        memoryFs[path.resolve(p)] = c;
      },
    });

    expect(receipt.terminalState).toBe("success");
    expect(receipt.success).toBe(true);
    expect(receipt.rounds).toBe(1);
    expect(memoryFs[path.resolve(MOCK_WORKSPACE, "programs/my_vault/src/lib.rs")]).toBe(
      "anchor_lang::system_program::transfer(ctx);"
    );
  });

  it("adapts strategy prompt when same error signature occurs twice and stops at 3rd repetition with cycle_detected", async () => {
    // Build always fails with same error
    const runCheck = async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "error[E0425]: cannot find value `vault` in this scope\n  --> programs/my_vault/src/lib.rs:10:5",
    });

    const fixResponse1 = {
      patches: [
        {
          file: "programs/my_vault/src/lib.rs",
          search: "let x = 1;",
          replace: "let x = 2;",
        },
      ],
      strategy: "Minor edit",
      needsHumanReview: false,
    };

    const fixResponse2 = {
      patches: [
        {
          file: "programs/my_vault/src/lib.rs",
          search: "let x = 2;",
          replace: "let x = 3;",
        },
      ],
      strategy: "Alternative edit",
      needsHumanReview: false,
    };

    // Queue 2 fix responses
    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(fixResponse1))
      .enqueueResponse(JSON.stringify(fixResponse2));

    const memoryFs: Record<string, string> = {
      [path.resolve(MOCK_WORKSPACE, "programs/my_vault/src/lib.rs")]: "let x = 1;",
    };

    const receipt = await runBuildAndFixLoop({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      programName: "my_vault",
      maxRounds: 3,
      runCheck,
      readFile: (p) => memoryFs[path.resolve(p)],
      writeFile: (p, c) => {
        memoryFs[path.resolve(p)] = c;
      },
    });

    // It stopped with cycle_detected because signature repeated 3 times!
    expect(receipt.terminalState).toBe("cycle_detected");
    expect(receipt.success).toBe(false);
    expect(client.calls.length).toBe(2);

    // Call 1 had normal strategy
    expect(client.calls[0].messages[0].content).toContain("STRATEGY DIRECTIVE: Provide targeted");
    // Call 2 had alternative strategy prompt directive!
    expect(client.calls[1].messages[0].content).toContain("STRATEGY DIRECTIVE: ALTERNATIVE STRATEGY REQUIRED");
  });

  it("stops with unrecoverable_tool_error when 3 rounds fail with distinct errors", async () => {
    let callCount = 0;
    const runCheck = async () => {
      callCount++;
      return {
        exitCode: 1,
        stdout: "",
        stderr: `error[E000${callCount}]: distinct error number ${callCount}\n  --> programs/my_vault/src/lib.rs:${callCount}:5`,
      };
    };

    const fixResponse = {
      patches: [
        {
          file: "programs/my_vault/src/lib.rs",
          search: "code",
          replace: "code",
        },
      ],
      strategy: "test",
      needsHumanReview: false,
    };

    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(fixResponse))
      .enqueueResponse(JSON.stringify(fixResponse))
      .enqueueResponse(JSON.stringify(fixResponse));

    const receipt = await runBuildAndFixLoop({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      programName: "my_vault",
      maxRounds: 3,
      runCheck,
      readFile: () => "code",
      writeFile: () => {},
    });

    expect(receipt.terminalState).toBe("unrecoverable_tool_error");
    expect(receipt.success).toBe(false);
    expect(receipt.rounds).toBe(3);
    expect(receipt.history.length).toBe(3);
  });
});
