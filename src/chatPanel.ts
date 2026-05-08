import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { callAI } from "./aiClient";
import { buildWorkspaceContext } from "./contextBuilder";

/**
 * ChatPanel manages the VS Code WebviewPanel for the SolanaPilot chat interface.
 */
export class ChatPanel {
  private panel: vscode.WebviewPanel;
  private context: vscode.ExtensionContext;
  private conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  private static instance: ChatPanel | undefined;

  /**
   * Constructor — creates a new ChatPanel
   */
  private constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Create webview panel
    this.panel = vscode.window.createWebviewPanel(
      "solanaCopilot",
      "⚡ SolanaPilot",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    // Load and set HTML content
    const htmlPath = path.join(
      context.extensionPath,
      "src",
      "webview",
      "chat.html",
    );
    try {
      const htmlContent = fs.readFileSync(htmlPath, "utf8");
      this.panel.webview.html = htmlContent;
    } catch (err) {
      console.error("[SolanaPilot] Error loading chat.html:", err);
      this.panel.webview.html = "<h1>Error loading chat interface</h1>";
    }

    // Set up message handler
    this.setupMessageHandler();

    // Clean up on dispose
    this.panel.onDidDispose(() => {
      ChatPanel.instance = undefined;
    });
  }

  /**
   * Set up the webview message handler
   */
  private setupMessageHandler(): void {
    this.panel.webview.onDidReceiveMessage(async (message: any) => {
      try {
        if (message.type === "ask") {
          await this.handleAskMessage(message.text);
        } else if (message.type === "insertCode") {
          await this.handleInsertCodeMessage(message.code);
        }
      } catch (err) {
        console.error("[SolanaPilot] Error handling message:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.sendToWebview({
          type: "error",
          text: errorMessage,
        });
      }
    });
  }

  /**
   * Handle "ask" message from webview — call AI and return response
   */
  private async handleAskMessage(userMessage: string): Promise<void> {
    // Send thinking indicator
    this.sendToWebview({ type: "thinking" });

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: "user",
        content: userMessage,
      });

      // Get workspace context
      const workspaceContext = await buildWorkspaceContext();

      // Build full context with conversation history
      const historyString = this.conversationHistory
        .slice(-20) // Last 10 turns = 20 messages
        .map(
          (msg) =>
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`,
        )
        .join("\n\n");

      const fullContext = workspaceContext
        ? `## Recent Conversation:\n${historyString}\n\n## Workspace Context:\n${workspaceContext}`
        : `## Recent Conversation:\n${historyString}`;

      // Call AI with maintainHistory = true for multi-turn context
      const aiResponse = await callAI(userMessage, fullContext, false, true);

      // Add assistant response to history
      this.conversationHistory.push({
        role: "assistant",
        content: aiResponse,
      });

      // Trim history to last 10 turns (20 messages)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // Send response back to webview
      this.sendToWebview({
        type: "response",
        text: aiResponse,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to reach AI. Check your API key.";
      this.sendToWebview({
        type: "error",
        text: errorMessage,
      });
    }
  }

  /**
   * Handle "insertCode" message from webview — insert code into editor
   */
  private async handleInsertCodeMessage(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage(
        "Please open a file first to insert code",
      );
      return;
    }

    try {
      await editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, code);
      });

      // Send confirmation to webview
      this.sendToWebview({
        type: "insertCode",
      });
    } catch (err) {
      console.error("[SolanaPilot] Error inserting code:", err);
      throw err;
    }
  }

  /**
   * Send message to webview
   */
  private sendToWebview(message: any): void {
    this.panel.webview.postMessage(message);
  }

  /**
   * Create or show the ChatPanel
   * @param context Extension context
   */
  static createOrShow(context: vscode.ExtensionContext): ChatPanel {
    // If panel already exists and is visible, just reveal it
    if (ChatPanel.instance) {
      ChatPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return ChatPanel.instance;
    }

    // Create new panel
    ChatPanel.instance = new ChatPanel(context);
    return ChatPanel.instance;
  }
}
