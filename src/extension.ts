import * as vscode from "vscode";
import { initAI } from "./aiClient";
import { ChatPanel } from "./chatPanel";
import { getWorkspaceRoot } from "./fileWriter";
import { generateAndDeploy } from "./programGenerator";
import { generateFrontend } from "./frontendGenerator";
import { getApiKey, saveApiKey } from "./secretStorage";
import { TerminalRunner } from "./terminalRunner";

async function configureApiKey(
  context: vscode.ExtensionContext,
): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: "Enter your Gemini API key",
    ignoreFocusOut: true,
    password: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "API key is required" : undefined,
  });

  if (!apiKey) {
    return;
  }

  await saveApiKey(context, apiKey.trim());
  initAI(apiKey.trim());
  void vscode.window.showInformationMessage(
    "Gemini API key saved for SolanaPilot.",
  );
}

async function ensureAIReady(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  const apiKey = await getApiKey(context, false);
  if (!apiKey) {
    return false;
  }

  initAI(apiKey.trim());
  return true;
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const savedKey = await getApiKey(context, true);
  if (savedKey) {
    initAI(savedKey);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("solanaCopilot.setApiKey", async () => {
      await configureApiKey(context);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solanaCopilot.generateProgram",
      async () => {
        if (!(await ensureAIReady(context))) {
          return;
        }

        await generateAndDeploy(context);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solanaCopilot.deployToDevnet",
      async () => {
        const root = getWorkspaceRoot();
        if (!root) {
          void vscode.window.showErrorMessage("Open a workspace folder first");
          return;
        }

        const runner = TerminalRunner.getInstance();
        await runner.runDeploy(root);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solanaCopilot.generateFrontend",
      async () => {
        if (!(await ensureAIReady(context))) {
          return;
        }

        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          void vscode.window.showErrorMessage(
            "❌ No workspace folder open. Please open a folder first.",
          );
          return;
        }

        await generateFrontend(workspaceRoot);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("solanaCopilot.openChat", async () => {
      if (!(await ensureAIReady(context))) {
        return;
      }

      ChatPanel.createOrShow(context);
    }),
  );
}

export function deactivate(): void {
  // No-op.
}
