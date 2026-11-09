import type { WorkspaceFile } from "../fileWriter";

export type ChatMode = "ask" | "agent";

export interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
}

export interface WorkspaceUpdateResponse {
  type?: string;
  summary?: string;
  files?: WorkspaceFile[];
  notes?: string[];
  openFile?: string;
}

export interface PendingWorkspacePreview {
  previewId: string;
  workspaceRoot: string;
  files: WorkspaceFile[];
  parsed: WorkspaceUpdateResponse;
  resolve: (confirmed: boolean) => void;
}

