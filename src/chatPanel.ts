import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { callAI } from "./aiClient";
import { buildWorkspaceContext } from "./contextBuilder";
import {
  getWorkspaceRoot,
  openFileInEditor,
  resolveWorkspacePath,
  type WorkspaceFile,
  writeFilesToWorkspace,
} from "./fileWriter";
import { TerminalRunner } from "./terminalRunner";

type ChatMode = "ask" | "agent";

interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
}

type ChatWebviewMessage =
  | { type: "ask"; text: string; mode: ChatMode }
  | { type: "rerun"; text: string; mode: ChatMode }
  | { type: "showDraft"; text: string }
  | { type: "insertCode"; code: string }
  | {
      type: "workspacePreviewChoice";
      previewId: string;
      choice: "write" | "cancel";
    }
  | { type: "workspacePreviewDiff"; previewId: string }
  | { type: "clearHistory" };

interface WebviewOutgoingMessage {
  type:
    | "thinking"
    | "response"
    | "error"
    | "insertCode"
    | "modeSuggestion"
    | "workspacePreview";
  text?: string;
  originalPrompt?: string;
  mode?: ChatMode;
  previewId?: string;
  files?: WorkspaceFile[];
}

interface WorkspaceUpdateResponse {
  type?: string;
  summary?: string;
  files?: WorkspaceFile[];
  notes?: string[];
  openFile?: string;
}

export class ChatPanel {
  private panel: vscode.WebviewPanel;
  private conversationHistory: ConversationEntry[] = [];
  private pendingWorkspacePreviewError: string | undefined;
  private pendingWorkspacePreview:
    | {
        previewId: string;
        workspaceRoot: string;
        files: WorkspaceFile[];
        parsed: WorkspaceUpdateResponse;
        resolve: (confirmed: boolean) => void;
      }
    | undefined;

  private static instance: ChatPanel | undefined;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      "solanaCopilot",
      "SolanaPilot",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const htmlPath = path.join(
      context.extensionPath,
      "src",
      "webview",
      "chat.html",
    );
    try {
      this.panel.webview.html = this.getWebviewHtml(
        this.panel.webview,
        htmlPath,
      );
    } catch (error) {
      console.error("[SolanaPilot] Error loading chat.html:", error);
      this.panel.webview.html = "<h1>Error loading chat interface</h1>";
    }

    this.setupMessageHandler();

