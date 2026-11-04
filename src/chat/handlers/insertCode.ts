import * as vscode from "vscode";
import type { WebviewOutgoingMessage } from "../protocol";

export async function handleInsertCode(
  code: string,
  sendMessage: (msg: WebviewOutgoingMessage) => void,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    void vscode.window.showWarningMessage(
      "Please open a file first to insert code.",
    );
    return;
  }

  await editor.edit((editBuilder) => {
    editBuilder.insert(editor.selection.active, code);
  });

  sendMessage({
    type: "insertCode",
  });
}

