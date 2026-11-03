/**
 * Types and interfaces for the SolanaPilot agent tool system.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { z } from "zod";

export type ToolSideEffect = "none" | "workspace-write" | "process" | "network";

export interface ToolFileSystem {
  readFile(filePath: string, encoding: "utf-8"): Promise<string>;
  writeFile(filePath: string, content: string, encoding: "utf-8"): Promise<void>;
  readdir(dirPath: string): Promise<string[]>;
  stat(itemPath: string): Promise<{ size: number; isDirectory(): boolean; isFile(): boolean }>;
  mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ToolProcessRunner {
  execFile(file: string, args: string[], options: { cwd: string; timeout?: number }): Promise<ProcessResult>;
}

export interface ToolContext {
  workspaceRoot: string;
  fs?: ToolFileSystem;
  processRunner?: ToolProcessRunner;
  fetchFn?: typeof fetch;
  dnsResolver?: (hostname: string) => Promise<string[]>;
  realpathSync?: (p: string) => string;
}

export interface Tool<TIn = unknown, TOut = unknown> {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<unknown, z.ZodTypeDef, unknown>;
  readonly output: z.ZodType<TOut, z.ZodTypeDef, unknown>;
  readonly sideEffects: ToolSideEffect;
  execute(input: TIn, context: ToolContext): Promise<TOut>;
}
