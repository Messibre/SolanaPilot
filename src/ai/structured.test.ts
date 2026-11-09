import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateStructured } from "./structured";
import { MockLlmClient } from "./providers/mock";
import { SchemaViolationError } from "../core/errors";

describe("ai/structured - generateStructured", () => {
  const itemSchema = z.object({
    name: z.string().min(1),
    count: z.number().int().min(1).max(100),
    needsHumanReview: z.boolean(),
    uncertainty: z.string().optional(),
  });

  const listSchema = z.object({
    items: z.array(z.string()),
    needsHumanReview: z.boolean(),
    uncertainty: z.string().optional(),
  });

  it("strips preamble, postamble, and markdown fences around JSON", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse(
      "Here is the generated specification:\n```json\n" +
        JSON.stringify({ name: "staking_pool", count: 42, needsHumanReview: false }) +
        "\n```\nPlease let me know if you need anything else!"
    );

    const result = await generateStructured(mock, itemSchema, {
      messages: [{ role: "user", content: "Create staking pool" }],
    });

    expect(result.data.name).toBe("staking_pool");
    expect(result.data.count).toBe(42);
    expect(result.data.needsHumanReview).toBe(false);
    expect(result.repairs).toBe(0);
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].jsonMode).toBe(true);
  });

  it("recovers from truncated JSON via a repair prompt", async () => {
    const mock = new MockLlmClient();
    // Attempt 1: truncated JSON
    mock.enqueueResponse('{"name": "staking_pool", "count": ');
    // Attempt 2: valid JSON
    mock.enqueueResponse(JSON.stringify({ name: "staking_pool", count: 10, needsHumanReview: false }));

    const result = await generateStructured(mock, itemSchema, {
      messages: [{ role: "user", content: "Create staking pool" }],
    });

    expect(result.data.name).toBe("staking_pool");
    expect(result.data.count).toBe(10);
    expect(result.repairs).toBe(1);
    expect(mock.calls.length).toBe(2);
    // Verify the repair prompt contains the syntax/parse error context
    const repairCall = mock.calls[1];
    expect(repairCall.messages[repairCall.messages.length - 1].content).toMatch(/repair|invalid|JSON/i);
  });

  it("rejects extra keys with strict schema and repairs on attempt 2", async () => {
    const mock = new MockLlmClient();
    // Attempt 1: extra unrecognized key
    mock.enqueueResponse(
      JSON.stringify({
        name: "staking_pool",
        count: 10,
        unrecognizedField: "forbidden",
        needsHumanReview: false,
      })
    );
    // Attempt 2: clean strict JSON
    mock.enqueueResponse(JSON.stringify({ name: "staking_pool", count: 10, needsHumanReview: false }));

    const result = await generateStructured(mock, itemSchema, {
      messages: [{ role: "user", content: "Create staking pool" }],
    });

    expect(result.data.name).toBe("staking_pool");
    expect(result.repairs).toBe(1);
    expect(mock.calls.length).toBe(2);
  });

  it("rejects number out of range and repairs on attempt 2", async () => {
    const mock = new MockLlmClient();
    // Attempt 1: count > 100
    mock.enqueueResponse(JSON.stringify({ name: "staking_pool", count: 500, needsHumanReview: false }));
    // Attempt 2: count within 1..100
    mock.enqueueResponse(JSON.stringify({ name: "staking_pool", count: 50, needsHumanReview: false }));

    const result = await generateStructured(mock, itemSchema, {
      messages: [{ role: "user", content: "Create staking pool" }],
    });

    expect(result.data.count).toBe(50);
    expect(result.repairs).toBe(1);
    expect(mock.calls.length).toBe(2);
  });

  it("handles non-JSON response with repair success on attempt 2", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse("I am sorry, but I cannot directly generate that without clarification.");
    mock.enqueueResponse(JSON.stringify({ name: "staking_pool", count: 5, needsHumanReview: false }));

    const result = await generateStructured(mock, itemSchema, {
      messages: [{ role: "user", content: "Create staking pool" }],
    });

    expect(result.data.name).toBe("staking_pool");
    expect(result.repairs).toBe(1);
    expect(mock.calls.length).toBe(2);
  });

  it("exhausts repairs after maxRepairs=1 (exactly 2 calls) and throws SchemaViolationError", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse("Totally not JSON 1");
    mock.enqueueResponse("Totally not JSON 2");

    try {
      await generateStructured(
        mock,
        itemSchema,
        { messages: [{ role: "user", content: "Create staking pool" }] },
        { maxRepairs: 1 }
      );
      expect.fail("Expected generateStructured to throw SchemaViolationError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(SchemaViolationError);
      expect(mock.calls.length).toBe(2);
    }
  });

  it("flags schema-valid-but-empty content with needsHumanReview: true", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse(JSON.stringify({ items: [], needsHumanReview: false }));

    const result = await generateStructured(mock, listSchema, {
      messages: [{ role: "user", content: "List items" }],
    });

    expect(result.data.items).toEqual([]);
    expect(result.data.needsHumanReview).toBe(true);
    expect(result.data.uncertainty).toBeDefined();
    expect(result.repairs).toBe(0);
    expect(mock.calls.length).toBe(1);
  });
});
