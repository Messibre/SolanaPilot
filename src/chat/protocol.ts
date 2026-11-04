import { z } from "zod";
import type { WorkspaceFile } from "../fileWriter";

export const MAX_MESSAGE_TEXT_LENGTH = 100_000;

export const ChatModeSchema = z.enum(["ask", "agent"]);

export const AskMessageSchema = z
  .object({
    type: z.literal("ask"),
    text: z.string().max(MAX_MESSAGE_TEXT_LENGTH),
    mode: ChatModeSchema,
  })
  .strict();

export const RerunMessageSchema = z
  .object({
    type: z.literal("rerun"),
    text: z.string().max(MAX_MESSAGE_TEXT_LENGTH),
    mode: ChatModeSchema,
  })
  .strict();

export const ShowDraftMessageSchema = z
  .object({
    type: z.literal("showDraft"),
    text: z.string().max(MAX_MESSAGE_TEXT_LENGTH),
  })
  .strict();

export const InsertCodeMessageSchema = z
  .object({
    type: z.literal("insertCode"),
    code: z.string().max(MAX_MESSAGE_TEXT_LENGTH),
  })
  .strict();

export const WorkspacePreviewChoiceMessageSchema = z
  .object({
    type: z.literal("workspacePreviewChoice"),
    previewId: z.string().min(1).max(256),
    choice: z.enum(["write", "cancel"]),
  })
  .strict();

export const WorkspacePreviewDiffMessageSchema = z
  .object({
    type: z.literal("workspacePreviewDiff"),
    previewId: z.string().min(1).max(256),
  })
  .strict();

export const ClearHistoryMessageSchema = z
  .object({
    type: z.literal("clearHistory"),
  })
  .strict();

export const IncomingWebviewMessageSchema = z.discriminatedUnion("type", [
  AskMessageSchema,
  RerunMessageSchema,
  ShowDraftMessageSchema,
  InsertCodeMessageSchema,
  WorkspacePreviewChoiceMessageSchema,
  WorkspacePreviewDiffMessageSchema,
  ClearHistoryMessageSchema,
]);

export type IncomingWebviewMessage = z.infer<
  typeof IncomingWebviewMessageSchema
>;

export function parseIncomingWebviewMessage(
  data: unknown,
): IncomingWebviewMessage {
  return IncomingWebviewMessageSchema.parse(data);
}

export function safeParseIncomingWebviewMessage(data: unknown) {
  return IncomingWebviewMessageSchema.safeParse(data);
}

export interface WebviewOutgoingMessage {
  type:
    | "thinking"
    | "response"
    | "error"
    | "insertCode"
    | "modeSuggestion"
    | "workspacePreview";
  text?: string;
  originalPrompt?: string;
  mode?: "ask" | "agent";
  previewId?: string;
  files?: WorkspaceFile[];
}

