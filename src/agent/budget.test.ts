import { describe, it, expect } from "vitest";
import { BudgetTracker } from "./budget";
import { BudgetExhaustedError } from "../core/errors";

describe("agent/budget - BudgetTracker", () => {
  it("step budget trips alone when maxSteps is exceeded", () => {
    const tracker = new BudgetTracker({
      maxSteps: 3,
      maxTokens: 100_000,
      maxWallClockSec: 3600,
    });

    tracker.recordStep();
    tracker.recordStep();
    tracker.recordStep();

    expect(tracker.remaining().steps).toBe(0);

    expect(() => tracker.recordStep()).toThrow(BudgetExhaustedError);
    expect(() => tracker.recordStep()).toThrow(/Step budget exhausted/i);
  });

  it("token budget trips alone when provider usage exceeds maxTokens", () => {
    const tracker = new BudgetTracker({
      maxSteps: 100,
      maxTokens: 1000,
      maxWallClockSec: 3600,
    });

    tracker.recordTokens({ promptTokens: 300, completionTokens: 400, totalTokens: 700 });
    expect(tracker.remaining().tokens).toBe(300);

    expect(() =>
      tracker.recordTokens({ promptTokens: 200, completionTokens: 200, totalTokens: 400 })
    ).toThrow(BudgetExhaustedError);
    expect(() =>
      tracker.recordTokens({ promptTokens: 200, completionTokens: 200, totalTokens: 400 })
    ).toThrow(/Token budget exhausted/i);
  });

  it("token budget trips alone using conservative fallback when provider usage is missing", () => {
    const tracker = new BudgetTracker({
      maxSteps: 100,
      maxTokens: 100,
      maxWallClockSec: 3600,
    });

    // 400 chars conservatively estimated at 4 chars/token = 100 tokens
    tracker.recordTokens(undefined, "a".repeat(320)); // ~80 tokens
    expect(tracker.remaining().tokens).toBe(20);

    // Another 120 chars = ~30 tokens, total 110 > 100
    expect(() => tracker.recordTokens(undefined, "b".repeat(120))).toThrow(BudgetExhaustedError);
  });

  it("wall-clock budget trips alone after elapsed time exceeds limit", () => {
    let mockTime = 1_000_000;
    const tracker = new BudgetTracker(
      {
        maxSteps: 100,
        maxTokens: 100_000,
        maxWallClockSec: 60,
      },
      { now: () => mockTime }
    );

    mockTime += 30_000; // 30 seconds elapsed
    expect(tracker.remaining().wallClockSec).toBe(30);
    tracker.checkWallClock();

    mockTime += 31_000; // 61 seconds total elapsed
    expect(tracker.remaining().wallClockSec).toBe(0);
    expect(() => tracker.checkWallClock()).toThrow(BudgetExhaustedError);
    expect(() => tracker.checkWallClock()).toThrow(/Wall-clock budget exhausted/i);
  });

  it("calls-per-hour budget trips alone on sliding window exhaustion", () => {
    let mockTime = 1_000_000;
    const tracker = new BudgetTracker(
      {
        maxSteps: 100,
        maxTokens: 100_000,
        maxWallClockSec: 86400,
        maxCallsPerHour: 3,
      },
      { now: () => mockTime }
    );

    tracker.recordCall();
    tracker.recordCall();
    tracker.recordCall();

    expect(tracker.remaining().callsPerHour).toBe(0);
    expect(() => tracker.recordCall()).toThrow(BudgetExhaustedError);
    expect(() => tracker.recordCall()).toThrow(/Call rate budget exhausted/i);

    // Advance by 1 hour + 1 second
    mockTime += 3601 * 1000;
    // Old calls should be expired from sliding window
    expect(tracker.remaining().callsPerHour).toBe(3);
    expect(() => tracker.recordCall()).not.toThrow();
  });

  it("remaining() and getUsage() report accurate statistics across all dimensions", () => {
    let mockTime = 1_000_000;
    const tracker = new BudgetTracker(
      {
        maxSteps: 10,
        maxTokens: 1000,
        maxWallClockSec: 100,
        maxCallsPerHour: 5,
      },
      { now: () => mockTime }
    );

    tracker.recordStep();
    tracker.recordStep();
    tracker.recordTokens({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    tracker.recordCall();
    mockTime += 20_000;

    const usage = tracker.getUsage();
    expect(usage.steps).toBe(2);
    expect(usage.tokens).toBe(150);
    expect(usage.wallClockSec).toBe(20);
    expect(usage.callsPerHour).toBe(1);

    const remaining = tracker.remaining();
    expect(remaining.steps).toBe(8);
    expect(remaining.tokens).toBe(850);
    expect(remaining.wallClockSec).toBe(80);
    expect(remaining.callsPerHour).toBe(4);
  });
});
