import * as vscode from "vscode";
import { getWorkspaceRoot } from "../../fileWriter";
import { TerminalRunner } from "../../terminalRunner";
import type { HistoryStore } from "../history";
import type { WebviewOutgoingMessage } from "../protocol";

export function isDeployRequest(userMessage: string): boolean {
  const text = userMessage.toLowerCase().trim();
  if (/^(how|why|what|when|where)\b/.test(text)) {
    return false;
  }

  return (
    /\bdeploy\b/.test(text) ||
    /\banchor build\b/.test(text) ||
    /\banchor deploy\b/.test(text) ||
    /\bairdrop\b/.test(text)
  );
}

export function shouldMentionDeployFollowUp(userMessage: string): boolean {
  return /\bdeploy\b/.test(userMessage.toLowerCase());
}

export function buildDeployResponse(userMessage: string): string {
  if (
    /\bbuild\b/.test(userMessage.toLowerCase()) &&
    !/\bdeploy\b/.test(userMessage.toLowerCase())
  ) {
    return "I started the Solana terminal flow. It will run the build and deploy steps in the integrated terminal.";
  }

  return "I started the devnet deploy flow in the SolanaPilot terminal. Watch that terminal for `anchor build`, `anchor deploy`, and the resulting Program ID.";
}

export async function handleDeployRequest(
  userMessage: string,
  history: HistoryStore,
  sendMessage: (msg: WebviewOutgoingMessage) => void,
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    const errorMessage =
      "Open a workspace folder first so Agent mode knows what to deploy.";
    history.push({
      role: "assistant",
      content: errorMessage,
      mode: "agent",
    });
    sendMessage({ type: "error", text: errorMessage });
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    "Run the Solana devnet deploy flow in the integrated terminal?",
    "Deploy to Devnet",
    "Cancel",
  );

  if (choice !== "Deploy to Devnet") {
    const cancelled =
      "Deploy cancelled. Ask again in Agent mode when you want to run it.";
    history.push({
      role: "assistant",
      content: cancelled,
      mode: "agent",
    });
    sendMessage({
      type: "response",
      text: cancelled,
      mode: "agent",
    });
    return;
  }

  const runner = TerminalRunner.getInstance();
  runner.runDeploy(workspaceRoot);

  const responseText = buildDeployResponse(userMessage);
  history.push({
    role: "assistant",
    content: responseText,
    mode: "agent",
  });
  sendMessage({
    type: "response",
    text: responseText,
    mode: "agent",
  });
}

