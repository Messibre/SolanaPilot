import { describe, expect, it } from "vitest";
import {
  parseIncomingWebviewMessage,
  safeParseIncomingWebviewMessage,
  MAX_MESSAGE_TEXT_LENGTH,
} from "./protocol";

describe("chat/protocol - IncomingWebviewMessageSchema", () => {
  it("parses valid 'ask' messages", () => {
    const valid = {
      type: "ask",
      text: "How do I create a token on Solana?",
      mode: "ask",
    };
    const parsed = parseIncomingWebviewMessage(valid);
    expect(parsed).toEqual(valid);
  });

  it("parses valid 'rerun' messages", () => {
    const valid = {
      type: "rerun",
      text: "Retry generation",
      mode: "agent",
    };
    const parsed = parseIncomingWebviewMessage(valid);
    expect(parsed).toEqual(valid);
  });

  it("parses valid 'showDraft', 'insertCode', 'workspacePreviewChoice', 'workspacePreviewDiff', 'clearHistory'", () => {
    expect(
      parseIncomingWebviewMessage({ type: "showDraft", text: "Draft request" }),
    ).toEqual({ type: "showDraft", text: "Draft request" });

    expect(
      parseIncomingWebviewMessage({
        type: "insertCode",
        code: "const a = 1;",
      }),
    ).toEqual({ type: "insertCode", code: "const a = 1;" });

    expect(
      parseIncomingWebviewMessage({
        type: "workspacePreviewChoice",
        previewId: "prev-123",
        choice: "write",
      }),
    ).toEqual({
      type: "workspacePreviewChoice",
      previewId: "prev-123",
      choice: "write",
    });

    expect(
      parseIncomingWebviewMessage({
        type: "workspacePreviewChoice",
        previewId: "prev-123",
        choice: "cancel",
      }),
    ).toEqual({
      type: "workspacePreviewChoice",
      previewId: "prev-123",
      choice: "cancel",
    });

    expect(
      parseIncomingWebviewMessage({
        type: "workspacePreviewDiff",
        previewId: "prev-123",
      }),
    ).toEqual({
      type: "workspacePreviewDiff",
      previewId: "prev-123",
    });

    expect(parseIncomingWebviewMessage({ type: "clearHistory" })).toEqual({
      type: "clearHistory",
    });
  });

  it("rejects unknown message types", () => {
    const unknownType = {
      type: "unknownAction",
      text: "hello",
    };
    const result = safeParseIncomingWebviewMessage(unknownType);
    expect(result.success).toBe(false);
  });

  it("rejects messages with extra keys due to strict validation", () => {
    const withExtraKey = {
      type: "ask",
      text: "valid text",
      mode: "ask",
      unexpectedProperty: 12345,
    };
    const result = safeParseIncomingWebviewMessage(withExtraKey);
    expect(result.success).toBe(false);
  });

  it("rejects oversized message text", () => {
    const oversizedText = "x".repeat(MAX_MESSAGE_TEXT_LENGTH + 1);
    const oversizedMessage = {
      type: "ask",
      text: oversizedText,
      mode: "ask",
    };
    const result = safeParseIncomingWebviewMessage(oversizedMessage);
    expect(result.success).toBe(false);
  });

  it("accepts text exactly at the maximum allowed length", () => {
    const exactMaxText = "a".repeat(MAX_MESSAGE_TEXT_LENGTH);
    const result = safeParseIncomingWebviewMessage({
      type: "ask",
      text: exactMaxText,
      mode: "ask",
    });
    expect(result.success).toBe(true);
  });
});

