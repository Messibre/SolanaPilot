/**
 * Pipeline state graph and transition engine for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { SolanaPilotError } from "../core/errors";

export type PipelineStage =
  | "PLAN"
  | "GENERATE"
  | "VALIDATE"
  | "WRITE"
  | "BUILD"
  | "FIX"
  | "TEST"
  | "REVIEW"
  | "AWAIT_DEPLOY_CONFIRM"
  | "DEPLOY"
  | "REGISTER"
  | "DONE"
  | "FAILED"
  | "CANCELLED";

export const ALL_PIPELINE_STAGES: readonly PipelineStage[] = [
  "PLAN",
  "GENERATE",
  "VALIDATE",
  "WRITE",
  "BUILD",
  "FIX",
  "TEST",
  "REVIEW",
  "AWAIT_DEPLOY_CONFIRM",
  "DEPLOY",
  "REGISTER",
  "DONE",
  "FAILED",
  "CANCELLED",
] as const;

export const TERMINAL_STAGES: readonly PipelineStage[] = [
  "DONE",
  "FAILED",
  "CANCELLED",
] as const;

export class PipelineTransitionError extends SolanaPilotError {
  public readonly from: PipelineStage;
  public readonly to: PipelineStage;

  constructor(from: PipelineStage, to: PipelineStage, detail?: string) {
    const userMessage = `Illegal pipeline transition from ${from} to ${to}${
      detail ? `: ${detail}` : ""
    }`;
    super({
      category: "internal",
      userMessage,
      retryable: false,
    });
    this.name = "PipelineTransitionError";
    this.from = from;
    this.to = to;
  }
}

export interface TransitionRecord {
  from: PipelineStage;
  to: PipelineStage;
  timestamp: number;
  reason?: string;
}

export interface SerializedPipelineState {
  id: string;
  stage: PipelineStage;
  fixCount: number;
  maxFixes: number;
  history: TransitionRecord[];
  context: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export const MAX_FIX_CYCLES = 3;

/**
 * Standard progression map defining legal forward transitions.
 */
const BASE_FORWARD_TRANSITIONS: Record<PipelineStage, readonly PipelineStage[]> = {
  PLAN: ["GENERATE"],
  GENERATE: ["VALIDATE"],
  VALIDATE: ["WRITE"],
  WRITE: ["BUILD"],
  BUILD: ["TEST", "FIX"],
  FIX: ["BUILD"],
  TEST: ["REVIEW"],
  REVIEW: ["AWAIT_DEPLOY_CONFIRM"],
  AWAIT_DEPLOY_CONFIRM: ["DEPLOY", "DONE"],
  DEPLOY: ["REGISTER"],
  REGISTER: ["DONE"],
  DONE: [],
  FAILED: [],
  CANCELLED: [],
};

export class PipelineMachine {
  private readonly id: string;
  private currentStage: PipelineStage;
  private fixCount: number;
  private readonly maxFixes: number;
  private readonly history: TransitionRecord[] = [];
  private readonly context: Record<string, unknown>;
  private readonly createdAt: number;
  private updatedAt: number;

  constructor(options?: {
    id?: string;
    initialStage?: PipelineStage;
    fixCount?: number;
    maxFixes?: number;
    context?: Record<string, unknown>;
    history?: TransitionRecord[];
    createdAt?: number;
    updatedAt?: number;
  }) {
    this.id = options?.id ?? `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.currentStage = options?.initialStage ?? "PLAN";
    this.fixCount = options?.fixCount ?? 0;
    this.maxFixes = options?.maxFixes ?? MAX_FIX_CYCLES;
    this.context = { ...(options?.context ?? {}) };
    this.createdAt = options?.createdAt ?? Date.now();
    this.updatedAt = options?.updatedAt ?? this.createdAt;

    if (options?.history) {
      this.history = [...options.history];
    }
  }

  public getId(): string {
    return this.id;
  }

  public getStage(): PipelineStage {
    return this.currentStage;
  }

  public getFixCount(): number {
    return this.fixCount;
  }

  public getMaxFixes(): number {
    return this.maxFixes;
  }

  public getHistory(): readonly TransitionRecord[] {
    return this.history;
  }

  public getContext(): Readonly<Record<string, unknown>> {
    return this.context;
  }

  public setContextValue(key: string, value: unknown): void {
    this.context[key] = value;
    this.updatedAt = Date.now();
  }

  public isTerminal(): boolean {
    return TERMINAL_STAGES.includes(this.currentStage);
  }

  /**
   * Returns list of legal next stages from the current stage.
   */
  public getLegalNextStages(): PipelineStage[] {
    if (this.isTerminal()) {
      return [];
    }

    const forward = BASE_FORWARD_TRANSITIONS[this.currentStage] || [];
    const legal: PipelineStage[] = [];

    for (const target of forward) {
      if (this.currentStage === "BUILD" && target === "FIX") {
        if (this.fixCount < this.maxFixes) {
          legal.push("FIX");
        }
      } else {
        legal.push(target);
      }
    }

    // FAILED and CANCELLED are reachable from any non-terminal state
    legal.push("FAILED", "CANCELLED");

    return legal;
  }

  /**
   * Checks whether a transition to target stage is permitted.
   */
  public canTransitionTo(target: PipelineStage): boolean {
    return this.getLegalNextStages().includes(target);
  }

  /**
   * Performs transition to nextStage, throwing typed PipelineTransitionError if illegal.
   */
  public transitionTo(nextStage: PipelineStage, reason?: string): void {
    if (!this.canTransitionTo(nextStage)) {
      if (this.isTerminal()) {
        throw new PipelineTransitionError(
          this.currentStage,
          nextStage,
          `Cannot transition from terminal state ${this.currentStage}`
        );
      }
      if (this.currentStage === "BUILD" && nextStage === "FIX" && this.fixCount >= this.maxFixes) {
        throw new PipelineTransitionError(
          this.currentStage,
          nextStage,
          `Maximum fix cycles (${this.maxFixes}) exceeded. Must transition to FAILED.`
        );
      }
      throw new PipelineTransitionError(
        this.currentStage,
        nextStage,
        `Stage ${nextStage} is not a valid successor for ${this.currentStage}`
      );
    }

    const previousStage = this.currentStage;

    // Track fix iterations
    if (previousStage === "BUILD" && nextStage === "FIX") {
      this.fixCount++;
    }

    this.currentStage = nextStage;
    this.updatedAt = Date.now();

    this.history.push({
      from: previousStage,
      to: nextStage,
      timestamp: this.updatedAt,
      reason,
    });
  }

  /**
   * Serializes current pipeline machine state into JSON string.
   */
  public toJSON(): string {
    const data: SerializedPipelineState = {
      id: this.id,
      stage: this.currentStage,
      fixCount: this.fixCount,
      maxFixes: this.maxFixes,
      history: this.history,
      context: this.context,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Rehydrates a pipeline machine from a serialized JSON representation.
   */
  public static fromJSON(jsonString: string): PipelineMachine {
    let parsed: SerializedPipelineState;
    try {
      parsed = JSON.parse(jsonString) as SerializedPipelineState;
    } catch (err: unknown) {
      throw new Error(`Invalid pipeline JSON: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!parsed || !parsed.stage || !ALL_PIPELINE_STAGES.includes(parsed.stage)) {
      throw new Error(`Serialized pipeline contains invalid or missing stage: ${parsed?.stage}`);
    }

    return new PipelineMachine({
      id: parsed.id,
      initialStage: parsed.stage,
      fixCount: parsed.fixCount,
      maxFixes: parsed.maxFixes,
      context: parsed.context,
      history: parsed.history,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    });
  }
}

