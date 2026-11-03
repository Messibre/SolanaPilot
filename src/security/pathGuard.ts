/**
 * Path guard for workspace file access.
 * Strictly adheres to Agent.md §10.
 * Zero vscode imports allowed.
 */

import path from "node:path";
import { ToolRefusedError } from "../core/errors";

export type FileMode = "read" | "write";

export interface PathGuardOptions {
  realpathSync?: (p: string) => string;
}

const MAX_PATH_LENGTH = 1024;

/**
 * Checks if a filename or path segment matches the deny list.
 */
function isDeniedSegment(segment: string, mode: FileMode): string | null {
  const lower = segment.toLowerCase();

  // Deny .git
  if (lower === ".git" || lower.startsWith(".git/") || lower.startsWith(".git\\")) {
    return "Access to .git directory is prohibited";
  }

  // Deny .ssh
  if (lower === ".ssh" || lower.startsWith(".ssh/") || lower.startsWith(".ssh\\")) {
    return "Access to .ssh directory is prohibited";
  }

  // Deny node_modules write
  if (mode === "write" && (lower === "node_modules" || lower.includes("/node_modules/") || lower.includes("\\node_modules\\") || lower.startsWith("node_modules/") || lower.startsWith("node_modules\\"))) {
    return "Writing to node_modules is prohibited";
  }

  // Deny id.json
  if (lower === "id.json") {
    return "Access to id.json (Solana default keypair) is prohibited";
  }

  // Deny *keypair*.json
  if (lower.includes("keypair") && lower.endsWith(".json")) {
    return "Access to keypair files is prohibited";
  }

  // Deny .env* except .env.example on read
  if (lower.startsWith(".env")) {
    if (mode === "read" && (lower === ".env.example" || lower.endsWith(".env.example"))) {
      return null;
    }
    return "Access to .env files (except .env.example on read) is prohibited";
  }

  return null;
}

function normalizePathForComparison(p: string): string {
  // Convert Windows backslashes and normalize
  const resolved = path.resolve(p);
  // Standardize case on Windows for comparison
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * Resolves a candidate path within workspace root, enforcing containment and deny list.
 * Throws ToolRefusedError if access is denied or escapes workspace.
 *
 * @param root Workspace root directory
 * @param candidate Requested relative or absolute candidate path
 * @param mode 'read' or 'write'
 * @param options Injected options (e.g. realpathSync)
 * @returns Absolute safe path
 */
export function resolveInWorkspace(
  root: string,
  candidate: string,
  mode: FileMode,
  options: PathGuardOptions = {},
): string {
  if (typeof candidate !== "string" || !candidate.trim()) {
    throw new ToolRefusedError("Candidate path must be a non-empty string");
  }

  // 1. Check for null bytes
  if (candidate.includes("\0")) {
    throw new ToolRefusedError("Null bytes in path are prohibited");
  }

  // 2. Check path length
  if (candidate.length > MAX_PATH_LENGTH) {
    throw new ToolRefusedError(`Path length exceeds maximum allowed limit of ${MAX_PATH_LENGTH} characters`);
  }

  const resolvedRoot = path.resolve(root);
  // Resolve candidate relative to root if relative; if absolute, resolve relative to root or system
  const resolvedPath = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(resolvedRoot, candidate);

  const normRoot = normalizePathForComparison(resolvedRoot);
  const normPath = normalizePathForComparison(resolvedPath);

  // 3. Workspace containment check
  const isContained = normPath === normRoot || normPath.startsWith(normRoot + path.sep);
  if (!isContained) {
    throw new ToolRefusedError(`Path '${candidate}' escapes the workspace root`);
  }

  // 4. Deny list inspection on path segments
  const relativeFromRoot = path.relative(resolvedRoot, resolvedPath);
  const segments = relativeFromRoot.split(/[/\\]/);

  for (const segment of segments) {
    const denialReason = isDeniedSegment(segment, mode);
    if (denialReason) {
      throw new ToolRefusedError(denialReason);
    }
  }

  // Also check full relative path for patterns like node_modules writes or nested keypairs
  const fullRelativeReason = isDeniedSegment(relativeFromRoot, mode);
  if (fullRelativeReason) {
    throw new ToolRefusedError(fullRelativeReason);
  }

  // 5. Injected symlink realpath check
  if (options.realpathSync) {
    try {
      const realTarget = options.realpathSync(resolvedPath);
      const normReal = normalizePathForComparison(realTarget);
      if (!(normReal === normRoot || normReal.startsWith(normRoot + path.sep))) {
        throw new ToolRefusedError(`Symlink target '${realTarget}' escapes the workspace root`);
      }
      const realRelative = path.relative(resolvedRoot, realTarget);
      const realSegments = realRelative.split(/[/\\]/);
      for (const seg of realSegments) {
        const segReason = isDeniedSegment(seg, mode);
        if (segReason) {
          throw new ToolRefusedError(`Symlink target touches restricted path: ${segReason}`);
        }
      }
    } catch (err) {
      if (err instanceof ToolRefusedError) {
        throw err;
      }
      // If file does not exist yet (common in write mode), ignore realpath failure
    }
  }

  return resolvedPath;
}
