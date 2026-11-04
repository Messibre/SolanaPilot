/**
 * SolanaPilot VS Code Extension activation entry point.
 * Thin: activation and wiring only (<120 lines) per Agent.md §6.
 */

import * as vscode from "vscode";
import {
  createStatusBar,
  updateStatusBar,
  promptSetApiKey,
  promptSelectProviderAndModel,
  testConnection,
} from "./vscodeAdapters";
import { ChatPanel } from "./chat";
import { generateAndDeploy } from "./programGenerator";
import { generateFrontend } from "./frontendGenerator";
import { getWorkspaceRoot } from "./fileWriter";
import { TerminalRunner } from "./terminalRunner";

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = createStatusBar(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("solanaPilot")) {
        updateStatusBar(statusBar);
      }
    })
  );

  // Command registrations
  context.subscriptions.push(
    vscode.commands.registerCommand("solanaPilot.setApiKey", () => promptSetApiKey(context)),
    vscode.commands.registerCommand("solanaCopilot.setApiKey", () => promptSetApiKey(context)),
    vscode.commands.registerCommand("solanaPilot.selectProviderAndModel", () =>
      promptSelectProviderAndModel(context, statusBar)
    ),
    vscode.commands.registerCommand("solanaPilot.testConnection", () => testConnection(context)),
    vscode.commands.registerCommand("solanaPilot.openChat", () => ChatPanel.createOrShow(context)),
    vscode.commands.registerCommand("solanaCopilot.openChat", () => ChatPanel.createOrShow(context)),
    vscode.commands.registerCommand("solanaCopilot.generateProgram", async () => {
      await generateAndDeploy(context);
    }),
    vscode.commands.registerCommand("solanaCopilot.generateFrontend", async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        void vscode.window.showErrorMessage("Open a workspace folder first");
        return;
      }
      await generateFrontend(root);
    }),
    vscode.commands.registerCommand("solanaCopilot.deployToDevnet", async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        void vscode.window.showErrorMessage("Open a workspace folder first");
        return;
      }
      await TerminalRunner.getInstance().runDeploy(root);
    })
  );
}

export function deactivate(): void {
  // No-op
}
