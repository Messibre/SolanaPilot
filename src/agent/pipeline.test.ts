/**
 * Unit tests for pipeline state machine and transition table.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import { describe, expect, it } from "vitest";
import {
  ALL_PIPELINE_STAGES,
  PipelineMachine,
  PipelineStage,
  PipelineTransitionError,
  TERMINAL_STAGES,
} from "./pipeline";

/**
 * Helper returning the set of legal transitions for a given stage (with fixCount=0).
 */
function getExpectedLegalTransitions(from: PipelineStage, fixCount = 0): Set<PipelineStage> {
  if (TERMINAL_STAGES.includes(from)) {
    return new Set<PipelineStage>();
  }

  const result = new Set<PipelineStage>(["FAILED", "CANCELLED"]);

  switch (from) {
    case "PLAN":
      result.add("GENERATE");
      break;
    case "GENERATE":
      result.add("VALIDATE");
      break;
    case "VALIDATE":
      result.add("WRITE");
      break;
    case "WRITE":
      result.add("BUILD");
      break;
    case "BUILD":
      result.add("TEST");
      if (fixCount < 3) {
        result.add("FIX");
      }
      break;
    case "FIX":
      result.add("BUILD");
      break;
    case "TEST":
      result.add("REVIEW");
      break;
    case "REVIEW":
      result.add("AWAIT_DEPLOY_CONFIRM");
      break;
    case "AWAIT_DEPLOY_CONFIRM":
      result.add("DEPLOY");
      result.add("DONE");
      break;
    case "DEPLOY":
      result.add("REGISTER");
      break;
    case "REGISTER":
      result.add("DONE");
      break;
  }

  return result;
}

describe("Pipeline State Graph - Exhaustive Transition Enumeration", () => {
  it("verifies all NxN pairs: accepts every legal transition and rejects every illegal transition", () => {
    let testedPairs = 0;

    for (const from of ALL_PIPELINE_STAGES) {
      const legalTargets = getExpectedLegalTransitions(from, 0);

      for (const to of ALL_PIPELINE_STAGES) {
        testedPairs++;
        const machine = new PipelineMachine({ initialStage: from });
        const shouldBeLegal = legalTargets.has(to);

        if (shouldBeLegal) {
          expect(
            machine.canTransitionTo(to),
            `Stage ${from} should be allowed to transition to ${to}`
          ).toBe(true);

          expect(() => {
            machine.transitionTo(to, "test transition");
          }).not.toThrow();

          expect(machine.getStage()).toBe(to);
        } else {
          expect(
            machine.canTransitionTo(to),
            `Stage ${from} should NOT be allowed to transition to ${to}`
          ).toBe(false);

          expect(() => {
            machine.transitionTo(to, "illegal transition");
          }).toThrow(PipelineTransitionError);

          // State must remain unchanged
          expect(machine.getStage()).toBe(from);
        }
      }
    }

    // 14 stages * 14 stages = 196 transition pairs tested
    expect(testedPairs).toBe(196);
  });
});

describe("Pipeline State Graph - Bounded Fix Loop (Max 3 Fixes)", () => {
  it("permits exactly 3 fix iterations and rejects the 4th attempt", () => {
    const machine = new PipelineMachine({ initialStage: "BUILD" });
    expect(machine.getFixCount()).toBe(0);

    // Iteration 1: BUILD -> FIX -> BUILD
    machine.transitionTo("FIX", "Compiler error 1");
    expect(machine.getFixCount()).toBe(1);
    expect(machine.getStage()).toBe("FIX");
    machine.transitionTo("BUILD", "Rebuilding after patch 1");
    expect(machine.getStage()).toBe("BUILD");

    // Iteration 2: BUILD -> FIX -> BUILD
    machine.transitionTo("FIX", "Compiler error 2");
    expect(machine.getFixCount()).toBe(2);
    expect(machine.getStage()).toBe("FIX");
    machine.transitionTo("BUILD", "Rebuilding after patch 2");
    expect(machine.getStage()).toBe("BUILD");

    // Iteration 3: BUILD -> FIX -> BUILD
    machine.transitionTo("FIX", "Compiler error 3");
    expect(machine.getFixCount()).toBe(3);
    expect(machine.getStage()).toBe("FIX");
    machine.transitionTo("BUILD", "Rebuilding after patch 3");
    expect(machine.getStage()).toBe("BUILD");

    // Attempt 4: BUILD -> FIX should be rejected because max 3 fixes reached
    expect(machine.canTransitionTo("FIX")).toBe(false);
    expect(() => {
      machine.transitionTo("FIX", "Compiler error 4");
    }).toThrow(PipelineTransitionError);

    // Must transition to FAILED
    expect(machine.canTransitionTo("FAILED")).toBe(true);
    machine.transitionTo("FAILED", "Fix attempts exhausted");
    expect(machine.getStage()).toBe("FAILED");
    expect(machine.isTerminal()).toBe(true);
  });
});

