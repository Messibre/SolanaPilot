import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  openFileInEditor,
  resolveWorkspacePath,
  writeFilesToWorkspace,
} from "../../fileWriter";
import type { PendingWorkspacePreview, WorkspaceUpdateResponse } from "../types";
import type { WebviewOutgoingMessage } from "../protocol";

export class PreviewManager {
  private pending: PendingWorkspacePreview | undefined;
  private pendingError: string | undefined;

  public getPendingError(): string | undefined {
    const err = this.pendingError;
    this.pendingError = undefined;
    return err;
  }

  public async requestWorkspacePreview(
    workspaceRoot: string,
    parsed: WorkspaceUpdateResponse,
    createNonce: () => string,
    sendMessage: (msg: WebviewOutgoingMessage) => void,
  ): Promise<boolean> {
    if (this.pending) {
      this.pending.resolve(false);
    }

    const previewId = createNonce();
    const files = parsed.files ?? [];

    sendMessage({
      type: "workspacePreview",
      previewId,
      mode: "agent",
      text:
        parsed.summary ||
        `Agent prepared ${files.length} file change(s). Review them below and choose whether to write them.`,
      files,
    });

    return new Promise<boolean>((resolve) => {
      this.pending = {
        previewId,
        workspaceRoot,
        files,
        parsed,
        resolve,
      };
    });
  }

  public async handleChoice(
    previewId: string,
    choice: "write" | "cancel",
    sendMessage: (msg: WebviewOutgoingMessage) => void,
  ): Promise<void> {
    const pending = this.pending;
    if (!pending || pending.previewId !== previewId) {
      return;
    }

    if (choice === "cancel") {
      this.pending = undefined;
      this.pendingError = undefined;
      pending.resolve(false);
      return;
    }

    try {
      const writeSucceeded = await writeFilesToWorkspace(pending.files, {
        silent: true,
      });
      if (!writeSucceeded) {
        throw new Error("SolanaPilot could not write the requested files.");
      }

      if (pending.parsed.openFile) {
        const safeOpenPath = resolveWorkspacePath(
          pending.workspaceRoot,
          pending.parsed.openFile,
        );
        await openFileInEditor(safeOpenPath);
      }

      this.pending = undefined;
      this.pendingError = undefined;
      pending.resolve(true);
    } catch (error) {
      this.pending = undefined;
      this.pendingError =
        error instanceof Error ? error.message : "Failed to write workspace files.";
      pending.resolve(false);
      sendMessage({ type: "error", text: this.pendingError });
    }
  }

  public async handleDiff(previewId: string): Promise<void> {
    const pending = this.pending;
    if (!pending || pending.previewId !== previewId) {
      return;
    }

    const previewDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "solanapilot-preview-"),
    );
    const maxPreviewFiles = Math.min(pending.files.length, 5);

    try {
      for (let index = 0; index < maxPreviewFiles; index++) {
        const file = pending.files[index];
        const originalPath = path.resolve(
          pending.workspaceRoot,
          path.normalize(file.path),
        );
        const originalContent = fs.existsSync(originalPath)
          ? fs.readFileSync(originalPath, "utf8")
          : "";

        const safePreviewName = file.path.replace(/[\\/:*?"<>|]/g, "_");
        const originalPreviewPath = path.join(
          previewDir,
          `${index}-original-${safePreviewName}`,
        );
        const updatedPreviewPath = path.join(
          previewDir,
          `${index}-updated-${safePreviewName}`,
        );

        fs.writeFileSync(originalPreviewPath, originalContent, "utf8");
        fs.writeFileSync(updatedPreviewPath, file.content, "utf8");

        await vscode.commands.executeCommand(
          "vscode.diff",
          vscode.Uri.file(originalPreviewPath),
          vscode.Uri.file(updatedPreviewPath),
          `SolanaPilot preview: ${file.path}`,
        );
      }

      if (pending.files.length > maxPreviewFiles) {
        void vscode.window.showInformationMessage(
          `Previewed the first ${maxPreviewFiles} file(s). ${pending.files.length - maxPreviewFiles} additional file(s) are ready to write.`,
        );
      }
    } finally {
      setTimeout(() => {
        try {
          fs.rmSync(previewDir, { recursive: true, force: true });
        } catch {
          // Ignore preview cleanup failures.
        }
      }, 10_000);
    }
  }
}

