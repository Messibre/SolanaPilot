import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface WorkspaceFile {
  path: string;
  content: string;
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
}

export function isSafeRelativeWorkspacePath(
  workspaceRoot: string,
  relativePath: string,
): boolean {
  if (!relativePath || path.isAbsolute(relativePath)) {
    return false;
  }

  const normalized = path.normalize(relativePath);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    return false;
  }

  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(resolvedRoot, normalized);
  const relativeTarget = path.relative(resolvedRoot, resolvedPath);

  return (
    relativeTarget.length > 0 &&
    relativeTarget !== ".." &&
    !relativeTarget.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeTarget)
  );
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  relativePath: string,
): string {
  if (!isSafeRelativeWorkspacePath(workspaceRoot, relativePath)) {
    throw new Error(`Refusing to resolve unsafe workspace path: ${relativePath}`);
  }

  return path.resolve(workspaceRoot, path.normalize(relativePath));
}

export async function openFileInEditor(absolutePath: string): Promise<void> {
  try {
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    const doc = await vscode.workspace.openTextDocument(absolutePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
  } catch {
    // Silent failure as requested.
  }
}

export async function writeFilesToWorkspace(
  files: WorkspaceFile[],
): Promise<boolean> {
  try {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage(
        "Please open a folder first (File → Open Folder)",
      );
      return false;
    }

    const MAX_FILE_BYTES = 500_000; // 500 KB per file
    const written: string[] = [];

    for (const file of files) {
      const fullPath = resolveWorkspacePath(workspaceRoot, file.path);

      if (Buffer.byteLength(file.content || "", "utf8") > MAX_FILE_BYTES) {
        throw new Error(
          `File too large: ${file.path} exceeds ${MAX_FILE_BYTES} bytes`,
        );
      }

      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, file.content, "utf8");
      console.log("SolanaPilot wrote:", file.path);
      written.push(file.path);
    }

    const libRsFile = files.find((file) => file.path.endsWith("lib.rs"));
    if (libRsFile) {
      try {
        const libRsPath = resolveWorkspacePath(workspaceRoot, libRsFile.path);
        const doc = await vscode.workspace.openTextDocument(libRsPath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      } catch (openErr) {
        // Non-fatal: continue
        console.error(
          "SolanaPilot: could not open lib.rs after generation",
          openErr,
        );
      }
    }

    vscode.window.showInformationMessage(
      `✅ Generated ${files.length} files for your Solana program`,
    );
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown file write error";
    vscode.window.showErrorMessage(
      `Failed to write generated files: ${message}`,
    );
    return false;
  }
}
