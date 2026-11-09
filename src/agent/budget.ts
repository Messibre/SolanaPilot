/**
 * Budget enforcement module for steps, tokens, wall-clock time, and call rates.
 * Adheres strictly to Agent.md §6, §8, and §10.
 * Zero vscode imports allowed.
 */

import { BudgetExhaustedError } from "../core/errors";
import type { LlmUsage } from "../ai/types";

export interface BudgetLimits {
  maxSteps?: number;
  maxTokens?: number;
  maxWallClockSec?: number;
  maxCallsPerHour?: number;
}

export interface BudgetOptions {
  now?: () => number;
}

export interface BudgetRemaining {
  steps: number;
  tokens: number;
  wallClockSec: number;
  callsPerHour?: number;
}

export interface BudgetUsage {
  steps: number;
  tokens: number;
  wallClockSec: number;
  callsPerHour: number;
}

export class BudgetTracker {
  private readonly maxSteps: number;
  private readonly maxTokens: number;
  private readonly maxWallClockSec: number;
  private readonly maxCallsPerHour?: number;

  private readonly now: () => number;
  private readonly startTime: number;

  private usedSteps = 0;
  private usedTokens = 0;
  private callTimestamps: number[] = [];

  constructor(limits?: BudgetLimits, options?: BudgetOptions) {
    this.maxSteps = limits?.maxSteps ?? 25;
    this.maxTokens = limits?.maxTokens ?? 100_000;
    this.maxWallClockSec = limits?.maxWallClockSec ?? 300;
    this.maxCallsPerHour = limits?.maxCallsPerHour;

    this.now = options?.now ?? (() => Date.now());
    this.startTime = this.now();
  }

  public recordStep(count = 1): void {
    this.checkWallClock();
    this.usedSteps += count;

    if (this.usedSteps > this.maxSteps) {
      throw new BudgetExhaustedError(
        `Step budget exhausted: used ${this.usedSteps} of ${this.maxSteps} max steps`
      );
    }
  }

  public recordTokens(usageOrTokens?: number | LlmUsage, fallbackText?: string): void {
    this.checkWallClock();

    let tokensToAdd = 0;
    if (typeof usageOrTokens === "number") {
      tokensToAdd = usageOrTokens;
    } else if (usageOrTokens && typeof usageOrTokens === "object") {
      tokensToAdd = usageOrTokens.totalTokens ?? 0;
    } else if (fallbackText) {
      // Conservative estimate: ~4 characters per token
      tokensToAdd = Math.max(1, Math.ceil(fallbackText.length / 4));
    }

    this.usedTokens += tokensToAdd;

    if (this.usedTokens > this.maxTokens) {
      throw new BudgetExhaustedError(
        `Token budget exhausted: used ${this.usedTokens} of ${this.maxTokens} max tokens`
      );
    }
  }

  public recordCall(): void {
    this.checkWallClock();

    if (this.maxCallsPerHour !== undefined) {
      const currentTime = this.now();
      const oneHourAgo = currentTime - 3600 * 1000;
      this.callTimestamps = this.callTimestamps.filter((t) => t > oneHourAgo);

      if (this.callTimestamps.length >= this.maxCallsPerHour) {
        throw new BudgetExhaustedError(
          `Call rate budget exhausted: exceeded ${this.maxCallsPerHour} calls per hour`
        );
      }

      this.callTimestamps.push(currentTime);
    }
  }

  public checkWallClock(): void {
    const elapsedSec = (this.now() - this.startTime) / 1000;
    if (elapsedSec > this.maxWallClockSec) {
      throw new BudgetExhaustedError(
        `Wall-clock budget exhausted: elapsed ${Math.round(elapsedSec)}s exceeds ${this.maxWallClockSec}s limit`
      );
    }
  }

  public checkAll(): void {
    this.checkWallClock();

    if (this.usedSteps > this.maxSteps) {
      throw new BudgetExhaustedError(
        `Step budget exhausted: used ${this.usedSteps} of ${this.maxSteps} max steps`
      );
    }

    if (this.usedTokens > this.maxTokens) {
      throw new BudgetExhaustedError(
        `Token budget exhausted: used ${this.usedTokens} of ${this.maxTokens} max tokens`
      );
    }
  }

  public remaining(): BudgetRemaining {
    const elapsedSec = (this.now() - this.startTime) / 1000;
    const remainingWallClockSec = Math.max(0, Math.round(this.maxWallClockSec - elapsedSec));

    let remainingCalls: number | undefined;
    if (this.maxCallsPerHour !== undefined) {
      const oneHourAgo = this.now() - 3600 * 1000;
      const recentCalls = this.callTimestamps.filter((t) => t > oneHourAgo).length;
      remainingCalls = Math.max(0, this.maxCallsPerHour - recentCalls);
    }

    return {
      steps: Math.max(0, this.maxSteps - this.usedSteps),
      tokens: Math.max(0, this.maxTokens - this.usedTokens),
      wallClockSec: remainingWallClockSec,
      callsPerHour: remainingCalls,
    };
  }

  public getUsage(): BudgetUsage {
    const elapsedSec = (this.now() - this.startTime) / 1000;
    const oneHourAgo = this.now() - 3600 * 1000;
    const recentCalls = this.callTimestamps.filter((t) => t > oneHourAgo).length;

    return {
      steps: this.usedSteps,
      tokens: this.usedTokens,
      wallClockSec: Math.round(elapsedSec),
      callsPerHour: recentCalls,
    };
  }

  public reset(): void {
    this.usedSteps = 0;
    this.usedTokens = 0;
    this.callTimestamps = [];
  }
}
