/**
 * Unit tests for agent loop orchestrator.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockLlmClient } from "../ai/providers/mock";
import { runAgentLoop } from "./loop";
import { ToolRegistry } from "./tools/registry";
import type { Tool, ToolFileSystem } from "./tools/types";

const MOCK_WORKSPACE = "G:/codes/dev3pack/SolanaPilot/mock-workspace";

function createTestFs(): ToolFileSystem {
  const files = new Map<string, string>([
    [`${MOCK_WORKSPACE}/src/lib.rs`, "pub fn init() {}"],
    [`${MOCK_WORKSPACE}/src/state.rs`, "pub struct State {}"],
  ]);
  return {
    readFile: async (p) => files.get(p.replace(/\\/g, "/")) ?? "",
    writeFile: async (p, c) => {
      files.set(p.replace(/\\/g, "/"), c);
    },
    readdir: async () => ["src/lib.rs", "src/state.rs"],
    stat: async (p) => ({
      size: files.has(p.replace(/\\/g, "/")) ? 50 : 0,
      isDirectory: () => false,
      isFile: () => true,
    }),
    mkdir: async () => {},
  };
}

function createTestRegistry(options?: { throwOnTool?: boolean }): ToolRegistry {
  const registry = new ToolRegistry();

  const readFileTool: Tool<{ path: string }, { content: string }> = {
    name: "read_file",
    description: "Read file",
    input: z.object({ path: z.string() }).strict(),
    output: z.object({ content: z.string() }),
    sideEffects: "none",
    execute: async (input, ctx) => {
      if (options?.throwOnTool) {
        throw new Error("Simulated tool crash in execute");
      }
      const fs = ctx.fs;
      const content = fs ? await fs.readFile(input.path, "utf-8") : "default content";
      return { content };
    },
  };

  const writeFileTool: Tool<{ path: string; content: string }, { bytes: number }> = {
    name: "write_file",
    description: "Write file",
    input: z.object({ path: z.string(), content: z.string() }).strict(),
    output: z.object({ bytes: z.number() }),
    sideEffects: "workspace-write",
    execute: async (input, ctx) => {
      if (options?.throwOnTool) {
        throw new Error("Simulated tool crash in execute");
      }
      const fs = ctx.fs;
      if (fs) {
        await fs.writeFile(input.path, input.content, "utf-8");
      }
      return { bytes: input.content.length };
    },
  };

  registry.register(readFileTool);
  registry.register(writeFileTool);
  return registry;
}

describe("Agent Loop - Terminal States", () => {
  it("terminates with 'success' when model finishes and success condition passes", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "I will read lib.rs",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/lib.rs" },
      }),
    });
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Everything looks good",
        action: "finish",
        finishSummary: "Reviewed program successfully",
      }),
    });

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Review the program",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      toolContext: { fs: createTestFs() },
    });

    expect(receipt.terminalState).toBe("success");
    expect(receipt.steps).toBe(2);
    expect(receipt.toolNames).toEqual(["read_file"]);
    expect(receipt.history).toHaveLength(1);
    expect(receipt.history[0].toolName).toBe("read_file");
    expect(receipt.successConditionMet).toBe(true);
    expect(receipt.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("terminates with 'budget_exhausted' when step budget is reached", async () => {
    const mock = new MockLlmClient();
    // Continuous unique tool calls
    for (let i = 0; i < 5; i++) {
      mock.enqueueResponse({
        text: JSON.stringify({
          thought: `Step ${i}`,
          action: "call_tool",
          toolName: "read_file",
          toolArgs: { path: `src/step_${i}.rs` },
        }),
      });
    }

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Inspect many files",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      budgetOptions: { maxSteps: 2 },
      toolContext: { fs: createTestFs() },
    });

    expect(receipt.terminalState).toBe("budget_exhausted");
    expect(receipt.reason).toContain("Step budget exhausted");
  });

  it("terminates with 'cycle_detected' on duplicate consecutive tool call", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Read lib",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/lib.rs" },
      }),
    });
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Read lib again identically",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/lib.rs" },
      }),
    });

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Check files",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      toolContext: { fs: createTestFs() },
    });

    expect(receipt.terminalState).toBe("cycle_detected");
    expect(receipt.reason).toContain("Duplicate tool call detected");
  });

  it("terminates with 'cycle_detected' on oscillation sequence (A, B, A, B)", async () => {
    const mock = new MockLlmClient();
    // A
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Call A",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/a.rs" },
      }),
    });
    // B
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Call B",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/b.rs" },
      }),
    });
    // A
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Call A again",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/a.rs" },
      }),
    });
    // B
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Call B again",
        action: "call_tool",
        toolName: "read_file",
        toolArgs: { path: "src/b.rs" },
      }),
    });

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Check oscillation",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      toolContext: { fs: createTestFs() },
    });

    expect(receipt.terminalState).toBe("cycle_detected");
    expect(receipt.reason).toContain("Oscillation detected");
  });

  it("terminates with 'unrecoverable_tool_error' after consecutive tool crashes", async () => {
    const mock = new MockLlmClient();
    for (let i = 0; i < 3; i++) {
      mock.enqueueResponse({
        text: JSON.stringify({
          thought: `Attempt ${i}`,
          action: "call_tool",
          toolName: "read_file",
          toolArgs: { path: `crash_${i}.rs` },
        }),
      });
    }

    const registry = createTestRegistry({ throwOnTool: true });
    const receipt = await runAgentLoop({
      task: "Try crashed tool",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      maxConsecutiveToolCrashes: 3,
      toolContext: { fs: createTestFs() },
    });

    expect(receipt.terminalState).toBe("unrecoverable_tool_error");
    expect(receipt.reason).toContain("crashed 3 times consecutively");
    expect(receipt.history).toHaveLength(3);
    expect(receipt.history.every((h) => h.status === "crashed")).toBe(true);
  });

  it("terminates with 'refused' when model declares refusal", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Cannot fulfill malicious request",
        action: "refuse",
        refusalReason: "Safety policy prevents creating exploit program",
      }),
    });

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Write an exploit",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
    });

    expect(receipt.terminalState).toBe("refused");
    expect(receipt.reason).toBe("Safety policy prevents creating exploit program");
  });

  it("terminates with 'cancelled' when AbortSignal triggers", async () => {
    const controller = new AbortController();
    controller.abort();

    const mock = new MockLlmClient();
    const registry = createTestRegistry();

    const receipt = await runAgentLoop({
      task: "Cancelled task",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      signal: controller.signal,
    });

    expect(receipt.terminalState).toBe("cancelled");
    expect(receipt.reason).toContain("cancelled");
  });
});

describe("Agent Loop - Invariants & Edge Cases", () => {
  it("prevents model saying 'done' without meeting success condition", async () => {
    const mock = new MockLlmClient();
    // 1. Model prematurely says done
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Done already!",
        action: "finish",
        finishSummary: "Premature finish",
      }),
    });
    // 2. Model takes actual required action
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Okay, I will write the file",
        action: "call_tool",
        toolName: "write_file",
        toolArgs: { path: "src/new.rs", content: "hello" },
      }),
    });
    // 3. Model says finish now that condition is satisfied
    mock.enqueueResponse({
      text: JSON.stringify({
        thought: "Finished for real",
        action: "finish",
        finishSummary: "Wrote the file and completed",
      }),
    });

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Write the file",
      workspaceRoot: MOCK_WORKSPACE,
      client: mock,
      toolRegistry: registry,
      toolContext: { fs: createTestFs() },
      successCondition: (state) => state.history.some((h) => h.toolName === "write_file"),
    });

    expect(receipt.terminalState).toBe("success");
    expect(receipt.steps).toBe(3);
    expect(receipt.successConditionMet).toBe(true);
  });

  it("always returns a valid receipt even under fatal fault injection", async () => {
    const faultClient = {
      id: "mock" as const,
      model: "fault-model",
      generate: async () => {
        throw new Error("FATAL_UNEXPECTED_CLIENT_EXPLOSION");
      },
      healthCheck: async () => {},
    };

    const registry = createTestRegistry();
    const receipt = await runAgentLoop({
      task: "Fault injection test",
      workspaceRoot: MOCK_WORKSPACE,
      client: faultClient,
      toolRegistry: registry,
    });

    expect(receipt).toBeDefined();
    expect(receipt.terminalState).toBe("unrecoverable_tool_error");
    expect(receipt.reason).toContain("FATAL_UNEXPECTED_CLIENT_EXPLOSION");
    expect(typeof receipt.totalDurationMs).toBe("number");
    expect(Array.isArray(receipt.toolNames)).toBe(true);
    expect(Array.isArray(receipt.history)).toBe(true);
  });
});

