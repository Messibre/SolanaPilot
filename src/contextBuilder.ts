import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Build workspace context by reading relevant files from the current workspace.
 * Returns a formatted string with the active file and workspace files.
 *
 * @returns A formatted context string (max 8000 chars)
 */
export async function buildWorkspaceContext(): Promise<string> {
  try {
    // Check if a workspace is open
    if (
      !vscode.workspace.workspaceFolders ||
      vscode.workspace.workspaceFolders.length === 0
    ) {
      return "";
    }

    let contextString = "";
    const maxContextLength = 8000;

    // ─────────────────────────────────────────────────────────────────
    // 1. Get active file content
    // ─────────────────────────────────────────────────────────────────
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const relativePath = vscode.workspace.asRelativePath(
        activeEditor.document.uri,
      );
      let activeFileContent = activeEditor.document.getText();

      // Truncate to 3000 chars if too long
      if (activeFileContent.length > 3000) {
        activeFileContent =
          activeFileContent.substring(0, 3000) + "\n...[truncated]";
      }

      contextString += `## Active File: ${relativePath}\n`;
      contextString += activeFileContent + "\n\n";
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. Search for Anchor/Cargo files in workspace
    // ─────────────────────────────────────────────────────────────────
    const filePattern = new vscode.RelativePattern(
      vscode.workspace.workspaceFolders[0],
      "{**/Anchor.toml,**/Cargo.toml,**/lib.rs}",
    );

    const foundFiles = await vscode.workspace.findFiles(
      filePattern,
      "**/target/**",
      10,
    );

    if (foundFiles.length > 0) {
      contextString += "## Workspace Files:\n";

      for (const fileUri of foundFiles) {
        // Check current length
        if (contextString.length >= maxContextLength) {
          contextString += "\n...[additional files truncated]";
          break;
        }

        try {
          const relativePath = vscode.workspace.asRelativePath(fileUri);
          let fileContent = fs.readFileSync(fileUri.fsPath, "utf8");

          // Truncate to 2000 chars per file if too long
          if (fileContent.length > 2000) {
            fileContent = fileContent.substring(0, 2000) + "\n...[truncated]";
          }

          contextString += `### ${relativePath}\n`;
          contextString += fileContent + "\n";
        } catch (err) {
          // Skip files that can't be read (permissions, etc.)
          console.warn(`[SolanaPilot] Could not read file:`, err);
          continue;
        }
      }
    }

    // Truncate total context if it exceeds max length
    if (contextString.length > maxContextLength) {
      contextString =
        contextString.substring(0, maxContextLength) +
        "\n...[context truncated]";
    }

    return contextString.trim();
  } catch (err) {
    console.error("[SolanaPilot] Error building workspace context:", err);
    return "";
  }
}
