/**
 * VS Code host adapter for prerequisite detection and first-run onboarding.
 * Uses core/prereqs for all decision logic.
 */

import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  checkAnchorVersion,
  createPrereqSessionState,
  evaluateFirstRun,
  evaluateToolNotices,
  markToolNoticesShown,
  parseToolVersion,
  shouldShowToolNotices,
  ToolStatus,
} from "../core/prereqs";
import { getProviderKey, promptSetApiKey } from "./secretStorage";

const execFileAsync = promisify(execFile);

const sessionState = createPrereqSessionState();

/**
 * Runs a CLI version command safely with args array and timeout.
 */
async function queryCliVersion(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, ["--version"], {
      timeout: 5000,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Detects tool installations and versions on the local system.
 */
export async function detectToolStatus(): Promise<ToolStatus> {
  const [solanaRaw, anchorRaw] = await Promise.all([
    queryCliVersion("solana"),
    queryCliVersion("anchor"),
  ]);

  const solanaParsed = solanaRaw ? parseToolVersion(solanaRaw) : null;
  const anchorCheck = anchorRaw ? checkAnchorVersion(anchorRaw) : { supported: false };

  return {
    solanaInstalled: !!solanaRaw,
    solanaVersion: solanaParsed?.version,
    anchorInstalled: !!anchorRaw,
    anchorVersion: anchorCheck.version,
    anchorSupported: anchorCheck.supported,
    anchorWarning: anchorCheck.warning,
  };
}

/**
 * Runs first-run onboarding flow if this is the first activation in the workspace/profile.
 */
export async function runFirstRunFlow(context: vscode.ExtensionContext): Promise<void> {
  const hasRunBefore = context.globalState.get<boolean>("solanaPilot.hasRunBefore", false);
  const config = vscode.workspace.getConfiguration("solanaPilot");
  const provider = config.get<string>("provider", "gemini");

  let hasApiKey = false;
  if (provider !== "ollama") {
    try {
      const key = await getProviderKey(context, provider);
      hasApiKey = !!key && key.trim().length > 0;
    } catch {
      hasApiKey = false;
    }
  }

  const recommendation = evaluateFirstRun({
    hasRunBefore,
    provider,
    hasApiKey,
  });

  if (!recommendation.shouldPrompt) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    recommendation.message,
    "Use Ollama (Local)",
    "Set API Key",
    "Later"
  );

  await context.globalState.update("solanaPilot.hasRunBefore", true);

  if (choice === "Use Ollama (Local)") {
    await config.update("provider", "ollama", vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(
      "SolanaPilot provider switched to Ollama (local offline). Ensure Ollama is running at localhost:11434."
    );
  } else if (choice === "Set API Key") {
    await promptSetApiKey(context);
  }
}

/**
 * Performs prerequisite checks once per VS Code session.
 */
export async function checkPrerequisitesOncePerSession(
  context: vscode.ExtensionContext
): Promise<void> {
  // First run flow check
  await runFirstRunFlow(context);

  // Missing-tool notices (shown at most once per session)
  if (!shouldShowToolNotices(sessionState)) {
    return;
  }

  markToolNoticesShown(sessionState);

  const status = await detectToolStatus();
  const notices = evaluateToolNotices(status);

  for (const notice of notices) {
    if (notice.severity === "warning") {
      void vscode.window.showWarningMessage(`SolanaPilot: ${notice.message}`);
    }
  }
}
