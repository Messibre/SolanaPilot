import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import { initAI } from "./aiClient";
import { ChatPanel } from "./chatPanel";
import { getWorkspaceRoot } from "./fileWriter";
import { generateAndDeploy } from "./programGenerator";
import { generateFrontend } from "./frontendGenerator";
import { getApiKey, saveApiKey } from "./secretStorage";
import { TerminalRunner } from "./terminalRunner";

const execFileAsync = promisify(execFile);

async function checkPrerequisites(): Promise<void> {
  try {
    await execFileAsync("solana", ["--version"]);
  } catch {
    const selection = await vscode.window.showWarningMessage(
      "Solana CLI not detected. Deployment features will not work until it is installed.",
      "Install Guide",
    );

    if (selection === "Install Guide") {
      void vscode.env.openExternal(
        vscode.Uri.parse(
          "https://docs.solana.com/cli/install-solana-cli-tools",
        ),
      );
    }
  }

  try {
    await execFileAsync("anchor", ["--version"]);
  } catch {
    const selection = await vscode.window.showWarningMessage(
      "Anchor CLI not detected. Program generation will still work, but deployment and frontend generation may fail.",
      "Install Guide",
    );

    if (selection === "Install Guide") {
      void vscode.env.openExternal(
        vscode.Uri.parse("https://www.anchor-lang.com/docs/installation"),
      );
    }
  }
}

async function configureApiKey(
  context: vscode.ExtensionContext,
): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: "Enter your Gemini API key (free at aistudio.google.com)",
    ignoreFocusOut: true,
    password: true,
    placeHolder: "AIza...",
    validateInput: (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return "API key cannot be empty";
      }
      if (!trimmed.startsWith("AIza")) {
        return 'Gemini API keys typically start with "AIza"';
      }
      if (trimmed.length < 20) {
        return "API key seems too short. Make sure you copied it fully.";
      }
      return undefined;
    },
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
  void checkPrerequisites();

  const savedKey = await getApiKey(context, true);
  if (savedKey) {
    initAI(savedKey);
  }

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = "$(zap) SolanaPilot";
  statusBarItem.tooltip = "Click to open SolanaPilot chat";
  statusBarItem.command = "solanaCopilot.openChat";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

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
