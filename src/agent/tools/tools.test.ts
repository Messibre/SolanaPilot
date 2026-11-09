/**
 * Unit tests for SolanaPilot Agent Tools.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolCrashedError, ToolRefusedError } from "../../core/errors";
import {
  createDefaultToolRegistry,
  fetchDocsTool,
  listDirTool,
  MAX_DOCS_BYTES,
  MAX_LIST_ENTRIES,
  MAX_READ_BYTES,
  MAX_SEARCH_HITS,
  MAX_WRITE_BYTES,
  readFileTool,
  runCheckTool,
  searchTextTool,
  writeFileTool,
} from "./index";
import { ToolRegistry } from "./registry";
import type { ProcessResult, ToolContext, ToolFileSystem } from "./types";

const MOCK_WORKSPACE = "G:/codes/dev3pack/SolanaPilot/mock-workspace";

function createFakeFs(options?: {
  files?: Record<string, string>;
  dirs?: string[];
  throwOnWrite?: boolean;
}): ToolFileSystem {
  const files = new Map<string, string>(Object.entries(options?.files ?? {}));
  const dirs = new Set<string>(options?.dirs ?? []);
  const throwOnWrite = options?.throwOnWrite ?? false;

  return {
    readFile: async (filePath: string) => {
      const normalized = filePath.replace(/\\/g, "/");
      const content = files.get(normalized);
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      return content;
    },
    writeFile: async (filePath: string, content: string) => {
      if (throwOnWrite) {
        throw new Error("MUTATION_PROHIBITED: read-only filesystem violated by write");
      }
      files.set(filePath.replace(/\\/g, "/"), content);
    },
    readdir: async (dirPath: string) => {
      const normDir = dirPath.replace(/\\/g, "/").replace(/\/$/, "");
      const entries = new Set<string>();

      for (const f of files.keys()) {
        if (f.startsWith(normDir + "/")) {
          const rest = f.slice(normDir.length + 1);
          const firstPart = rest.split("/")[0];
          entries.add(firstPart);
        }
      }
      for (const d of dirs) {
        if (d.startsWith(normDir + "/") && d !== normDir) {
          const rest = d.slice(normDir.length + 1);
          const firstPart = rest.split("/")[0];
          entries.add(firstPart);
        }
      }
      return Array.from(entries);
    },
    stat: async (itemPath: string) => {
      const normalized = itemPath.replace(/\\/g, "/");
      if (files.has(normalized)) {
        const content = files.get(normalized)!;
        return {
          size: Buffer.byteLength(content, "utf-8"),
          isDirectory: () => false,
          isFile: () => true,
        };
      }
      if (dirs.has(normalized) || normalized === MOCK_WORKSPACE) {
        return {
          size: 0,
          isDirectory: () => true,
          isFile: () => false,
        };
      }
      throw new Error(`ENOENT: stat failed '${itemPath}'`);
    },
    mkdir: async (dirPath: string) => {
      if (throwOnWrite) {
        throw new Error("MUTATION_PROHIBITED: read-only filesystem violated by mkdir");
      }
      dirs.add(dirPath.replace(/\\/g, "/"));
    },
  };
}

describe("Agent Tool Registry & Declarations", () => {
  it("declares correct sideEffects for every core tool", () => {
    expect(readFileTool.sideEffects).toBe("none");
    expect(listDirTool.sideEffects).toBe("none");
    expect(searchTextTool.sideEffects).toBe("none");
    expect(writeFileTool.sideEffects).toBe("workspace-write");
    expect(runCheckTool.sideEffects).toBe("process");
    expect(fetchDocsTool.sideEffects).toBe("network");
  });

  it("registers all core tools in default registry", () => {
    const registry = createDefaultToolRegistry();
    const names = registry.getNames();
    expect(names).toContain("read_file");
    expect(names).toContain("list_dir");
    expect(names).toContain("search_text");
    expect(names).toContain("write_file");
    expect(names).toContain("run_check");
    expect(names).toContain("fetch_docs");
  });

  it("throws ToolRefusedError when executing unknown tool and lists valid tools", async () => {
    const registry = createDefaultToolRegistry();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };

    await expect(registry.execute("non_existent_tool", {}, ctx)).rejects.toThrow(ToolRefusedError);
    await expect(registry.execute("non_existent_tool", {}, ctx)).rejects.toThrow(
      /Unknown tool "non_existent_tool"\. Valid tools: fetch_docs, list_dir, read_file, run_check, search_text, write_file/
    );
  });

  it("throws ToolRefusedError with valid parameter alternatives on unknown params", async () => {
    const registry = createDefaultToolRegistry();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };

    await expect(
      registry.execute("read_file", { path: "src/lib.rs", unknownKey: 123 }, ctx)
    ).rejects.toThrow(ToolRefusedError);

    await expect(
      registry.execute("read_file", { path: "src/lib.rs", unknownKey: 123 }, ctx)
    ).rejects.toThrow(/Valid parameters: \[path\]/);

    await expect(
      registry.execute("list_dir", { path: "src", unknownParam: true }, ctx)
    ).rejects.toThrow(/Valid parameters: \[path, recursive\]/);

    await expect(
      registry.execute("search_text", { query: "foo", unknownField: "bar" }, ctx)
    ).rejects.toThrow(/Valid parameters: \[query, path, maxHits\]/);

    await expect(
      registry.execute("write_file", { path: "a.rs", content: "x", extra: 1 }, ctx)
    ).rejects.toThrow(/Valid parameters: \[path, content, stageOnly\]/);

    await expect(
      registry.execute("run_check", { command: "anchor", args: ["build"], extra: 1 }, ctx)
    ).rejects.toThrow(/Valid parameters: \[command, args, cwd, timeoutMs\]/);

    await expect(
      registry.execute("fetch_docs", { url: "https://solana.com", extra: 1 }, ctx)
    ).rejects.toThrow(/Valid parameters: \[url\]/);
  });

  it("wraps unexpected output schema violations in ToolCrashedError", async () => {
    const registry = new ToolRegistry();
    const badTool = {
      name: "bad_tool",
      description: "tool with broken output",
      input: z.object({}).strict(),
      output: z.object({ expected: z.string() }),
      sideEffects: "none" as const,
      execute: async () => ({ wrong: 123 } as unknown as { expected: string }),
    };
    registry.register(badTool);
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(registry.execute("bad_tool", {}, ctx)).rejects.toThrow(ToolCrashedError);
  });
});

describe("Proof that read-only tools cannot mutate (side-effect test)", () => {
  it("proves read_file, list_dir, search_text execute safely with mutation-throwing fake fs", async () => {
    const fakeFs = createFakeFs({
      files: {
        [`${MOCK_WORKSPACE}/src/lib.rs`]: "pub fn initialize() -> Result<()> { Ok(()) }",
        [`${MOCK_WORKSPACE}/Cargo.toml`]: "[package]\nname = 'program'",
      },
      dirs: [`${MOCK_WORKSPACE}/src`],
      throwOnWrite: true,
    });

    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      fs: fakeFs,
    };

    // 1. read_file should read without triggering mutation
    const readRes = await readFileTool.execute({ path: "src/lib.rs" }, ctx);
    expect(readRes.content).toContain("pub fn initialize");

    // 2. list_dir should list without triggering mutation
    const listRes = await listDirTool.execute({ path: "src", recursive: false }, ctx);
    expect(listRes.entries.length).toBeGreaterThan(0);

    // 3. search_text should search without triggering mutation
    const searchRes = await searchTextTool.execute(
      { path: "src", query: "initialize", maxHits: 10 },
      ctx
    );
    expect(searchRes.hits).toHaveLength(1);

    // 4. write_file against the same fake fs MUST throw mutation prohibited
    await expect(
      writeFileTool.execute({ path: "src/new.rs", content: "code", stageOnly: false }, ctx)
    ).rejects.toThrow(/MUTATION_PROHIBITED/);
  });
});

describe("read_file Tool", () => {
  it("reads file within workspace successfully", async () => {
    const fakeFs = createFakeFs({
      files: {
        [`${MOCK_WORKSPACE}/README.md`]: "# Solana Program",
      },
    });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await readFileTool.execute({ path: "README.md" }, ctx);
    expect(res.content).toBe("# Solana Program");
    expect(res.bytes).toBe(16);
  });

  it("throws ToolRefusedError on path traversal attempt", async () => {
    const fakeFs = createFakeFs();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    await expect(readFileTool.execute({ path: "../../etc/passwd" }, ctx)).rejects.toThrow(
      ToolRefusedError
    );
  });

  it("throws ToolRefusedError when file size exceeds MAX_READ_BYTES (200 KB)", async () => {
    const oversized = "a".repeat(MAX_READ_BYTES + 10);
    const fakeFs = createFakeFs({
      files: {
        [`${MOCK_WORKSPACE}/large.bin`]: oversized,
      },
    });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    await expect(readFileTool.execute({ path: "large.bin" }, ctx)).rejects.toThrow(ToolRefusedError);
    await expect(readFileTool.execute({ path: "large.bin" }, ctx)).rejects.toThrow(/exceeds limit/);
  });

  it("throws ToolRefusedError when target path is a directory", async () => {
    const fakeFs = createFakeFs({
      dirs: [`${MOCK_WORKSPACE}/src`],
    });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    await expect(readFileTool.execute({ path: "src" }, ctx)).rejects.toThrow(ToolRefusedError);
    await expect(readFileTool.execute({ path: "src" }, ctx)).rejects.toThrow(/use "list_dir"/);
  });
});

describe("list_dir Tool", () => {
  it("lists entries within workspace directory", async () => {
    const fakeFs = createFakeFs({
      files: {
        [`${MOCK_WORKSPACE}/file1.txt`]: "hello",
        [`${MOCK_WORKSPACE}/file2.txt`]: "world",
      },
    });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await listDirTool.execute({ path: ".", recursive: false }, ctx);
    expect(res.total).toBe(2);
    expect(res.truncated).toBe(false);
  });

  it("clamps entries to MAX_LIST_ENTRIES (500) and marks truncated", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 550; i++) {
      files[`${MOCK_WORKSPACE}/file_${i}.txt`] = `content_${i}`;
    }
    const fakeFs = createFakeFs({ files });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await listDirTool.execute({ path: ".", recursive: false }, ctx);
    expect(res.entries.length).toBe(MAX_LIST_ENTRIES);
    expect(res.truncated).toBe(true);
  });

  it("throws ToolRefusedError on path traversal attempt", async () => {
    const fakeFs = createFakeFs();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    await expect(listDirTool.execute({ path: "../.." }, ctx)).rejects.toThrow(ToolRefusedError);
  });
});

describe("search_text Tool", () => {
  it("finds matching lines across workspace files", async () => {
    const fakeFs = createFakeFs({
      files: {
        [`${MOCK_WORKSPACE}/src/lib.rs`]: "line 1\nlet pubkey = find_pda();\nline 3",
        [`${MOCK_WORKSPACE}/src/state.rs`]: "pub struct State {}\nlet pubkey = user;",
      },
      dirs: [`${MOCK_WORKSPACE}/src`],
    });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await searchTextTool.execute({ path: "src", query: "pubkey", maxHits: 50 }, ctx);
    expect(res.hits.length).toBe(2);
    expect(res.truncated).toBe(false);
    expect(res.hits[0].file).toBe("src/lib.rs");
    expect(res.hits[0].line).toBe(2);
  });

  it("clamps hits to maxHits (max 50) and marks truncated", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => `match line ${i}`).join("\n");
    const fakeFs = createFakeFs({
      files: {
        [`${MOCK_WORKSPACE}/src/matches.txt`]: lines,
      },
      dirs: [`${MOCK_WORKSPACE}/src`],
    });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await searchTextTool.execute({ path: "src", query: "match line", maxHits: 50 }, ctx);
    expect(res.hits.length).toBe(MAX_SEARCH_HITS);
    expect(res.truncated).toBe(true);
  });

  it("throws ToolRefusedError on path traversal", async () => {
    const fakeFs = createFakeFs();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    await expect(
      searchTextTool.execute({ path: "../../", query: "target", maxHits: 10 }, ctx)
    ).rejects.toThrow(ToolRefusedError);
  });
});

describe("write_file Tool", () => {
  it("writes file successfully with parent directory creation", async () => {
    const fakeFs = createFakeFs({ dirs: [`${MOCK_WORKSPACE}`] });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await writeFileTool.execute(
      { path: "src/new_mod.rs", content: "pub mod new_mod;", stageOnly: false },
      ctx
    );
    expect(res.path).toBe("src/new_mod.rs");
    expect(res.bytesWritten).toBe(16);
    expect(res.staged).toBe(false);

    const readBack = await fakeFs.readFile(`${MOCK_WORKSPACE}/src/new_mod.rs`, "utf-8");
    expect(readBack).toBe("pub mod new_mod;");
  });

  it("supports staging write mode", async () => {
    const fakeFs = createFakeFs({ dirs: [`${MOCK_WORKSPACE}`] });
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const res = await writeFileTool.execute(
      { path: "src/staged.rs", content: "staged content", stageOnly: true },
      ctx
    );
    expect(res.staged).toBe(true);
    const readBack = await fakeFs.readFile(`${MOCK_WORKSPACE}/src/staged.rs.staged`, "utf-8");
    expect(readBack).toBe("staged content");
  });

  it("throws ToolRefusedError on path traversal", async () => {
    const fakeFs = createFakeFs();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    await expect(
      writeFileTool.execute({ path: "../../escape.txt", content: "danger", stageOnly: false }, ctx)
    ).rejects.toThrow(ToolRefusedError);
  });

  it("throws ToolRefusedError when write size exceeds MAX_WRITE_BYTES (1 MB)", async () => {
    const fakeFs = createFakeFs();
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, fs: fakeFs };
    const oversized = "x".repeat(MAX_WRITE_BYTES + 10);
    await expect(
      writeFileTool.execute({ path: "huge.bin", content: oversized, stageOnly: false }, ctx)
    ).rejects.toThrow(ToolRefusedError);
  });
});

describe("run_check Tool", () => {
  it("executes allowlisted 'anchor build' with args array and no shell", async () => {
    let capturedFile = "";
    let capturedArgs: string[] = [];
    const mockRunner = {
      execFile: async (file: string, args: string[]): Promise<ProcessResult> => {
        capturedFile = file;
        capturedArgs = args;
        return { stdout: "Build successful", stderr: "", exitCode: 0 };
      },
    };

    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      processRunner: mockRunner,
    };

    const res = await runCheckTool.execute(
      { command: "anchor", args: ["build", "--verifiable"], timeoutMs: 30000 },
      ctx
    );

    expect(capturedFile).toBe("anchor");
    expect(capturedArgs).toEqual(["build", "--verifiable"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("Build successful");
  });

  it("executes allowlisted 'cargo check'", async () => {
    const mockRunner = {
      execFile: async (): Promise<ProcessResult> => ({
        stdout: "Checking...",
        stderr: "",
        exitCode: 0,
      }),
    };
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, processRunner: mockRunner };
    const res = await runCheckTool.execute({ command: "cargo", args: ["check", "--all-targets"] }, ctx);
    expect(res.exitCode).toBe(0);
  });

  it("executes allowlisted 'anchor test'", async () => {
    const mockRunner = {
      execFile: async (): Promise<ProcessResult> => ({
        stdout: "Running tests",
        stderr: "",
        exitCode: 0,
      }),
    };
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE, processRunner: mockRunner };
    const res = await runCheckTool.execute({ command: "anchor", args: ["test"] }, ctx);
    expect(res.exitCode).toBe(0);
  });

  it("throws ToolRefusedError on non-allowlisted command (e.g. 'cargo run')", async () => {
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(
      runCheckTool.execute({ command: "cargo", args: ["run"] }, ctx)
    ).rejects.toThrow(ToolRefusedError);

    await expect(
      runCheckTool.execute({ command: "cargo", args: ["run"] }, ctx)
    ).rejects.toThrow(/Disallowed command "cargo run"\. Valid commands: "anchor build", "anchor test", "cargo check"/);
  });

  it("throws ToolRefusedError on non-allowlisted anchor command (e.g. 'anchor deploy')", async () => {
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(
      runCheckTool.execute({ command: "anchor", args: ["deploy"] }, ctx)
    ).rejects.toThrow(ToolRefusedError);
  });

  it("refuses cwd traversal outside workspace", async () => {
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(
      runCheckTool.execute({ command: "cargo", args: ["check"], cwd: "../../" }, ctx)
    ).rejects.toThrow(ToolRefusedError);
  });
});

describe("fetch_docs Tool", () => {
  it("fetches documentation from allowlisted domain (solana.com)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "# Solana Docs Intro",
    });
    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      fetchFn: mockFetch as unknown as typeof fetch,
    };

    const res = await fetchDocsTool.execute(
      { url: "https://docs.solana.com/developing/programming-model/overview" },
      ctx
    );

    expect(res.status).toBe(200);
    expect(res.content).toBe("# Solana Docs Intro");
    expect(res.truncated).toBe(false);
  });

  it("fetches documentation from allowlisted docs.rs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "Anchor documentation",
    });
    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      fetchFn: mockFetch as unknown as typeof fetch,
    };
    const res = await fetchDocsTool.execute({ url: "https://docs.rs/anchor-lang/latest" }, ctx);
    expect(res.status).toBe(200);
  });

  it("fetches from github raw docs (raw.githubusercontent.com)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "# Anchor Readme",
    });
    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      fetchFn: mockFetch as unknown as typeof fetch,
    };
    const res = await fetchDocsTool.execute(
      { url: "https://raw.githubusercontent.com/coral-xyz/anchor/master/README.md" },
      ctx
    );
    expect(res.status).toBe(200);
  });

  it("fetches from github.com /raw/ path", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "# Anchor Raw",
    });
    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      fetchFn: mockFetch as unknown as typeof fetch,
    };
    const res = await fetchDocsTool.execute(
      { url: "https://github.com/coral-xyz/anchor/raw/master/README.md" },
      ctx
    );
    expect(res.status).toBe(200);
  });

  it("throws ToolRefusedError on non-allowlisted domain", async () => {
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(
      fetchDocsTool.execute({ url: "https://evil.example.com/exploit" }, ctx)
    ).rejects.toThrow(ToolRefusedError);

    await expect(
      fetchDocsTool.execute({ url: "https://evil.example.com/exploit" }, ctx)
    ).rejects.toThrow(/not permitted for fetch_docs\. Valid alternatives:/);
  });

  it("throws ToolRefusedError on non-raw github page", async () => {
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(
      fetchDocsTool.execute({ url: "https://github.com/coral-xyz/anchor" }, ctx)
    ).rejects.toThrow(ToolRefusedError);
  });

  it("throws ToolRefusedError on HTTP (non-HTTPS) URL", async () => {
    const ctx: ToolContext = { workspaceRoot: MOCK_WORKSPACE };
    await expect(
      fetchDocsTool.execute({ url: "http://docs.solana.com/intro" }, ctx)
    ).rejects.toThrow(ToolRefusedError);
    await expect(
      fetchDocsTool.execute({ url: "http://docs.solana.com/intro" }, ctx)
    ).rejects.toThrow(/Only HTTPS URLs are permitted/);
  });

  it("clamps oversized documentation content (MAX_DOCS_BYTES)", async () => {
    const hugeDoc = "x".repeat(MAX_DOCS_BYTES + 5000);
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => hugeDoc,
    });
    const ctx: ToolContext = {
      workspaceRoot: MOCK_WORKSPACE,
      fetchFn: mockFetch as unknown as typeof fetch,
    };
    const res = await fetchDocsTool.execute({ url: "https://docs.solana.com/huge" }, ctx);
    expect(res.truncated).toBe(true);
    expect(res.bytes).toBe(MAX_DOCS_BYTES);
  });
});
