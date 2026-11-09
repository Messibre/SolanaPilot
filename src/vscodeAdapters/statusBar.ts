/**
 * VS Code Status Bar adapter.
 * Shows current provider and model in the status bar.
 * Permitted to import 'vscode' per Agent.md §6.
 */

import * as vscode from "vscode";

export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = "solanaPilot.selectProviderAndModel";
  updateStatusBar(item);
  item.show();
  context.subscriptions.push(item);
  return item;
}

export function updateStatusBar(item: vscode.StatusBarItem): void {
  const config = vscode.workspace.getConfiguration("solanaPilot");
  const provider = config.get<string>("provider") ?? "gemini";
  const model = config.get<string>("model") ?? "gemini-2.0-flash";

  item.text = `$(zap) SolanaPilot: ${provider} · ${model}`;
  item.tooltip = `SolanaPilot (${provider} · ${model})\nClick to select provider and model`;
}
