/**
 * Filesystem tools for SolanaPilot agent: read_file, list_dir, search_text, write_file.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import fsPromises from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ToolRefusedError } from "../../core/errors";
import { resolveInWorkspace } from "../../security/pathGuard";
import type { Tool, ToolFileSystem } from "./types";

export const MAX_READ_BYTES = 200 * 1024; // 200 KB
export const MAX_LIST_ENTRIES = 500;
export const MAX_SEARCH_HITS = 50;
export const MAX_WRITE_BYTES = 1024 * 1024; // 1 MB

export const defaultFs: ToolFileSystem = {
  readFile: (p, enc) => fsPromises.readFile(p, enc),
  writeFile: (p, c, enc) => fsPromises.writeFile(p, c, enc),
  readdir: (p) => fsPromises.readdir(p),
  stat: async (p) => {
    const s = await fsPromises.stat(p);
    return {
      size: s.size,
      isDirectory: () => s.isDirectory(),
      isFile: () => s.isFile(),
    };
  },
  mkdir: async (p, opts) => {
    await fsPromises.mkdir(p, opts);
  },
};

const ReadFileInput = z
  .object({
    path: z.string().min(1, "File path is required"),
  })
  .strict();

const ReadFileOutput = z.object({
  path: z.string(),
  content: z.string(),
  bytes: z.number().int().nonnegative(),
});

export const readFileTool: Tool<z.input<typeof ReadFileInput>, z.infer<typeof ReadFileOutput>> = {
  name: "read_file",
  description: "Read a UTF-8 text file from the workspace (max 200 KB).",
  input: ReadFileInput,
  output: ReadFileOutput,
  sideEffects: "none",
  execute: async (rawInput, context) => {
    const input = ReadFileInput.parse(rawInput);
    const resolved = resolveInWorkspace(context.workspaceRoot, input.path, "read", {
      realpathSync: context.realpathSync,
    });
    const fs = context.fs ?? defaultFs;

    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      throw new ToolRefusedError(
        `Cannot read "${input.path}" because it is a directory. Valid alternative: use "list_dir".`
      );
    }

    if (stat.size > MAX_READ_BYTES) {
      throw new ToolRefusedError(
        `File "${input.path}" size (${stat.size} bytes) exceeds limit of ${MAX_READ_BYTES} bytes (200 KB). Valid alternatives: inspect specific sections or use "search_text".`
      );
    }

    const content = await fs.readFile(resolved, "utf-8");
    return {
      path: input.path,
      content,
      bytes: stat.size,
    };
  },
};

const ListDirInput = z
  .object({
    path: z.string().default("."),
    recursive: z.boolean().default(false),
  })
  .strict();

const ListDirOutput = z.object({
  entries: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      type: z.enum(["file", "directory", "other"]),
      size: z.number().optional(),
    })
  ),
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const listDirTool: Tool<z.input<typeof ListDirInput>, z.infer<typeof ListDirOutput>> = {
  name: "list_dir",
  description: "List entries in a workspace directory (max 500 entries).",
  input: ListDirInput,
  output: ListDirOutput,
  sideEffects: "none",
  execute: async (rawInput, context) => {
    const input = ListDirInput.parse(rawInput);
    const resolvedRoot = resolveInWorkspace(context.workspaceRoot, input.path, "read", {
      realpathSync: context.realpathSync,
    });
    const fs = context.fs ?? defaultFs;

    const rootStat = await fs.stat(resolvedRoot);
    if (!rootStat.isDirectory()) {
      throw new ToolRefusedError(
        `Cannot list "${input.path}" because it is not a directory. Valid alternative: use "read_file".`
      );
    }

    const results: Array<{
      name: string;
      path: string;
      type: "file" | "directory" | "other";
      size?: number;
    }> = [];

    let truncated = false;
    const queue = [resolvedRoot];

    while (queue.length > 0 && results.length < MAX_LIST_ENTRIES) {
      const currentDir = queue.shift()!;
      let rawEntries: string[];
      try {
        rawEntries = await fs.readdir(currentDir);
      } catch {
        continue;
      }

      for (const entryName of rawEntries) {
        if (results.length >= MAX_LIST_ENTRIES) {
          truncated = true;
          break;
        }

        // Skip ignored and VCS directories
        const lower = entryName.toLowerCase();
        if (lower === ".git" || lower === "node_modules") {
          continue;
        }

        const fullEntryPath = path.join(currentDir, entryName);
        let entryType: "file" | "directory" | "other" = "other";
        let entrySize: number | undefined;

        try {
          const stat = await fs.stat(fullEntryPath);
          if (stat.isDirectory()) {
            entryType = "directory";
            if (input.recursive) {
              queue.push(fullEntryPath);
            }
          } else if (stat.isFile()) {
            entryType = "file";
            entrySize = stat.size;
          }
        } catch {
          // Unreadable file/stat, skip
          continue;
        }

        const relativeToWorkspace = path.relative(context.workspaceRoot, fullEntryPath).replace(/\\/g, "/");

        results.push({
          name: entryName,
          path: relativeToWorkspace,
          type: entryType,
          size: entrySize,
        });
      }
    }

    if (results.length >= MAX_LIST_ENTRIES) {
      truncated = true;
    }

    return {
      entries: results,
      total: results.length,
      truncated,
    };
  },
};

const SearchTextInput = z
  .object({
    query: z.string().min(1, "Search query is required"),
    path: z.string().default("."),
    maxHits: z.number().int().positive().max(MAX_SEARCH_HITS).default(MAX_SEARCH_HITS),
  })
  .strict();

const SearchTextOutput = z.object({
  hits: z.array(
    z.object({
      file: z.string(),
      line: z.number().int().positive(),
      text: z.string(),
    })
  ),
  totalHits: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const searchTextTool: Tool<z.input<typeof SearchTextInput>, z.infer<typeof SearchTextOutput>> = {
  name: "search_text",
  description: "Search for text across workspace files (max 50 hits).",
  input: SearchTextInput,
  output: SearchTextOutput,
  sideEffects: "none",
  execute: async (rawInput, context) => {
    const input = SearchTextInput.parse(rawInput);
    const resolvedRoot = resolveInWorkspace(context.workspaceRoot, input.path, "read", {
      realpathSync: context.realpathSync,
    });
    const fs = context.fs ?? defaultFs;

    const hits: Array<{ file: string; line: number; text: string }> = [];
    let truncated = false;
    const queue = [resolvedRoot];

    while (queue.length > 0 && hits.length < input.maxHits) {
      const currentDir = queue.shift()!;
      let rawEntries: string[];
      try {
        rawEntries = await fs.readdir(currentDir);
      } catch {
        continue;
      }

      for (const entryName of rawEntries) {
        if (hits.length >= input.maxHits) {
          truncated = true;
          break;
        }

        const lower = entryName.toLowerCase();
        if (lower === ".git" || lower === "node_modules" || lower === ".next" || lower === "target") {
          continue;
        }

        const fullEntryPath = path.join(currentDir, entryName);
        try {
          const stat = await fs.stat(fullEntryPath);
          if (stat.isDirectory()) {
            queue.push(fullEntryPath);
          } else if (stat.isFile()) {
            if (stat.size > MAX_READ_BYTES) {
              continue; // Skip oversized files for search
            }
            const content = await fs.readFile(fullEntryPath, "utf-8");
            const relPath = path.relative(context.workspaceRoot, fullEntryPath).replace(/\\/g, "/");
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
              if (hits.length >= input.maxHits) {
                truncated = true;
                break;
              }
              const line = lines[i];
              if (line.includes(input.query)) {
                hits.push({
                  file: relPath,
                  line: i + 1,
                  text: line.trim(),
                });
              }
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (hits.length >= input.maxHits) {
      truncated = true;
    }

    return {
      hits,
      totalHits: hits.length,
      truncated,
    };
  },
};

const WriteFileInput = z
  .object({
    path: z.string().min(1, "File path is required"),
    content: z.string(),
    stageOnly: z.boolean().default(false),
  })
  .strict();

const WriteFileOutput = z.object({
  path: z.string(),
  bytesWritten: z.number().int().nonnegative(),
  staged: z.boolean(),
});

export const writeFileTool: Tool<z.input<typeof WriteFileInput>, z.infer<typeof WriteFileOutput>> = {
  name: "write_file",
  description: "Write or overwrite a UTF-8 text file in the workspace (path-guarded, staged).",
  input: WriteFileInput,
  output: WriteFileOutput,
  sideEffects: "workspace-write",
  execute: async (rawInput, context) => {
    const input = WriteFileInput.parse(rawInput);
    const resolved = resolveInWorkspace(context.workspaceRoot, input.path, "write", {
      realpathSync: context.realpathSync,
    });
    const fs = context.fs ?? defaultFs;

    const byteLen = Buffer.byteLength(input.content, "utf-8");
    if (byteLen > MAX_WRITE_BYTES) {
      throw new ToolRefusedError(
        `Content size (${byteLen} bytes) exceeds maximum allowed write limit of ${MAX_WRITE_BYTES} bytes (1 MB). Valid alternatives: break write into smaller files.`
      );
    }

    const targetPath = input.stageOnly ? `${resolved}.staged` : resolved;
    const parentDir = path.dirname(targetPath);

    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(targetPath, input.content, "utf-8");

    return {
      path: input.path,
      bytesWritten: byteLen,
      staged: input.stageOnly,
    };
  },
};
