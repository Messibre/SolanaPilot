import { describe, expect, it } from "vitest";
import {
  AuthError,
  BudgetExhaustedError,
  classify,
  ConfigError,
  ContextOverflowError,
  CycleDetectedError,
  DomainRefusalError,
  FailureCategory,
  InternalError,
  NetworkBlockedError,
  ParseFailureError,
  ProviderError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
  SchemaViolationError,
  SolanaPilotError,
  ToolCrashedError,
  ToolRefusedError,
} from "./errors";

describe("errors and failure categories", () => {
  it("instantiates each of the 15 categories with expected category and retryable flag", () => {
    const errorMap: Record<FailureCategory, SolanaPilotError> = {
      config: new ConfigError("Config missing"),
      auth: new AuthError("Auth failed"),
      provider_timeout: new ProviderTimeoutError(),
      provider_rate_limited: new ProviderRateLimitedError(),
      provider_error: new ProviderError("Provider failed", true),
      parse_failure: new ParseFailureError(),
      schema_violation: new SchemaViolationError(),
      context_overflow: new ContextOverflowError(),
      tool_refused: new ToolRefusedError("Tool access denied"),
      tool_crashed: new ToolCrashedError(),
      budget_exhausted: new BudgetExhaustedError(),
      cycle_detected: new CycleDetectedError(),
      domain_refusal: new DomainRefusalError(),
      network_blocked: new NetworkBlockedError(),
      internal: new InternalError(),
    };

    for (const [category, err] of Object.entries(errorMap)) {
      expect(err.category).toBe(category);
      expect(err).toBeInstanceOf(SolanaPilotError);
      expect(typeof err.userMessage).toBe("string");
    }

    // Verify retryable policies
    expect(errorMap.provider_timeout.retryable).toBe(true);
    expect(errorMap.provider_rate_limited.retryable).toBe(true);
    expect(errorMap.provider_error.retryable).toBe(true);
    expect(errorMap.auth.retryable).toBe(false);
    expect(errorMap.config.retryable).toBe(false);
    expect(errorMap.budget_exhausted.retryable).toBe(false);
  });

  describe("classify", () => {
    it("returns SolanaPilotError instances unchanged", () => {
      const original = new AuthError("Custom auth message");
      const classified = classify(original);
      expect(classified).toBe(original);
      expect(classified.category).toBe("auth");
      expect(classified.userMessage).toBe("Custom auth message");
    });

    it("classifies plain Error to internal without exposing cause in userMessage", () => {
      const sensitiveCause = new Error("DB_PASSWORD_12345 connection failed");
      const classified = classify(sensitiveCause);

      expect(classified.category).toBe("internal");
      expect(classified.retryable).toBe(false);
      expect(classified.userMessage).toBe("An internal error occurred");
      expect(classified.userMessage).not.toContain("DB_PASSWORD_12345");
      expect(classified.cause).toBe(sensitiveCause);
    });

    it("classifies AbortError and timeout messages to provider_timeout", () => {
      const abortErr = new Error("The user aborted a request.");
      abortErr.name = "AbortError";

      const classified = classify(abortErr);
      expect(classified.category).toBe("provider_timeout");
      expect(classified.retryable).toBe(true);

      const timeoutErr = new Error("Gateway timeout occurred");
      expect(classify(timeoutErr).category).toBe("provider_timeout");
    });

    it("classifies HTTP 401 and 403 to auth (never retry)", () => {
      const err401 = { status: 401, message: "Unauthorized token" };
      const res401 = classify(err401);
      expect(res401.category).toBe("auth");
      expect(res401.retryable).toBe(false);

      const err403 = { statusCode: 403, message: "Forbidden" };
      const res403 = classify(err403);
      expect(res403.category).toBe("auth");
      expect(res403.retryable).toBe(false);
    });

    it("classifies HTTP 429 to provider_rate_limited (retryable)", () => {
      const err429 = { status: 429, message: "Rate limit reached" };
      const res = classify(err429);
      expect(res.category).toBe("provider_rate_limited");
      expect(res.retryable).toBe(true);
    });

    it("classifies HTTP 400 to provider_error (non-retryable)", () => {
      const err400 = { status: 400, message: "Bad Request" };
      const res = classify(err400);
      expect(res.category).toBe("provider_error");
      expect(res.retryable).toBe(false);
    });

    it("classifies HTTP 500 and 503 to provider_error (retryable)", () => {
      const err500 = { status: 500, message: "Internal server error" };
      const res500 = classify(err500);
      expect(res500.category).toBe("provider_error");
      expect(res500.retryable).toBe(true);

      const err503 = { status: 503, message: "Service Unavailable" };
      const res503 = classify(err503);
      expect(res503.category).toBe("provider_error");
      expect(res503.retryable).toBe(true);
    });

    it("safely handles primitive non-error inputs", () => {
      expect(classify("some string").category).toBe("internal");
      expect(classify(12345).category).toBe("internal");
      expect(classify(null).category).toBe("internal");
      expect(classify(undefined).category).toBe("internal");
    });
  });
});
