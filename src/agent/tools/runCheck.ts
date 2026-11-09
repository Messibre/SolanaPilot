/**
 * Tool for running allowlisted build and check processes.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { execFile as nodeExecFile } from "node:child_process";
import { z } from "zod";
import { ToolRefusedError } from "../../core/errors";
import { resolveInWorkspace } from "../../security/pathGuard";
import type { ProcessResult, Tool, ToolProcessRunner } from "./types";

export const defaultProcessRunner: ToolProcessRunner = {
  execFile: (file, args, options) => {
    return new Promise((resolve, reject) => {
      nodeExecFile(
        file,
        args,
        {
          cwd: options.cwd,
          timeout: options.timeout ?? 60_000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (error && typeof (error as Record<string, unknown>).code !== "number") {
            return reject(error);
          }
          const errCode = (error as { code?: unknown })?.code;
          resolve({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: typeof errCode === "number" ? errCode : (error ? 1 : 0),
          });
        }
      );
    });
  },
};

const RunCheckInput = z
  .object({
    command: z.enum(["anchor", "cargo"]),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().max(300_000).default(60_000),
  })
  .strict();

const RunCheckOutput = z.object({
  command: z.string(),
  args: z.array(z.string()),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
});

const VALID_COMMAND_SUMMARY = '"anchor build", "anchor test", "cargo check"';

function validateAllowedCommand(command: "anchor" | "cargo", args: string[]): void {
  const sub = args[0];

  if (command === "anchor") {
    if (sub === "build" || sub === "test") {
      return;
    }
  } else if (command === "cargo") {
    if (sub === "check") {
      return;
    }
  }

  const requested = `${command} ${args.join(" ")}`.trim();
  throw new ToolRefusedError(
    `Disallowed command "${requested}". Valid commands: ${VALID_COMMAND_SUMMARY}.`
  );
}

export const runCheckTool: Tool<z.input<typeof RunCheckInput>, z.infer<typeof RunCheckOutput>> = {
  name: "run_check",
  description: "Run an allowlisted build or check command (anchor build, anchor test, cargo check).",
  input: RunCheckInput,
  output: RunCheckOutput,
  sideEffects: "process",
  execute: async (rawInput, context) => {
    const input = RunCheckInput.parse(rawInput);
    validateAllowedCommand(input.command, input.args);

    let effectiveCwd = context.workspaceRoot;
    if (input.cwd) {
      effectiveCwd = resolveInWorkspace(context.workspaceRoot, input.cwd, "read", {
        realpathSync: context.realpathSync,
      });
    }

    const runner = context.processRunner ?? defaultProcessRunner;
    const result: ProcessResult = await runner.execFile(input.command, input.args, {
      cwd: effectiveCwd,
      timeout: input.timeoutMs,
    });

    return {
      command: input.command,
      args: input.args,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
};
