import { describe, it, expect } from "vitest";
import { loadConfig, configSchema } from "./config";
import { ConfigError } from "./errors";

describe("core/config - loadConfig", () => {
  it("populates all default settings when given empty or undefined input", () => {
    const config = loadConfig({});
    expect(config.provider).toBe("gemini");
    expect(config.model).toBe("gemini-2.0-flash");
    expect(config.fallbackOrder).toEqual([
      "gemini",
      "anthropic",
      "openaiCompatible",
      "ollama",
    ]);
    expect(config.timeouts.requestMs).toBe(30000);
    expect(config.retries.maxRetries).toBe(2);
    expect(config.budgets.maxSteps).toBe(25);
    expect(config.budgets.maxTokens).toBe(100000);
    expect(config.budgets.maxWallClockSec).toBe(300);
    expect(config.ollama.baseUrl).toBe("http://127.0.0.1:11434");
    expect(config.customEndpoint.isLocal).toBe(false);
    expect(config.autoContextRefresh).toBe(true);
    expect(config.maxHistoryMessages).toBe(10);
  });

  it("accepts valid partial overrides and merges with defaults", () => {
    const config = loadConfig({
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      budgets: {
        maxSteps: 50,
      },
      autoContextRefresh: false,
    });

    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-3-5-sonnet-20241022");
    expect(config.budgets.maxSteps).toBe(50);
    // Unspecified nested values should retain defaults
    expect(config.budgets.maxTokens).toBe(100000);
    expect(config.budgets.maxWallClockSec).toBe(300);
    expect(config.autoContextRefresh).toBe(false);
  });

  it("throws ConfigError naming the bad key for top-level invalid property", () => {
    expect(() => loadConfig({ provider: "non_existent_provider" })).toThrowError(
      ConfigError
    );

    try {
      loadConfig({ provider: "non_existent_provider" });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const confErr = err as ConfigError;
      expect(confErr.category).toBe("config");
      expect(confErr.userMessage).toContain("provider");
    }
  });

  it("throws ConfigError naming the bad key for nested invalid properties", () => {
    try {
      loadConfig({
        budgets: {
          maxSteps: -10, // Must be positive
        },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const confErr = err as ConfigError;
      expect(confErr.category).toBe("config");
      expect(confErr.userMessage).toContain("budgets.maxSteps");
    }
  });

  it("throws ConfigError on invalid timeouts and retries boundaries", () => {
    // requestMs too small (< 1000 ms)
    expect(() =>
      loadConfig({
        timeouts: {
          requestMs: 100,
        },
      })
    ).toThrowError(/timeouts\.requestMs/);

    // maxRetries > 5
    expect(() =>
      loadConfig({
        retries: {
          maxRetries: 10,
        },
      })
    ).toThrowError(/retries\.maxRetries/);
  });

  it("validates customEndpoint configuration", () => {
    const config = loadConfig({
      customEndpoint: {
        url: "http://127.0.0.1:8000/v1",
        isLocal: true,
      },
    });
    expect(config.customEndpoint.url).toBe("http://127.0.0.1:8000/v1");
    expect(config.customEndpoint.isLocal).toBe(true);
  });

  it("rejects unknown extra keys when strict schema validation is applied", () => {
    expect(() =>
      loadConfig({
        unknownProperty: 123,
      })
    ).toThrowError(ConfigError);
  });

  it("exposes configSchema for direct schema operations", () => {
    const parsed = configSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });
});
