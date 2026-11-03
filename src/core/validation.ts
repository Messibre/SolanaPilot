/**
 * Shared validation schemas using Zod.
 * Adheres strictly to Agent.md §8 and §10.
 * Zero vscode imports allowed.
 */

import path from "node:path";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { SchemaViolationError } from "./errors";

/**
 * Validates Solana program names: snake_case, 3 to 32 characters,
 * no leading/trailing underscores, no consecutive underscores.
 */
export const programNameSchema = z
  .string()
  .trim()
  .min(3, { message: "Program name must be at least 3 characters" })
  .max(32, { message: "Program name cannot exceed 32 characters" })
  .regex(/^[a-z][a-z0-9_]*[a-z0-9]$/, {
    message: "Program name must be snake_case (lowercase alphanumeric and single underscores)",
  })
  .refine((name) => !name.includes("__"), {
    message: "Program name cannot contain consecutive underscores",
  });

/**
 * Validates Solana public keys: base58 string decoding to exactly 32 bytes.
 */
export const pubkeySchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      try {
        const pk = new PublicKey(val);
        return pk.toBytes().length === 32;
      } catch {
        return false;
      }
    },
    { message: "Invalid Solana public key (must be valid 32-byte base58)" }
  );

/**
 * Validates user prompt inputs: trimmed, 1 to 4000 characters, no null bytes.
 */
export const userPromptSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => !s.includes("\0"), {
    message: "Prompt must not contain null bytes",
  })
  .pipe(
    z
      .string()
      .min(1, { message: "Prompt cannot be empty" })
      .max(4000, { message: "Prompt cannot exceed 4000 characters" })
  );

/**
 * Validates relative workspace paths: relative path that does not escape workspace.
 */
export const relativeWorkspacePathSchema = z
  .string()
  .trim()
  .min(1, { message: "Path cannot be empty" })
  .refine((p) => !p.includes("\0"), {
    message: "Path must not contain null bytes",
  })
  .refine(
    (p) =>
      !path.isAbsolute(p) &&
      !/^[a-zA-Z]:/.test(p) &&
      !p.startsWith("/") &&
      !p.startsWith("\\"),
    {
      message: "Path must be a relative workspace path",
    }
  )
  .refine(
    (p) => {
      const normalized = path.posix.normalize(p.replace(/\\/g, "/"));
      return !normalized.startsWith("..") && normalized !== "..";
    },
    {
      message: "Path traverses outside workspace",
    }
  );

/**
 * Validates HTTPS URLs with max length cap.
 */
export const httpsUrlSchema = z
  .string()
  .trim()
  .url({ message: "Invalid URL" })
  .max(2048, { message: "URL exceeds maximum length" })
  .refine(
    (u) => {
      try {
        return new URL(u).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL protocol must be HTTPS" }
  );

/**
 * Validates supported LLM provider IDs.
 */
export const providerIdSchema = z.enum([
  "mock",
  "gemini",
  "openaiCompatible",
  "anthropic",
  "ollama",
]);

/**
 * Validates model identifiers: trimmed, 1 to 128 characters, safe charset.
 */
export const modelNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Model name cannot be empty" })
  .max(128, { message: "Model name cannot exceed 128 characters" })
  .regex(/^[a-zA-Z0-9_.:/-]+$/, {
    message: "Model name contains invalid characters",
  });

// Inferred TypeScript types
export type ProgramName = z.infer<typeof programNameSchema>;
export type Pubkey = z.infer<typeof pubkeySchema>;
export type UserPrompt = z.infer<typeof userPromptSchema>;
export type RelativeWorkspacePath = z.infer<typeof relativeWorkspacePathSchema>;
export type HttpsUrl = z.infer<typeof httpsUrlSchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export type ModelName = z.infer<typeof modelNameSchema>;

// Helper parsing functions that throw SchemaViolationError
function parseOrThrow<T>(schema: z.ZodType<T>, val: unknown, label: string): T {
  const result = schema.safeParse(val);
  if (!result.success) {
    const issue = result.error.issues[0]?.message ?? `Invalid ${label}`;
    throw new SchemaViolationError(`${label} validation failed: ${issue}`, result.error);
  }
  return result.data;
}

export function validateProgramName(val: unknown): ProgramName {
  return parseOrThrow(programNameSchema, val, "Program name");
}

export function validatePubkey(val: unknown): Pubkey {
  return parseOrThrow(pubkeySchema, val, "Public key");
}

export function validateUserPrompt(val: unknown): UserPrompt {
  return parseOrThrow(userPromptSchema, val, "User prompt");
}

export function validateRelativeWorkspacePath(val: unknown): RelativeWorkspacePath {
  return parseOrThrow(relativeWorkspacePathSchema, val, "Relative workspace path");
}

export function validateHttpsUrl(val: unknown): HttpsUrl {
  return parseOrThrow(httpsUrlSchema, val, "HTTPS URL");
}

export function validateProviderId(val: unknown): ProviderId {
  return parseOrThrow(providerIdSchema, val, "Provider ID");
}

export function validateModelName(val: unknown): ModelName {
  return parseOrThrow(modelNameSchema, val, "Model name");
}
