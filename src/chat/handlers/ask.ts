import { callAI } from "../../aiClient";
import { getWorkspaceRoot } from "../../fileWriter";
import type { HistoryStore } from "../history";
import type { WebviewOutgoingMessage } from "../protocol";
import type { ChatMode } from "../types";
import {
  handleDeployRequest,
  isDeployRequest,
  shouldMentionDeployFollowUp,
} from "./deploy";
import { parseWorkspaceUpdateResponse } from "./parser";
import type { PreviewManager } from "./preview";
import {
  buildModePrompt,
  buildWorkspaceActionPrompt,
  isWorkspaceChangeRequest,
} from "./prompts";

export async function handleChatMessage(
  userMessage: string,
  mode: ChatMode,
  recordUserMessage: boolean,
  history: HistoryStore,
  previewManager: PreviewManager,
  buildContext: () => Promise<string>,
  createNonce: () => string,
  sendMessage: (msg: WebviewOutgoingMessage) => void,
): Promise<void> {
  const normalizedMessage = userMessage.trim();
  if (!normalizedMessage) {
    return;
  }

  sendMessage({
    type: "thinking",
    text:
      mode === "agent" &&
        (isWorkspaceChangeRequest(normalizedMessage) ||
          isDeployRequest(normalizedMessage))
        ? "Agent mode is preparing a workspace action..."
        : "SolanaPilot is thinking...",
  });

  if (recordUserMessage) {
    history.push({
      role: "user",
      content: normalizedMessage,
      mode,
    });
  }

  if (
    mode === "ask" &&
    (isWorkspaceChangeRequest(normalizedMessage) ||
      isDeployRequest(normalizedMessage))
  ) {
    const explanation =
      "This request needs workspace changes or terminal actions. Ask mode stays read-only. Switch to Agent to let me write files or deploy, or choose Show Draft Here for a safe explanation-first response.";

    history.push({
      role: "assistant",
      content: explanation,
      mode,
    });

    sendMessage({
      type: "modeSuggestion",
      text: explanation,
      originalPrompt: normalizedMessage,
      mode: "ask",
    });
    return;
  }

  if (mode === "agent" && isDeployRequest(normalizedMessage)) {
    await handleDeployRequest(normalizedMessage, history, sendMessage);
    return;
  }

  if (mode === "agent" && isWorkspaceChangeRequest(normalizedMessage)) {
    await handleAgentWorkspaceAction(
      normalizedMessage,
      history,
      previewManager,
      buildContext,
      createNonce,
      sendMessage,
    );
    return;
  }

  await handleConversationalReply(
    normalizedMessage,
    mode,
    history,
    buildContext,
    sendMessage,
  );
}

async function handleConversationalReply(
  userMessage: string,
  mode: ChatMode,
  history: HistoryStore,
  buildContext: () => Promise<string>,
  sendMessage: (msg: WebviewOutgoingMessage) => void,
): Promise<void> {
  try {
    const fullContext = await buildContext();
    const prompt = buildModePrompt(userMessage, mode);
    const aiResponse = await callAI(prompt, fullContext, false);

    history.push({
      role: "assistant",
      content: aiResponse,
      mode,
    });

    sendMessage({
      type: "response",
      text: aiResponse,
      mode,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to reach AI. Check your API key and network connection.";
    sendMessage({
      type: "error",
      text: errorMessage,
    });
  }
}

async function handleAgentWorkspaceAction(
  userMessage: string,
  history: HistoryStore,
  previewManager: PreviewManager,
  buildContext: () => Promise<string>,
  createNonce: () => string,
  sendMessage: (msg: WebviewOutgoingMessage) => void,
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    const errorMessage =
      "Open a workspace folder first so Agent mode has somewhere to write files.";
    history.push({
      role: "assistant",
      content: errorMessage,
      mode: "agent",
    });
    sendMessage({ type: "error", text: errorMessage });
    return;
  }

  try {
    const fullContext = await buildContext();
    const agentPrompt = buildWorkspaceActionPrompt(userMessage);
    const rawResponse = await callAI(agentPrompt, fullContext, true);
    const parsed = parseWorkspaceUpdateResponse(rawResponse);

    if (!parsed.files || parsed.files.length === 0) {
      throw new Error("Agent mode did not return any files to write.");
    }

    const confirmed = await previewManager.requestWorkspacePreview(
      workspaceRoot,
      parsed,
      createNonce,
      sendMessage,
    );
    if (!confirmed) {
      const pendingError = previewManager.getPendingError();
      if (pendingError) {
        throw new Error(pendingError);
      }

      const cancelled = "Agent mode preview cancelled before writing any files.";
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

    const summaryLines = [
      parsed.summary || `Updated ${parsed.files.length} workspace file(s).`,
      "",
      "Files written:",
      ...parsed.files.map((file) => `- ${file.path}`),
    ];

    if (parsed.notes && parsed.notes.length > 0) {
      summaryLines.push("", "Notes:", ...parsed.notes.map((note) => `- ${note}`));
    }

    if (shouldMentionDeployFollowUp(userMessage)) {
      summaryLines.push(
        "",
        "If you want the devnet deploy next, ask me to deploy in Agent mode.",
      );
    }

    const responseText = summaryLines.join("\n");
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
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Agent mode failed to update the workspace.";
    history.push({
      role: "assistant",
      content: errorMessage,
      mode: "agent",
    });
    sendMessage({
      type: "error",
      text: errorMessage,
    });
  }
}
