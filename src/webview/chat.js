// Chat webview script — embedded in chat.html
// This file is just a reference; the actual code is inline in src/webview/chat.html
// Kept here for documentation purposes

/**
 * Chat.js contains:
 * - Message sending and receiving
 * - Markdown parsing (bold, code, lists)
 * - Code block rendering with Copy/Insert buttons
 * - WebviewAPI communication with extension host
 * - Loading states and error handling
 * - Quick chips for common prompts
 * - Auto-resizing textarea
 * - Toast notifications
 */

export const chatJsFeatures = {
  messageHandling: "Send/receive messages to/from extension",
  markdownParsing: "Parse inline markdown without external libraries",
  codeInsertion: "Insert code blocks directly into editor",
  autoResize: "Textarea expands with content",
  loadingState: "Animated dots while AI is thinking",
  errorHandling: "Display errors with friendly messages",
  quickActions: "Pre-filled prompts via chips",
  timestamps: "Show when each message was sent",
  copyButton: "Copy code to clipboard",
};
