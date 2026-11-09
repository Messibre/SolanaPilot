import path from "node:path";
import { describe, expect, it } from "vitest";
import { ToolRefusedError } from "../core/errors";
import { resolveInWorkspace } from "./pathGuard";

describe("pathGuard: resolveInWorkspace", () => {
  const rootDir = path.resolve("/workspace/project");

  describe("valid paths", () => {
    it("resolves normal relative paths with POSIX and Windows separators", () => {
      const posixResult = resolveInWorkspace(rootDir, "src/lib.rs", "read");
      expect(posixResult).toBe(path.resolve(rootDir, "src/lib.rs"));

      const winResult = resolveInWorkspace(rootDir, "src\\lib.rs", "write");
      expect(winResult).toBe(path.resolve(rootDir, "src/lib.rs"));
    });

    it("allows reading .env.example but refuses writing to it", () => {
      const readExample = resolveInWorkspace(rootDir, ".env.example", "read");
      expect(readExample).toBe(path.resolve(rootDir, ".env.example"));

      expect(() => resolveInWorkspace(rootDir, ".env.example", "write")).toThrow(ToolRefusedError);
    });

    it("allows reading from node_modules but refuses writes to it", () => {
      const readNodeModules = resolveInWorkspace(rootDir, "node_modules/pkg/index.d.ts", "read");
      expect(readNodeModules).toBe(path.resolve(rootDir, "node_modules/pkg/index.d.ts"));

      expect(() => resolveInWorkspace(rootDir, "node_modules/pkg/index.js", "write")).toThrow(
        ToolRefusedError,
      );
    });
  });

  describe("path traversal and workspace escape", () => {
    it("refuses paths with .. escaping workspace", () => {
      expect(() => resolveInWorkspace(rootDir, "../outside.txt", "read")).toThrow(ToolRefusedError);
      expect(() => resolveInWorkspace(rootDir, "src/../../outside.txt", "read")).toThrow(
        ToolRefusedError,
      );
    });

    it("refuses absolute paths outside the workspace", () => {
      const outsidePath = path.resolve("/etc/passwd");
      expect(() => resolveInWorkspace(rootDir, outsidePath, "read")).toThrow(ToolRefusedError);
    });

    it("refuses paths containing null bytes", () => {
      expect(() => resolveInWorkspace(rootDir, "src/lib.rs\0evil", "read")).toThrow(ToolRefusedError);
    });

    it("refuses oversized paths exceeding 1024 characters", () => {
      const longPath = "a/".repeat(600) + "file.txt";
      expect(() => resolveInWorkspace(rootDir, longPath, "read")).toThrow(ToolRefusedError);
    });

    it("refuses empty or whitespace-only paths", () => {
      expect(() => resolveInWorkspace(rootDir, "", "read")).toThrow(ToolRefusedError);
      expect(() => resolveInWorkspace(rootDir, "   ", "write")).toThrow(ToolRefusedError);
    });
  });

  describe("deny list enforcement", () => {
    it("refuses .env files (except .env.example on read)", () => {
      expect(() => resolveInWorkspace(rootDir, ".env", "read")).toThrow(ToolRefusedError);
      expect(() => resolveInWorkspace(rootDir, ".env.local", "read")).toThrow(ToolRefusedError);
      expect(() => resolveInWorkspace(rootDir, "subdir/.env.production", "write")).toThrow(
        ToolRefusedError,
      );
    });

    it("refuses keypair files (*keypair*.json)", () => {
      expect(() => resolveInWorkspace(rootDir, "target/deploy/my_keypair.json", "read")).toThrow(
        ToolRefusedError,
      );
      expect(() => resolveInWorkspace(rootDir, "test-keypair.json", "write")).toThrow(
        ToolRefusedError,
      );
    });

    it("refuses id.json", () => {
      expect(() => resolveInWorkspace(rootDir, "id.json", "read")).toThrow(ToolRefusedError);
      expect(() => resolveInWorkspace(rootDir, "config/id.json", "read")).toThrow(ToolRefusedError);
    });

    it("refuses .git directory and contents", () => {
      expect(() => resolveInWorkspace(rootDir, ".git/config", "read")).toThrow(ToolRefusedError);
      expect(() => resolveInWorkspace(rootDir, ".git", "write")).toThrow(ToolRefusedError);
    });

    it("refuses .ssh directory and contents", () => {
      expect(() => resolveInWorkspace(rootDir, ".ssh/id_rsa", "read")).toThrow(ToolRefusedError);
    });
  });

  describe("symlink escape detection", () => {
    it("refuses symlinks resolving outside the workspace", () => {
      const symlinkPath = "src/symlink-escape";
      const injectedRealpath = (p: string) => {
        if (p.includes("symlink-escape")) {
          return path.resolve("/etc/shadow");
        }
        return p;
      };

      expect(() =>
        resolveInWorkspace(rootDir, symlinkPath, "read", { realpathSync: injectedRealpath }),
      ).toThrow("escapes the workspace root");
    });

    it("refuses symlinks resolving to denied targets inside workspace", () => {
      const symlinkPath = "src/symlink-keypair";
      const injectedRealpath = (p: string) => {
        if (p.includes("symlink-keypair")) {
          return path.resolve(rootDir, "target/deploy/program-keypair.json");
        }
        return p;
      };

      expect(() =>
        resolveInWorkspace(rootDir, symlinkPath, "read", { realpathSync: injectedRealpath }),
      ).toThrow("restricted path");
    });
  });
});
