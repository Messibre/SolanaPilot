import { describe, it, expect } from "vitest";
import { MockLlmClient } from "./mock";
import { ProviderError } from "../../core/errors";

describe("ai/providers/mock - MockLlmClient", () => {
  it("delivers scripted responses in FIFO order", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse("first response");
    mock.enqueueResponse({
      text: "second response",
      model: "custom-mock-v2",
      usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 },
    });

    const res1 = await mock.generate({
      messages: [{ role: "user", content: "msg1" }],
    });
    expect(res1.text).toBe("first response");
    expect(res1.provider).toBe("mock");

    const res2 = await mock.generate({
      messages: [{ role: "user", content: "msg2" }],
    });
    expect(res2.text).toBe("second response");
    expect(res2.model).toBe("custom-mock-v2");
    expect(res2.usage?.totalTokens).toBe(20);
  });

  it("injects errors from queue", async () => {
    const mock = new MockLlmClient();
    mock.enqueueError(new ProviderError("Simulated 500 error", true));

    await expect(
      mock.generate({ messages: [{ role: "user", content: "will fail" }] })
    ).rejects.toThrow(ProviderError);
  });

  it("records calls and provides call inspection helpers", async () => {
    const mock = new MockLlmClient();
    mock.enqueueResponse("ok");

    expect(mock.getCallCount()).toBe(0);
    expect(mock.getLastCall()).toBeUndefined();

    await mock.generate({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hello world" },
      ],
      jsonMode: true,
    });

    expect(mock.getCallCount()).toBe(1);
    const lastCall = mock.getLastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall?.model).toBe("gemini-2.0-flash");
    expect(lastCall?.jsonMode).toBe(true);
    expect(lastCall?.messages).toHaveLength(2);

    mock.clearCalls();
    expect(mock.getCallCount()).toBe(0);
    expect(mock.getLastCall()).toBeUndefined();
  });

  it("handles health checks correctly", async () => {
    const mock = new MockLlmClient();
    await expect(mock.healthCheck()).resolves.toBeUndefined();

    mock.setHealthy(false);
    await expect(mock.healthCheck()).rejects.toThrow("unhealthy");

    mock.setHealthy(true);
    await expect(mock.healthCheck()).resolves.toBeUndefined();
  });

  it("falls back to default response when queue is exhausted", async () => {
    const mock = new MockLlmClient({ defaultResponse: "fallback default" });

    const res = await mock.generate({
      messages: [{ role: "user", content: "test" }],
    });
    expect(res.text).toBe("fallback default");
    expect(res.provider).toBe("mock");
  });
});
