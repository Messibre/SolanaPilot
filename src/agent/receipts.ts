/**
 * Receipt definitions and terminal states for the SolanaPilot agent loop.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

export type TerminalState =
  | "success"
  | "budget_exhausted"
  | "cycle_detected"
  | "unrecoverable_tool_error"
  | "refused"
  | "cancelled";

export interface StepRecord {
  step: number;
  toolName: string;
  args: Record<string, unknown>;
  durationMs: number;
  status: "ok" | "refused" | "crashed";
  observationSummary: string;
  flaggedInjection: boolean;
}

export interface LoopReceipt {
  terminalState: TerminalState;
  reason: string;
  steps: number;
  toolNames: string[];
  totalDurationMs: number;
  tokensUsed: number;
  history: StepRecord[];
  successConditionMet: boolean;
}

