/**
 * Legacy rate limiter adapter delegating to src/agent/budget.ts.
 * Maintained for backwards compatibility until old aiClient is retired in T-029.
 */

import { BudgetTracker } from "./agent/budget";

class RateLimiter {
  private readonly budget: BudgetTracker;
  private readonly maxCallsPerHour = 50;
  private readonly hourInMs = 3600 * 1000;
  private callTimestamps: number[] = [];

  constructor() {
    this.budget = new BudgetTracker({ maxCallsPerHour: 50 });
  }

  public checkAndRecord(): {
    allowed: boolean;
    remaining: number;
    resetAt: Date | null;
  } {
    const now = Date.now();
    const oneHourAgo = now - this.hourInMs;
    this.callTimestamps = this.callTimestamps.filter((t) => t > oneHourAgo);

    if (this.callTimestamps.length >= this.maxCallsPerHour) {
      const oldestCall = this.callTimestamps[0];
      const resetAt = new Date(oldestCall + this.hourInMs);
      return { allowed: false, remaining: 0, resetAt };
    }

    this.callTimestamps.push(now);
    try {
      this.budget.recordCall();
    } catch {
      // Ignored for legacy return shape
    }

    return {
      allowed: true,
      remaining: this.maxCallsPerHour - this.callTimestamps.length,
      resetAt: null,
    };
  }

  public getStats(): { used: number; remaining: number; resetAt: Date | null } {
    const now = Date.now();
    const oneHourAgo = now - this.hourInMs;
    this.callTimestamps = this.callTimestamps.filter((t) => t > oneHourAgo);

    const used = this.callTimestamps.length;
    const remaining = Math.max(0, this.maxCallsPerHour - used);
    const resetAt =
      this.callTimestamps.length > 0
        ? new Date(this.callTimestamps[0] + this.hourInMs)
        : null;

    return { used, remaining, resetAt };
  }

  public reset(): void {
    this.callTimestamps = [];
    this.budget.reset();
  }
}

export const rateLimiter = new RateLimiter();
