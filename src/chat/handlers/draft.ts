import { callAI } from "../../aiClient";
import type { HistoryStore } from "../history";
import type { WebviewOutgoingMessage } from "../protocol";

export async function handleShowDraft(
  originalPrompt: string,
  history: HistoryStore,
  buildContext: () => Promise<string>,
  sendMessage: (msg: WebviewOutgoingMessage) => void,
): Promise<void> {
  sendMessage({
    type: "thinking",
    text: "Drafting a safe plan without touching the workspace...",
  });

  try {
    const fullContext = await buildContext();
    const draftPrompt = [
      "You are in Ask mode.",
      "The user requested a workspace-changing action, but Ask mode must remain read-only.",
      "Explain what you would change, which files you would touch, and include short code snippets if useful.",
      "Do not claim that files were written or commands were run.",
      `User request: ${originalPrompt}`,
    ].join("\n");

    const aiResponse = await callAI(draftPrompt, fullContext, false);

    history.push({
      role: "assistant",
      content: aiResponse,
      mode: "ask",
    });

    sendMessage({
      type: "response",
      text: aiResponse,
      mode: "ask",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to build draft response.";
    sendMessage({
      type: "error",
      text: errorMessage,
    });
  }
}

