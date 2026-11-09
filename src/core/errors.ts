/**
 * Typed errors and failure categories for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Zero vscode imports allowed.
 */

export type FailureCategory =
  | "config"
  | "auth"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_error"
  | "parse_failure"
  | "schema_violation"
  | "context_overflow"
  | "tool_refused"
  | "tool_crashed"
  | "budget_exhausted"
  | "cycle_detected"
  | "domain_refusal"
  | "network_blocked"
  | "internal";

export interface SolanaPilotErrorOptions {
  category: FailureCategory;
  userMessage: string;
  retryable?: boolean;
  cause?: unknown;
}

export class SolanaPilotError extends Error {
  public readonly category: FailureCategory;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public override readonly cause?: unknown;

  constructor(options: SolanaPilotErrorOptions) {
    super(options.userMessage);
    this.name = "SolanaPilotError";
    this.category = options.category;
    this.userMessage = options.userMessage;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigError extends SolanaPilotError {
  constructor(userMessage: string, cause?: unknown) {
    super({ category: "config", userMessage, retryable: false, cause });
    this.name = "ConfigError";
  }
}

export class AuthError extends SolanaPilotError {
  constructor(userMessage: string, cause?: unknown) {
    super({ category: "auth", userMessage, retryable: false, cause });
    this.name = "AuthError";
  }
}

export class ProviderTimeoutError extends SolanaPilotError {
  constructor(userMessage = "Request to AI provider timed out", cause?: unknown) {
    super({ category: "provider_timeout", userMessage, retryable: true, cause });
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderRateLimitedError extends SolanaPilotError {
  constructor(userMessage = "AI provider rate limit exceeded", cause?: unknown) {
    super({ category: "provider_rate_limited", userMessage, retryable: true, cause });
    this.name = "ProviderRateLimitedError";
  }
}

export class ProviderError extends SolanaPilotError {
  constructor(userMessage: string, retryable = true, cause?: unknown) {
    super({ category: "provider_error", userMessage, retryable, cause });
    this.name = "ProviderError";
  }
}

export class ParseFailureError extends SolanaPilotError {
  constructor(userMessage = "Failed to parse model response", cause?: unknown) {
    super({ category: "parse_failure", userMessage, retryable: false, cause });
    this.name = "ParseFailureError";
  }
}

export class SchemaViolationError extends SolanaPilotError {
  constructor(userMessage = "Output schema validation failed", cause?: unknown) {
    super({ category: "schema_violation", userMessage, retryable: false, cause });
    this.name = "SchemaViolationError";
  }
}

export class ContextOverflowError extends SolanaPilotError {
  constructor(userMessage = "Context size exceeded provider token window", cause?: unknown) {
    super({ category: "context_overflow", userMessage, retryable: false, cause });
    this.name = "ContextOverflowError";
  }
}

export class ToolRefusedError extends SolanaPilotError {
  constructor(userMessage: string, cause?: unknown) {
    super({ category: "tool_refused", userMessage, retryable: false, cause });
    this.name = "ToolRefusedError";
  }
}

export class ToolCrashedError extends SolanaPilotError {
  constructor(userMessage = "Tool execution crashed", cause?: unknown) {
    super({ category: "tool_crashed", userMessage, retryable: false, cause });
    this.name = "ToolCrashedError";
  }
}

export class BudgetExhaustedError extends SolanaPilotError {
  constructor(userMessage = "Operation exceeded configured budget", cause?: unknown) {
    super({ category: "budget_exhausted", userMessage, retryable: false, cause });
    this.name = "BudgetExhaustedError";
  }
}

export class CycleDetectedError extends SolanaPilotError {
  constructor(userMessage = "Execution cycle or oscillation detected in agent loop", cause?: unknown) {
    super({ category: "cycle_detected", userMessage, retryable: false, cause });
    this.name = "CycleDetectedError";
  }
}

export class DomainRefusalError extends SolanaPilotError {
  constructor(userMessage = "Requested domain is not permitted", cause?: unknown) {
    super({ category: "domain_refusal", userMessage, retryable: false, cause });
    this.name = "DomainRefusalError";
  }
}

export class NetworkBlockedError extends SolanaPilotError {
  constructor(userMessage = "Network request was blocked by security policy", cause?: unknown) {
    super({ category: "network_blocked", userMessage, retryable: false, cause });
    this.name = "NetworkBlockedError";
  }
}

export class InternalError extends SolanaPilotError {
  constructor(userMessage = "An internal error occurred", cause?: unknown) {
    super({ category: "internal", userMessage, retryable: false, cause });
    this.name = "InternalError";
  }
}

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  message?: string;
  name?: string;
}

/**
 * Classify any unknown error or rejection into a typed SolanaPilotError.
 * Guarantees that userMessage never exposes raw cause text or unredacted internal details.
 */
export function classify(err: unknown): SolanaPilotError {
  if (err instanceof SolanaPilotError) {
    return err;
  }

  if (typeof err === "object" && err !== null) {
    const errorObj = err as HttpLikeError;
    const status = errorObj.status ?? errorObj.statusCode;
    const name = errorObj.name ?? "";
    const msg = errorObj.message ?? "";

    if (name === "AbortError" || msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("aborted")) {
      return new ProviderTimeoutError("Request timed out or was aborted", err);
    }

    if (status === 401 || status === 403) {
      return new AuthError("Authentication failed: invalid or unauthorized credentials", err);
    }

    if (status === 429) {
      return new ProviderRateLimitedError("Provider rate limit reached. Please wait or retry later", err);
    }

    if (status === 400) {
      return new SolanaPilotError({
        category: "provider_error",
        userMessage: "Bad request sent to provider",
        retryable: false,
        cause: err,
      });
    }

    if (status === 500 || status === 503) {
      return new ProviderError("Provider service temporarily unavailable", true, err);
    }
  }

  return new InternalError("An internal error occurred", err);
}
