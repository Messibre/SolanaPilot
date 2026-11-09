import type { ChatMode } from "../types";

export function isWorkspaceChangeRequest(userMessage: string): boolean {
  const text = userMessage.toLowerCase();
  const explanatoryLead = /^(what|why|how|when|where|who|is|are|do|does|did)\b/;
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

export function buildModePrompt(userMessage: string, mode: ChatMode): string {
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

export function buildWorkspaceActionPrompt(userMessage: string): string {
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