describe("Pipeline State Graph - Reachability & Terminal State Invariants", () => {
  it("guarantees every non-terminal state has declared paths to a terminal state", () => {
    for (const stage of ALL_PIPELINE_STAGES) {
      if (TERMINAL_STAGES.includes(stage)) {
        continue;
      }
      const machine = new PipelineMachine({ initialStage: stage });
      const nextStages = machine.getLegalNextStages();

      // Direct failure & cancellation paths
      expect(nextStages).toContain("FAILED");
      expect(nextStages).toContain("CANCELLED");
      expect(nextStages.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("ensures happy path traverses from PLAN to DONE in correct order", () => {
    const machine = new PipelineMachine({ initialStage: "PLAN" });

    const happyPath: PipelineStage[] = [
      "GENERATE",
      "VALIDATE",
      "WRITE",
      "BUILD",
      "TEST",
      "REVIEW",
      "AWAIT_DEPLOY_CONFIRM",
      "DEPLOY",
      "REGISTER",
      "DONE",
    ];

    for (const target of happyPath) {
      machine.transitionTo(target);
      expect(machine.getStage()).toBe(target);
    }

    expect(machine.isTerminal()).toBe(true);
    expect(machine.getHistory().length).toBe(10);
  });

  it("ensures skip-deployment path is legal from AWAIT_DEPLOY_CONFIRM to DONE", () => {
    const machine = new PipelineMachine({ initialStage: "AWAIT_DEPLOY_CONFIRM" });
    expect(machine.canTransitionTo("DONE")).toBe(true);
    machine.transitionTo("DONE", "User opted to skip devnet deployment");
    expect(machine.getStage()).toBe("DONE");
  });

  it("rejects transitions from terminal states", () => {
    for (const term of TERMINAL_STAGES) {
      const machine = new PipelineMachine({ initialStage: term });
      expect(machine.isTerminal()).toBe(true);
      expect(machine.getLegalNextStages()).toHaveLength(0);

      expect(() => {
        machine.transitionTo("PLAN");
      }).toThrow(PipelineTransitionError);
    }
  });
});

describe("Pipeline State Graph - Serialization and Resumption", () => {
  it("serializes to JSON and rehydrates with preserved state, history, and context", () => {
    const machine = new PipelineMachine({ initialStage: "PLAN" });
    machine.setContextValue("programName", "counter_escrow");
    machine.setContextValue("author", "SolanaPilot");

    machine.transitionTo("GENERATE", "Plan approved");
    machine.transitionTo("VALIDATE", "Code produced");
    machine.transitionTo("WRITE", "Valid schema");

    const json = machine.toJSON();
    const restored = PipelineMachine.fromJSON(json);

    expect(restored.getId()).toBe(machine.getId());
    expect(restored.getStage()).toBe("WRITE");
    expect(restored.getContext()).toEqual(machine.getContext());
    expect(restored.getHistory().length).toBe(3);
    expect(restored.getHistory()[0].from).toBe("PLAN");
    expect(restored.getHistory()[0].to).toBe("GENERATE");

    // Restored machine can continue transitioning
    restored.transitionTo("BUILD", "Files written");
    expect(restored.getStage()).toBe("BUILD");
  });

  it("throws error when attempting to rehydrate invalid JSON or corrupted stage", () => {
    expect(() => PipelineMachine.fromJSON("not valid json")).toThrow(/Invalid pipeline JSON/);
    expect(() =>
      PipelineMachine.fromJSON(JSON.stringify({ stage: "INVALID_STAGE" }))
    ).toThrow(/invalid or missing stage/);
  });
});

