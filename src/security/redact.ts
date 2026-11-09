/**
 * Deep redaction utility for logs, errors, and receipts.
 * Strictly adheres to Agent.md §10 and §14.
 * Zero vscode imports allowed.
 */

const GEMINI_REGEX = /AIza[0-9A-Za-z-_]{35}/g;
const ANTHROPIC_REGEX = /sk-ant-[a-zA-Z0-9_-]{20,}/g;
const OPENAI_REGEX = /sk-[a-zA-Z0-9_-]{20,}/g;
const GITHUB_REGEX = /ghp_[a-zA-Z0-9]{36}/g;
const BEARER_REGEX = /Bearer\s+[a-zA-Z0-9_.\-~+/=]{20,}/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----|-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_CREDS_REGEX = /(https?:\/\/)([^:\s]+):([^@\s]+)@/g;

// Long base58 secret strings (Solana private keys in base58 are 80-90 chars).
// Note: Solana public keys / program IDs are 32-44 base58 characters and must NEVER be redacted.
const BASE58_SECRET_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g;

const SENSITIVE_KEY_REGEX = /^(key|api[_-]?key|secret|token|password|passwd|auth|authorization|bearer|private[_-]?key)$/i;

/**
 * Redact sensitive patterns from a single string.
 */
export function redactString(str: string): string {
  if (!str) return str;

  let result = str;

  // URL credentials
  result = result.replace(URL_CREDS_REGEX, "$1[redacted:credentials]@");

  // Private keys
  result = result.replace(PRIVATE_KEY_REGEX, "[redacted:private_key]");

  // Provider keys (preserve leading prefix for debugging)
  result = result.replace(GEMINI_REGEX, "AIza...[redacted:gemini]");
  result = result.replace(ANTHROPIC_REGEX, "sk-ant...[redacted:anthropic]");
  result = result.replace(OPENAI_REGEX, "sk...[redacted:openai]");
  result = result.replace(GITHUB_REGEX, "ghp...[redacted:github]");

  // Bearer tokens
  result = result.replace(BEARER_REGEX, "Bearer [redacted:token]");

  // Long base58 secrets
  result = result.replace(BASE58_SECRET_REGEX, "[redacted:base58_secret]");

  // Emails
  result = result.replace(EMAIL_REGEX, "[redacted:email]");

  return result;
}

/**
 * Check if an array is a 64-byte Solana secret keypair.
 */
function is64ByteKeypairArray(arr: unknown[]): boolean {
  if (arr.length !== 64) return false;
  return arr.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255);
}

/**
 * Recursively deep-redacts any value, preserving shape while preventing secret leakage.
 * Handles cyclic references safely using a WeakSet.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol") {
    return value;
  }

  if (typeof value === "function") {
    return "[Function]";
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (value instanceof RegExp) {
      return value;
    }

    if (value instanceof Error) {
      const copy = new (value.constructor as new (msg?: string) => Error)(redactString(value.message));
      copy.name = value.name;
      if (value.stack) {
        copy.stack = redactString(value.stack);
      }
      return copy;
    }

    if (Array.isArray(value)) {
      if (is64ByteKeypairArray(value)) {
        return "[redacted:solana_keypair_bytes]";
      }
      return value.map((item) => redact(item, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_REGEX.test(k) && (typeof v !== "object" || v === null)) {
        result[k] = "[redacted:sensitive_key]";
      } else {
        result[k] = redact(v, seen);
      }
    }
    return result;
  }

  return value;
}