    this.panel.onDidDispose(() => {
      ChatPanel.instance = undefined;
    });
  }

  public static createOrShow(context: vscode.ExtensionContext): ChatPanel {
    if (ChatPanel.instance) {
      ChatPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return ChatPanel.instance;
    }

    ChatPanel.instance = new ChatPanel(context);
    return ChatPanel.instance;
  }

  private setupMessageHandler(): void {
    this.panel.webview.onDidReceiveMessage(
      async (message: ChatWebviewMessage) => {
        try {
          switch (message.type) {
            case "ask":
              await this.handleChatMessage(message.text, message.mode, true);
              break;
            case "rerun":
              await this.handleChatMessage(message.text, message.mode, false);
              break;
            case "showDraft":
              await this.handleShowDraftMessage(message.text);
              break;
            case "insertCode":
              await this.handleInsertCodeMessage(message.code);
              break;
            case "workspacePreviewChoice":
              await this.handleWorkspacePreviewChoice(
                message.previewId,
                message.choice,
              );
              break;
            case "workspacePreviewDiff":
              await this.handleWorkspacePreviewDiff(message.previewId);
              break;
            case "clearHistory":
              this.conversationHistory = [];
              break;
          }
        } catch (error) {
          console.error("[SolanaPilot] Error handling message:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.sendToWebview({ type: "error", text: errorMessage });
        }
      },
    );
  }

  private getWebviewHtml(webview: vscode.Webview, htmlPath: string): string {
    const rawHtml = fs.readFileSync(htmlPath, "utf8");
    const nonce = this.createNonce();

    return rawHtml
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{nonce}}", nonce);
  }

  private createNonce(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";

    for (let index = 0; index < 32; index++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return nonce;
  }

  private async handleChatMessage(
    userMessage: string,
    mode: ChatMode,
    recordUserMessage: boolean,
  ): Promise<void> {
    const normalizedMessage = userMessage.trim();
    if (!normalizedMessage) {
      return;
    }

    this.sendToWebview({
      type: "thinking",
      text:
        mode === "agent" &&
        (this.isWorkspaceChangeRequest(normalizedMessage) ||
          this.isDeployRequest(normalizedMessage))
          ? "Agent mode is preparing a workspace action..."
          : "SolanaPilot is thinking...",
    });

    if (recordUserMessage) {
      this.pushConversationEntry({
        role: "user",
        content: normalizedMessage,
        mode,
      });
    }

    if (
      mode === "ask" &&
      (this.isWorkspaceChangeRequest(normalizedMessage) ||
        this.isDeployRequest(normalizedMessage))
    ) {
      const explanation =
        "This request needs workspace changes or terminal actions. Ask mode stays read-only. Switch to Agent to let me write files or deploy, or choose Show Draft Here for a safe explanation-first response.";

      this.pushConversationEntry({
        role: "assistant",
        content: explanation,
        mode,
      });

      this.sendToWebview({
        type: "modeSuggestion",
        text: explanation,
        originalPrompt: normalizedMessage,
        mode: "ask",
      });
      return;
    }

    if (mode === "agent" && this.isDeployRequest(normalizedMessage)) {
      await this.handleDeployRequest(normalizedMessage);
      return;
    }

    if (mode === "agent" && this.isWorkspaceChangeRequest(normalizedMessage)) {
      await this.handleAgentWorkspaceAction(normalizedMessage);
      return;
    }

    await this.handleConversationalReply(normalizedMessage, mode);
  }

  private async handleConversationalReply(
    userMessage: string,
    mode: ChatMode,
  ): Promise<void> {
    try {
      const fullContext = await this.buildChatContext();
      const prompt = this.buildModePrompt(userMessage, mode);
      const aiResponse = await callAI(prompt, fullContext, false);

      this.pushConversationEntry({
        role: "assistant",
        content: aiResponse,
        mode,
      });

      this.sendToWebview({
        type: "response",
        text: aiResponse,
        mode,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to reach AI. Check your API key and network connection.";
      this.sendToWebview({
        type: "error",
        text: errorMessage,
      });
    }
  }

  private async handleShowDraftMessage(originalPrompt: string): Promise<void> {
    this.sendToWebview({
      type: "thinking",
      text: "Drafting a safe plan without touching the workspace...",
    });

    try {
      const fullContext = await this.buildChatContext();
      const draftPrompt = [
        "You are in Ask mode.",
        "The user requested a workspace-changing action, but Ask mode must remain read-only.",
        "Explain what you would change, which files you would touch, and include short code snippets if useful.",
        "Do not claim that files were written or commands were run.",
        `User request: ${originalPrompt}`,
      ].join("\n");

      const aiResponse = await callAI(draftPrompt, fullContext, false);

      this.pushConversationEntry({
        role: "assistant",
        content: aiResponse,
        mode: "ask",
      });

      this.sendToWebview({
        type: "response",
        text: aiResponse,
        mode: "ask",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to build draft response.";
      this.sendToWebview({
        type: "error",
        text: errorMessage,
      });
    }
  }

  private async handleAgentWorkspaceAction(userMessage: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      const errorMessage =
        "Open a workspace folder first so Agent mode has somewhere to write files.";
      this.pushConversationEntry({
        role: "assistant",
        content: errorMessage,
        mode: "agent",
      });
      this.sendToWebview({ type: "error", text: errorMessage });
      return;
    }

    try {
      const fullContext = await this.buildChatContext();
      const agentPrompt = this.buildWorkspaceActionPrompt(userMessage);
      const rawResponse = await callAI(agentPrompt, fullContext, true);
      const parsed = this.parseWorkspaceUpdateResponse(rawResponse);

      if (!parsed.files || parsed.files.length === 0) {
        throw new Error("Agent mode did not return any files to write.");
      }

      const confirmed = await this.requestWorkspacePreview(
        workspaceRoot,
        parsed,
      );
      if (!confirmed) {
        if (this.pendingWorkspacePreviewError) {
          const errorMessage = this.pendingWorkspacePreviewError;
          this.pendingWorkspacePreviewError = undefined;
          throw new Error(errorMessage);
        }

        const cancelled =
          "Agent mode preview cancelled before writing any files.";
        this.pushConversationEntry({
          role: "assistant",
          content: cancelled,
          mode: "agent",
        });
        this.sendToWebview({
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
        summaryLines.push(
          "",
          "Notes:",
          ...parsed.notes.map((note) => `- ${note}`),
        );
      }

      if (this.shouldMentionDeployFollowUp(userMessage)) {
        summaryLines.push(
          "",
          "If you want the devnet deploy next, ask me to deploy in Agent mode.",
        );
      }

      const responseText = summaryLines.join("\n");
      this.pushConversationEntry({
        role: "assistant",
        content: responseText,
        mode: "agent",
      });

      this.sendToWebview({
        type: "response",
        text: responseText,
        mode: "agent",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Agent mode failed to update the workspace.";
      this.pushConversationEntry({
        role: "assistant",
        content: errorMessage,
        mode: "agent",
      });
      this.sendToWebview({
        type: "error",
        text: errorMessage,
      });
    }
  }

  private async handleDeployRequest(userMessage: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      const errorMessage =
        "Open a workspace folder first so Agent mode knows what to deploy.";
      this.pushConversationEntry({
        role: "assistant",
        content: errorMessage,
        mode: "agent",
      });
      this.sendToWebview({ type: "error", text: errorMessage });
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
      this.pushConversationEntry({
        role: "assistant",
        content: cancelled,
        mode: "agent",
      });
      this.sendToWebview({
        type: "response",
        text: cancelled,
        mode: "agent",
      });
      return;
    }

    const runner = TerminalRunner.getInstance();
    runner.runDeploy(workspaceRoot);

    const responseText = this.buildDeployResponse(userMessage);
    this.pushConversationEntry({
      role: "assistant",
      content: responseText,
      mode: "agent",
    });
    this.sendToWebview({
      type: "response",
      text: responseText,
      mode: "agent",
    });
  }

  private async handleInsertCodeMessage(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage(
        "Please open a file first to insert code.",
      );
      return;
    }

    await editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, code);
    });

    this.sendToWebview({
      type: "insertCode",
    });
  }

  private async buildChatContext(): Promise<string> {
    const workspaceContext = await buildWorkspaceContext();
    const historyString = this.conversationHistory
      .slice(-20)
      .map(
        (entry) =>
          `${entry.role === "user" ? "User" : "Assistant"} (${entry.mode}): ${entry.content}`,
      )
      .join("\n\n");

    if (!workspaceContext) {
      return `## Recent Conversation:\n${historyString}`;
    }

    return `## Recent Conversation:\n${historyString}\n\n## Workspace Context:\n${workspaceContext}`;
  }

  private buildModePrompt(userMessage: string, mode: ChatMode): string {
    if (mode === "ask") {
      return [
        "You are in Ask mode.",
        "Answer the user clearly and helpfully.",
        "Do not claim to have edited files or run commands.",
        "If the user asks for workspace changes, tell them Agent mode is required.",
        `User request: ${userMessage}`,
      ].join("\n");
    }

    return [
      "You are in Agent mode.",
      "For this message, respond conversationally and focus on reasoning, review, or planning unless a direct workspace action is being executed by the host.",
      "Do not claim to have edited files or run commands unless the host has actually done so.",
      `User request: ${userMessage}`,
    ].join("\n");
  }

  private buildWorkspaceActionPrompt(userMessage: string): string {
    return [
      "You are SolanaPilot in Agent mode inside VS Code.",
      "The user wants workspace file changes for a Solana project.",
      "When the request is broad, create or update the most relevant files instead of only explaining the plan.",
      "If the user asks to build an app, scaffold a minimal working workspace with the main source files needed for that app.",
      "Return ONLY a valid JSON object with this exact schema:",
      "{",
      '  "type": "workspace_update",',
      '  "summary": "short summary of what changed",',
      '  "files": [',
      '    { "path": "relative/path.ext", "content": "full file contents" }',
      "  ],",
      '  "notes": ["optional note", "optional note"],',
      '  "openFile": "optional/relative/path.ext"',
      "}",
      "Rules:",
      "- Return JSON only. No markdown fences and no prose before or after.",
      "- Every file entry must contain the full final file contents, not a diff.",
      "- Paths must be relative to the workspace root.",
      "- Prefer focused updates. Only touch files that are necessary.",
      "- If the user is generating a new Anchor program, include the required workspace files such as Anchor.toml, Cargo.toml, program Cargo.toml, lib.rs, and a basic test file when needed.",
      "- If the user is improving existing code, update only the files required for that improvement.",
      "- Keep the output compilable and Solana-specific.",
      `User request: ${userMessage}`,
    ].join("\n");
  }

  private extractJsonObject(raw: string): string {
    const cleaned = raw.trim();
    const startIndex = cleaned.indexOf("{");
    if (startIndex === -1) {
      throw new Error("Agent mode did not return valid JSON.");
    }

    let inString = false;
    let escaped = false;
    let depth = 0;

    for (let index = startIndex; index < cleaned.length; index++) {
      const char = cleaned[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
        continue;
      }

      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return cleaned.slice(startIndex, index + 1);
        }
      }
    }

    return cleaned.slice(startIndex);
  }

  private repairJsonText(rawJson: string): string {
    let inString = false;
    let escaped = false;
    let repaired = "";

    for (let index = 0; index < rawJson.length; index++) {
      const char = rawJson[index];

      if (inString) {
        if (escaped) {
          repaired += char;
          escaped = false;
          continue;
        }

        if (char === "\\") {
          repaired += char;
          escaped = true;
          continue;
        }

        if (char === '"') {
          repaired += char;
          inString = false;
          continue;
        }

        if (char === "\n") {
          repaired += "\\n";
          continue;
        }

        if (char === "\r") {
          repaired += "\\r";
          continue;
        }

        if (char === "\t") {
          repaired += "\\t";
          continue;
        }

        repaired += char;
        continue;
      }

      if (char === '"') {
        inString = true;
        repaired += char;
        continue;
      }

      repaired += char;
    }

    return repaired;
  }

  private closeIncompleteJsonObject(rawJson: string): string {
    let inString = false;
    let escaped = false;
    let openBraces = 0;
    let completed = "";

    for (let index = 0; index < rawJson.length; index++) {
      const char = rawJson[index];

      if (inString) {
        completed += char;

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      completed += char;

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        openBraces += 1;
        continue;
      }

      if (char === "}") {
        openBraces = Math.max(0, openBraces - 1);
      }
    }

    if (inString) {
      completed += '"';
    }

    while (openBraces > 0) {
      completed += "}";
      openBraces -= 1;
    }

    return completed;
  }

  private parseWorkspaceUpdateResponse(raw: string): WorkspaceUpdateResponse {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }

    const slice = this.extractJsonObject(cleaned);

    let parsed: unknown;
    try {
      parsed = JSON.parse(slice) as unknown;
    } catch (err) {
      // Try to repair common issue: AI included raw control characters in string values.
      try {
        const repaired = this.repairJsonText(slice);
        const completed = this.closeIncompleteJsonObject(repaired);
        parsed = JSON.parse(completed) as unknown;
      } catch (err2) {
        throw new Error(
          `Agent mode returned malformed JSON and automatic repair failed. ${err instanceof Error ? err.message : String(err)}; ${err2 instanceof Error ? err2.message : String(err2)}`,
        );
      }
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Agent mode response must be a JSON object.");
    }

    const response = parsed as Record<string, unknown>;

    if (response.type !== "workspace_update") {
      throw new Error(
        'Agent mode response must include "type": "workspace_update".',
      );
    }

    // Basic validation
    if (!Array.isArray(response.files)) {
      throw new Error("Agent mode response is missing a files array.");
    }

    const MAX_FILE_BYTES = 500_000;

    const validatedFiles: WorkspaceFile[] = [];
    for (const file of response.files) {
      if (
        !file ||
        typeof file.path !== "string" ||
        file.path.trim().length === 0
      ) {
        throw new Error("Agent mode returned invalid file entries.");
      }

      if (typeof file.content !== "string") {
        throw new Error(`File content for ${file.path} is not a string.`);
      }

      if (path.isAbsolute(file.path)) {
        throw new Error(`Refusing to write absolute file path: ${file.path}`);
      }

      const normalized = path.normalize(file.path);
      if (normalized.split(path.sep).includes("..")) {
        throw new Error(
          `Refusing to write file with path traversal segments: ${file.path}`,
        );
      }

      if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES) {
        throw new Error(
          `File too large: ${file.path} exceeds ${MAX_FILE_BYTES} bytes`,
        );
      }

      validatedFiles.push({
        path: file.path,
        content: file.content,
      });
    }

    if (response.openFile && typeof response.openFile !== "string") {
      throw new Error("Agent mode returned an invalid openFile value.");
    }

    if (
      typeof response.openFile === "string" &&
      (path.isAbsolute(response.openFile) ||
        path.normalize(response.openFile) === ".." ||
        path.normalize(response.openFile).startsWith(`..${path.sep}`))
    ) {
      throw new Error("Agent mode returned an unsafe openFile path.");
    }

    if (response.notes && !Array.isArray(response.notes)) {
      throw new Error("Agent mode returned invalid notes.");
    }

    return {
      type: "workspace_update",
      summary:
        typeof response.summary === "string" ? response.summary : undefined,
      files: validatedFiles,
      notes: Array.isArray(response.notes)
        ? response.notes.filter(
            (item): item is string => typeof item === "string",
          )
        : undefined,
      openFile:
        typeof response.openFile === "string" ? response.openFile : undefined,
    };
  }

  private async requestWorkspacePreview(
    workspaceRoot: string,
    parsed: WorkspaceUpdateResponse,
  ): Promise<boolean> {
    if (this.pendingWorkspacePreview) {
      this.pendingWorkspacePreview.resolve(false);
    }

    const previewId = this.createNonce();
    const files = parsed.files ?? [];

    this.sendToWebview({
      type: "workspacePreview",
      previewId,
      mode: "agent",
      text:
        parsed.summary ||
        `Agent prepared ${files.length} file change(s). Review them below and choose whether to write them.`,
      files,
    });

    return new Promise<boolean>((resolve) => {
      this.pendingWorkspacePreview = {
        previewId,
        workspaceRoot,
        files,
        parsed,
        resolve,
      };
    });
  }

  private async handleWorkspacePreviewChoice(
    previewId: string,
    choice: "write" | "cancel",
  ): Promise<void> {
    const pending = this.pendingWorkspacePreview;
    if (!pending || pending.previewId !== previewId) {
      return;
    }

    if (choice === "cancel") {
      this.pendingWorkspacePreview = undefined;
      this.pendingWorkspacePreviewError = undefined;
      pending.resolve(false);
      return;
    }

    try {
      const writeSucceeded = await writeFilesToWorkspace(pending.files, {
        silent: true,
      });
      if (!writeSucceeded) {
        throw new Error("SolanaPilot could not write the requested files.");
      }

      if (pending.parsed.openFile) {
        const safeOpenPath = resolveWorkspacePath(
          pending.workspaceRoot,
          pending.parsed.openFile,
        );
        await openFileInEditor(safeOpenPath);
      }

      this.pendingWorkspacePreview = undefined;
      this.pendingWorkspacePreviewError = undefined;
      pending.resolve(true);
    } catch (error) {
      this.pendingWorkspacePreview = undefined;
      this.pendingWorkspacePreviewError =
        error instanceof Error
          ? error.message
          : "Failed to write workspace files.";
      pending.resolve(false);
      const message = this.pendingWorkspacePreviewError;
      this.sendToWebview({ type: "error", text: message });
    }
  }

  private async handleWorkspacePreviewDiff(previewId: string): Promise<void> {
    const pending = this.pendingWorkspacePreview;
    if (!pending || pending.previewId !== previewId) {
      return;
    }

    const previewDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "solanapilot-preview-"),
    );
    const maxPreviewFiles = Math.min(pending.files.length, 5);

    try {
      for (let index = 0; index < maxPreviewFiles; index++) {
        const file = pending.files[index];
        const originalPath = path.resolve(
          pending.workspaceRoot,
          path.normalize(file.path),
        );
        const originalContent = fs.existsSync(originalPath)
          ? fs.readFileSync(originalPath, "utf8")
          : "";

        const safePreviewName = file.path.replace(/[\\/:*?"<>|]/g, "_");
        const originalPreviewPath = path.join(
          previewDir,
          `${index}-original-${safePreviewName}`,
        );
        const updatedPreviewPath = path.join(
          previewDir,
          `${index}-updated-${safePreviewName}`,
        );

        fs.writeFileSync(originalPreviewPath, originalContent, "utf8");
        fs.writeFileSync(updatedPreviewPath, file.content, "utf8");

        await vscode.commands.executeCommand(
          "vscode.diff",
          vscode.Uri.file(originalPreviewPath),
          vscode.Uri.file(updatedPreviewPath),
          `SolanaPilot preview: ${file.path}`,
        );
      }

      if (pending.files.length > maxPreviewFiles) {
        void vscode.window.showInformationMessage(
          `Previewed the first ${maxPreviewFiles} file(s). ${pending.files.length - maxPreviewFiles} additional file(s) are ready to write.`,
        );
      }
    } finally {
      setTimeout(() => {
        try {
          fs.rmSync(previewDir, { recursive: true, force: true });
        } catch {
          // Ignore preview cleanup failures.
        }
      }, 10_000);
    }
  }

  private pushConversationEntry(entry: ConversationEntry): void {
    this.conversationHistory.push(entry);
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  private sendToWebview(message: WebviewOutgoingMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private isWorkspaceChangeRequest(userMessage: string): boolean {
    const text = userMessage.toLowerCase();

    const explanatoryLead =
      /^(what|why|how|when|where|who|is|are|do|does|did)\b/;
    if (explanatoryLead.test(text)) {
      return false;
    }

    const patterns = [
      /\bgenerate\b/,
      /\bcreate\b/,
      /\bwrite\b/,
      /\bscaffold\b/,
      /\bbuild\b.+\b(program|contract|frontend|test|app|dapp|project|tool)\b/,
      /\bfix\b/,
      /\bupdate\b/,
      /\bmodify\b/,
      /\bchange\b/,
      /\bimprove\b/,
      /\brefactor\b/,
      /\brewrite\b/,
      /\bedit\b/,
      /\badd\b.+\b(file|instruction|account|test)\b/,
      /\bimplement\b/,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  private isDeployRequest(userMessage: string): boolean {
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

  private shouldMentionDeployFollowUp(userMessage: string): boolean {
    return /\bdeploy\b/.test(userMessage.toLowerCase());
  }

  private buildDeployResponse(userMessage: string): string {
    if (
      /\bbuild\b/.test(userMessage.toLowerCase()) &&
      !/\bdeploy\b/.test(userMessage.toLowerCase())
    ) {
      return "I started the Solana terminal flow. It will run the build and deploy steps in the integrated terminal.";
    }

    return "I started the devnet deploy flow in the SolanaPilot terminal. Watch that terminal for `anchor build`, `anchor deploy`, and the resulting Program ID.";
  }
}
