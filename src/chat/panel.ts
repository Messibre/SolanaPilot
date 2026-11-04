import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { buildWorkspaceContext } from "../contextBuilder";
import { handleChatMessage } from "./handlers/ask";
import { handleShowDraft } from "./handlers/draft";
import { handleInsertCode } from "./handlers/insertCode";
import { PreviewManager } from "./handlers/preview";
import { HistoryStore } from "./history";
import {
  safeParseIncomingWebviewMessage,
  type WebviewOutgoingMessage,
} from "./protocol";

export class ChatPanel {
  private panel: vscode.WebviewPanel;
  private readonly history: HistoryStore;
  private readonly previewManager = new PreviewManager();
  private static instance: ChatPanel | undefined;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.history = new HistoryStore(() => {
      const config = vscode.workspace.getConfiguration("solanaPilot");
      return config.get<number>("maxHistoryMessages", 10);
    });

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
    this.panel.webview.onDidReceiveMessage(async (rawMessage: unknown) => {
      try {
        const parseResult = safeParseIncomingWebviewMessage(rawMessage);
        if (!parseResult.success) {
          const issueMsg = parseResult.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          this.sendToWebview({
            type: "error",
            text: `Invalid message payload: ${issueMsg}`,
          });
          return;
        }

        const message = parseResult.data;
        const sendMessage = (msg: WebviewOutgoingMessage) =>
          this.sendToWebview(msg);
        const buildContext = () => this.buildChatContext();
        const createNonce = () => this.createNonce();

        switch (message.type) {
          case "ask":
            await handleChatMessage(
              message.text,
              message.mode,
              true,
              this.history,
              this.previewManager,
              buildContext,
              createNonce,
              sendMessage,
            );
            break;
          case "rerun":
            await handleChatMessage(
              message.text,
              message.mode,
              false,
              this.history,
              this.previewManager,
              buildContext,
              createNonce,
              sendMessage,
            );
            break;
          case "showDraft":
            await handleShowDraft(
              message.text,
              this.history,
              buildContext,
              sendMessage,
            );
            break;
          case "insertCode":
            await handleInsertCode(message.code, sendMessage);
            break;
          case "workspacePreviewChoice":
            await this.previewManager.handleChoice(
              message.previewId,
              message.choice,
              sendMessage,
            );
            break;
          case "workspacePreviewDiff":
            await this.previewManager.handleDiff(message.previewId);
            break;
          case "clearHistory":
            this.history.clear();
            break;
        }
      } catch (error) {
        console.error("[SolanaPilot] Error handling message:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.sendToWebview({ type: "error", text: errorMessage });
      }
    });
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

  private async buildChatContext(): Promise<string> {
    const workspaceContext = await buildWorkspaceContext();
    const historyString = this.history.formatForPrompt();

    if (!workspaceContext) {
      return `## Recent Conversation:\n${historyString}`;
    }

    return `## Recent Conversation:\n${historyString}\n\n## Workspace Context:\n${workspaceContext}`;
  }

  private sendToWebview(message: WebviewOutgoingMessage): void {
    void this.panel.webview.postMessage(message);
  }
}

