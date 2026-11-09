/**
 * BUILD Stage: Runs Anchor/Cargo build check and parses compiler errors into structured format.
 * Strictly adheres to Agent.md §6, §8, and §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { defaultProcessRunner } from "../tools/runCheck";

export interface ParsedCompilerError {
  code?: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  snippet?: string;
  raw: string;
}

export interface BuildStageInput {
  workspaceRoot: string;
  runCheck?: (cwd: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface BuildStageResult {
  success: boolean;
  exitCode: number;
  errors: ParsedCompilerError[];
  signature?: string;
  stdout: string;
  stderr: string;
}

/**
 * Parses compiler errors from rustc / cargo / anchor output into a structured list.
 */
export function parseCompilerErrors(rawOutput: string): ParsedCompilerError[] {
  const errors: ParsedCompilerError[] = [];
  const lines = rawOutput.split(/\r?\n/);
  let currentError: Partial<ParsedCompilerError> | null = null;
  const currentRaw: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const errorMatch = line.match(/^error(?:\[([A-Z0-9]+)\])?:?\s+(.*)$/i);

    if (errorMatch && !line.includes("aborting due to") && !line.includes("could not compile")) {
      if (currentError && currentError.message) {
        errors.push({
          code: currentError.code,
          message: currentError.message,
          file: currentError.file,
          line: currentError.line,
          column: currentError.column,
          snippet: currentError.snippet,
          raw: currentRaw.join("\n").trim(),
        });
        currentRaw.length = 0;
      }

      currentError = {
        code: errorMatch[1],
        message: errorMatch[2].trim(),
      };
      currentRaw.push(line);

      // Check next line for location: --> file:line:col
      if (i + 1 < lines.length) {
        const locMatch = lines[i + 1].match(/^\s*-->\s*([^:]+):(\d+):(\d+)/);
        if (locMatch) {
          currentError.file = locMatch[1].trim();
          currentError.line = parseInt(locMatch[2], 10);
          currentError.column = parseInt(locMatch[3], 10);
          currentRaw.push(lines[i + 1]);
          i++;
        }
      }
    } else if (currentError) {
      currentRaw.push(line);
      if (line.includes("|") && !currentError.snippet) {
        currentError.snippet = line.trim();
      }
    }
  }

  if (currentError && currentError.message) {
    errors.push({
      code: currentError.code,
      message: currentError.message,
      file: currentError.file,
      line: currentError.line,
      column: currentError.column,
      snippet: currentError.snippet,
      raw: currentRaw.join("\n").trim(),
    });
  }

  // Fallback if no specific pattern matched but output exists
  if (errors.length === 0 && rawOutput.trim().length > 0) {
    const trimmed = rawOutput.trim();
    errors.push({
      message: trimmed.slice(0, 300),
      raw: trimmed,
    });
  }

  return errors;
}

/**
 * Computes a normalized error signature from parsed compiler errors.
 */
export function computeErrorSignature(errors: ParsedCompilerError[], fallbackText: string): string {
  if (errors.length === 0) {
    return fallbackText
      .slice(0, 200)
      .replace(/\d+/g, "N")
      .replace(/[a-zA-Z0-9_./\\-]+\.(rs|toml)/g, "FILE")
      .trim();
  }
  const primary = errors[0];
  const code = primary.code ? `[${primary.code}] ` : "";
  const cleaned = primary.message
    .replace(/[a-zA-Z0-9_./\\-]+\.(rs|toml)/g, "FILE")
    .replace(/`[^`]+`/g, "SYM")
    .replace(/\b\d+\b/g, "N")
    .trim();
  return `${code}${cleaned}`;
}

/**
 * Executes the BUILD stage.
 */
export async function buildStage(input: BuildStageInput): Promise<BuildStageResult> {
  const runner = input.runCheck ?? (async (cwd: string) => {
    return defaultProcessRunner.execFile("anchor", ["build"], { cwd });
  });

  const res = await runner(input.workspaceRoot);
  const combinedOutput = `${res.stdout}\n${res.stderr}`.trim();

  if (res.exitCode === 0) {
    return {
      success: true,
      exitCode: 0,
      errors: [],
      stdout: res.stdout,
      stderr: res.stderr,
    };
  }

  const errors = parseCompilerErrors(combinedOutput);
  const signature = computeErrorSignature(errors, combinedOutput);

  return {
    success: false,
    exitCode: res.exitCode,
    errors,
    signature,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}
