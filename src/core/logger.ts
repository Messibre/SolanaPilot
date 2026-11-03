/**
 * Structured logger and span tracker for SolanaPilot.
 * Strictly adheres to Agent.md §8, §10, and §14.
 * Zero vscode imports allowed.
 */

import { redact, redactString } from "../security/redact";
import type { FailureCategory } from "./errors";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  ts: string;
  level: LogLevel;
  component: string;
  phase: string;
  spanId: string;
  parentSpanId?: string;
  durationMs?: number;
  category?: FailureCategory;
  message: string;
  data?: unknown;
}

export interface LogSink {
  emit(event: LogEvent): void;
}

export class MemoryLogSink implements LogSink {
  public readonly events: LogEvent[] = [];

  public emit(event: LogEvent): void {
    this.events.push(event);
  }

  public clear(): void {
    this.events.length = 0;
  }
}

export interface ActiveSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  component: string;
  phase: string;
  startTime: number;
}

export interface SpanOptions {
  component: string;
  phase: string;
  parentSpanId?: string;
  data?: unknown;
}

export interface Span {
  spanId: string;
  parentSpanId?: string;
  name: string;
  end: (options?: { category?: FailureCategory; data?: unknown; level?: LogLevel }) => void;
}

export interface LoggerOptions {
  sinks?: LogSink[];
  now?: () => number;
}

export class Logger {
  private readonly sinks: LogSink[];
  private readonly now: () => number;
  private readonly activeSpans = new Map<string, ActiveSpan>();
  private spanCounter = 0;

  constructor(options: LoggerOptions = {}) {
    this.sinks = options.sinks ? [...options.sinks] : [new MemoryLogSink()];
    this.now = options.now ?? (() => Date.now());
  }

  public addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  private generateSpanId(prefix = "span"): string {
    this.spanCounter += 1;
    return `${prefix}_${this.spanCounter}_${Math.random().toString(36).slice(2, 7)}`;
  }

  public log(event: {
    level: LogLevel;
    component: string;
    phase: string;
    spanId?: string;
    parentSpanId?: string;
    durationMs?: number;
    category?: FailureCategory;
    message: string;
    data?: unknown;
  }): void {
    const finalSpanId = event.spanId ?? "root";
    // Every error level log MUST carry a failure category
    const category = event.level === "error" ? (event.category ?? "internal") : event.category;

    const safeEvent: LogEvent = {
      ts: new Date(this.now()).toISOString(),
      level: event.level,
      component: event.component,
      phase: event.phase,
      spanId: finalSpanId,
      parentSpanId: event.parentSpanId,
      durationMs: event.durationMs,
      category,
      message: redactString(event.message),
      data: event.data !== undefined ? redact(event.data) : undefined,
    };

    for (const sink of this.sinks) {
      try {
        sink.emit(safeEvent);
      } catch {
        // Sinks must never crash the logger
      }
    }
  }

  public debug(component: string, phase: string, message: string, data?: unknown, spanId?: string): void {
    this.log({ level: "debug", component, phase, message, data, spanId });
  }

  public info(component: string, phase: string, message: string, data?: unknown, spanId?: string): void {
    this.log({ level: "info", component, phase, message, data, spanId });
  }

  public warn(component: string, phase: string, message: string, data?: unknown, spanId?: string): void {
    this.log({ level: "warn", component, phase, message, data, spanId });
  }

  public error(
    component: string,
    phase: string,
    message: string,
    category: FailureCategory,
    data?: unknown,
    spanId?: string,
  ): void {
    this.log({ level: "error", component, phase, message, category, data, spanId });
  }

  public startSpan(name: string, options: SpanOptions): Span {
    const spanId = this.generateSpanId(name.replace(/[^a-zA-Z0-9_-]/g, ""));
    const startTime = this.now();

    const activeSpan: ActiveSpan = {
      spanId,
      parentSpanId: options.parentSpanId,
      name,
      component: options.component,
      phase: options.phase,
      startTime,
    };

    this.activeSpans.set(spanId, activeSpan);

    this.log({
      level: "debug",
      component: options.component,
      phase: options.phase,
      spanId,
      parentSpanId: options.parentSpanId,
      message: `Started span: ${name}`,
      data: options.data,
    });

    return {
      spanId,
      parentSpanId: options.parentSpanId,
      name,
      end: (endOpts) => {
        this.endSpan(spanId, endOpts);
      },
    };
  }

  public endSpan(
    spanId: string,
    options?: {
      category?: FailureCategory;
      data?: unknown;
      level?: LogLevel;
    },
  ): void {
    const active = this.activeSpans.get(spanId);
    if (!active) {
      return;
    }

    this.activeSpans.delete(spanId);
    const durationMs = this.now() - active.startTime;
    const level = options?.level ?? (options?.category ? "error" : "info");

    this.log({
      level,
      component: active.component,
      phase: active.phase,
      spanId: active.spanId,
      parentSpanId: active.parentSpanId,
      durationMs,
      category: options?.category,
      message: `Ended span: ${active.name}`,
      data: options?.data,
    });
  }

  /**
   * Reports any active spans that were never ended.
   */
  public verifySpans(): ActiveSpan[] {
    return Array.from(this.activeSpans.values());
  }
}

export const defaultLogger = new Logger();
