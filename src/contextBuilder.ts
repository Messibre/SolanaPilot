import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, "[REDACTED_GOOGLE_API_KEY]"],
  [/\b(sk|rk)_[A-Za-z0-9]{20,}\b/g, "[REDACTED_API_KEY]"],
  [/\b[1-9A-HJ-NP-Za-km-z]{64,88}\b/g, "[REDACTED_POSSIBLE_PRIVATE_KEY]"],
  [
    /((?:api[_-]?key|secret|token|private[_-]?key)\s*[:=]\s*)(["']?)[^\r\n"']+\2/gi,
    "$1[REDACTED_SECRET]",
  ],
];

function shouldExcludeFromContext(filePath: string): boolean {
  const lower = filePath.toLowerCase();

  return (
    lower.endsWith(".env") ||
    lower.endsWith(".env.local") ||
    lower.includes(`${path.sep}.env`) ||
    lower.includes(`${path.sep}node_modules${path.sep}`) ||
    lower.includes(`${path.sep}.git${path.sep}`)
  );
}

function redactSecrets(content: string): string {
  return SECRET_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    content,
  );
}

export async function buildWorkspaceContext(): Promise<string> {
  try {
    if (
      !vscode.workspace.workspaceFolders ||
      vscode.workspace.workspaceFolders.length === 0
    ) {
      return "";
    }

    let contextString = "";
    const maxContextLength = 8000;
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
      const relativePath = vscode.workspace.asRelativePath(
        activeEditor.document.uri,
      );

      contextString += `## Active File: ${relativePath}\n`;
      if (shouldExcludeFromContext(relativePath)) {
        contextString += "[excluded from AI context to avoid leaking secrets]\n\n";
      } else {
        let activeFileContent = redactSecrets(activeEditor.document.getText());
        if (activeFileContent.length > 3000) {
          activeFileContent =
            activeFileContent.substring(0, 3000) + "\n...[truncated]";
        }
        contextString += activeFileContent + "\n\n";
      }
    }

    const filePattern = new vscode.RelativePattern(
      vscode.workspace.workspaceFolders[0],
      "{**/Anchor.toml,**/Cargo.toml,**/lib.rs,**/*.ts,**/*.tsx}",
    );

    const foundFiles = await vscode.workspace.findFiles(
      filePattern,
      "**/{target,node_modules,.git,out,dist}/**",
      12,
    );

    if (foundFiles.length > 0) {
      contextString += "## Workspace Files:\n";

      for (const fileUri of foundFiles) {
        if (contextString.length >= maxContextLength) {
          contextString += "\n...[additional files truncated]";
          break;
        }

        try {
          const relativePath = vscode.workspace.asRelativePath(fileUri);
          if (shouldExcludeFromContext(relativePath)) {
            continue;
          }

          let fileContent = redactSecrets(fs.readFileSync(fileUri.fsPath, "utf8"));
          if (fileContent.length > 2000) {
            fileContent = fileContent.substring(0, 2000) + "\n...[truncated]";
          }

          contextString += `### ${relativePath}\n${fileContent}\n`;
        } catch (error) {
          console.warn("[SolanaPilot] Could not read file for context:", error);
        }
      }
    }

    if (contextString.length > maxContextLength) {
      contextString =
        contextString.substring(0, maxContextLength) +
        "\n...[context truncated]";
    }

    return contextString.trim();
  } catch (error) {
    console.error("[SolanaPilot] Error building workspace context:", error);
    return "";
  }
}
