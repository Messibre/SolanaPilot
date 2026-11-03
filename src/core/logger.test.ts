import { describe, expect, it } from "vitest";
import { Logger, MemoryLogSink } from "./logger";

describe("structured logger and spans", () => {
  it("emits structured events to sinks with required schema fields", () => {
    const mockTime = 1000;
    const sink = new MemoryLogSink();
    const logger = new Logger({ sinks: [sink], now: () => mockTime });

    logger.info("pipeline", "plan", "Plan completed successfully", { step: 1 });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event.level).toBe("info");
    expect(event.component).toBe("pipeline");
    expect(event.phase).toBe("plan");
    expect(event.message).toBe("Plan completed successfully");
    expect(event.spanId).toBe("root");
    expect(event.data).toEqual({ step: 1 });
    expect(event.ts).toBe(new Date(1000).toISOString());
  });

  it("proves secrets never reach the sink (in messages or data objects)", () => {
    const sink = new MemoryLogSink();
    const logger = new Logger({ sinks: [sink] });

    const sensitiveMessage = "Invoking Gemini with key AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd";
    const sensitiveData = {
      apiKey: "secret-token-12345",
      user: "dev@solanapilot.com",
      keypair: Array.from({ length: 64 }, (_, i) => i % 256),
    };

    logger.info("aiGateway", "call", sensitiveMessage, sensitiveData);

    expect(sink.events).toHaveLength(1);
    const logged = sink.events[0];

    // Message must have redacted key
    expect(logged.message).not.toContain("AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd");
    expect(logged.message).toContain("AIza...[redacted:gemini]");

    // Data object must have redacted secrets
    const loggedData = logged.data as Record<string, unknown>;
    expect(loggedData.apiKey).toBe("[redacted:sensitive_key]");
    expect(loggedData.user).toBe("[redacted:email]");
    expect(loggedData.keypair).toBe("[redacted:solana_keypair_bytes]");
  });

  it("reports unfinished spans with verifySpans()", () => {
    let mockTime = 1000;
    const sink = new MemoryLogSink();
    const logger = new Logger({ sinks: [sink], now: () => mockTime });

    const span1 = logger.startSpan("build_program", { component: "builder", phase: "build" });
    const span2 = logger.startSpan("test_program", { component: "tester", phase: "test" });

    // Initially 2 active spans
    expect(logger.verifySpans()).toHaveLength(2);
    expect(logger.verifySpans().map((s) => s.name)).toEqual(["build_program", "test_program"]);

    // End span1
    mockTime += 250;
    span1.end();

    // Now only span2 remains unfinished
    const unfinished = logger.verifySpans();
    expect(unfinished).toHaveLength(1);
    expect(unfinished[0].name).toBe("test_program");
    expect(unfinished[0].spanId).toBe(span2.spanId);

    // Check sink event for finished span1
    const endEvent = sink.events.find((e) => e.message === "Ended span: build_program");
    expect(endEvent).toBeDefined();
    expect(endEvent?.durationMs).toBe(250);
  });

  it("enforces that every error log carries a failure category", () => {
    const sink = new MemoryLogSink();
    const logger = new Logger({ sinks: [sink] });

    // Error with explicit category
    logger.error("ai", "generate", "Rate limit hit", "provider_rate_limited");
    expect(sink.events[0].category).toBe("provider_rate_limited");

    // Generic log call at error level without category defaults to internal
    logger.log({
      level: "error",
      component: "system",
      phase: "init",
      message: "Unexpected fault",
    });
    expect(sink.events[1].category).toBe("internal");
  });

  it("links child spans with parentSpanId", () => {
    const sink = new MemoryLogSink();
    const logger = new Logger({ sinks: [sink] });

    const parent = logger.startSpan("parent_workflow", { component: "orchestrator", phase: "run" });
    const child = logger.startSpan("child_step", {
      component: "orchestrator",
      phase: "step1",
      parentSpanId: parent.spanId,
    });

    child.end();
    parent.end();

    const childEvent = sink.events.find((e) => e.message === "Started span: child_step");
    expect(childEvent?.parentSpanId).toBe(parent.spanId);
  });
});
