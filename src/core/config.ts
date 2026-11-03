/**
 * Typed configuration schema and loader using Zod.
 * Adheres strictly to Agent.md §8 and §10.
 * Zero vscode imports allowed.
 */

import { z } from "zod";
import { ConfigError } from "./errors";
import {
  providerIdSchema,
  modelNameSchema,
} from "./validation";

export const timeoutsSchema = z
  .strictObject({
    requestMs: z.number().int().min(1000).max(300000).default(30000),
  })
  .default({ requestMs: 30000 });

export const retriesSchema = z
  .strictObject({
    maxRetries: z.number().int().min(0).max(5).default(2),
  })
  .default({ maxRetries: 2 });

export const budgetsSchema = z
  .strictObject({
    maxSteps: z.number().int().min(1).max(100).default(25),
    maxTokens: z.number().int().min(1000).max(1000000).default(100000),
    maxWallClockSec: z.number().int().min(10).max(3600).default(300),
  })
  .default({
    maxSteps: 25,
    maxTokens: 100000,
    maxWallClockSec: 300,
  });

export const ollamaSchema = z
  .strictObject({
    baseUrl: z.string().trim().min(1).max(2048).default("http://127.0.0.1:11434"),
  })
  .default({ baseUrl: "http://127.0.0.1:11434" });

export const customEndpointSchema = z
  .strictObject({
    url: z.string().trim().max(2048).optional(),
    isLocal: z.boolean().default(false),
  })
  .default({ isLocal: false });

export const configSchema = z.strictObject({
  provider: providerIdSchema.default("gemini"),
  model: modelNameSchema.default("gemini-2.0-flash"),
  fallbackOrder: z
    .array(providerIdSchema)
    .default(["gemini", "anthropic", "openaiCompatible", "ollama"]),
  timeouts: timeoutsSchema,
  retries: retriesSchema,
  budgets: budgetsSchema,
  ollama: ollamaSchema,
  customEndpoint: customEndpointSchema,
  autoContextRefresh: z.boolean().default(true),
  maxHistoryMessages: z.number().int().min(1).max(100).default(10),
});

export type TimeoutsConfig = z.infer<typeof timeoutsSchema>;
export type RetriesConfig = z.infer<typeof retriesSchema>;
export type BudgetsConfig = z.infer<typeof budgetsSchema>;
export type OllamaConfig = z.infer<typeof ollamaSchema>;
export type CustomEndpointConfig = z.infer<typeof customEndpointSchema>;
export type SolanaPilotConfig = z.infer<typeof configSchema>;

/**
 * Pure configuration loader.
 * Returns a validated SolanaPilotConfig with defaults applied,
 * or throws a typed ConfigError naming the invalid key.
 */
export function loadConfig(raw: unknown = {}): SolanaPilotConfig {
  const input = raw === undefined || raw === null ? {} : raw;
  const result = configSchema.safeParse(input);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const pathStr =
      firstIssue && firstIssue.path.length > 0 ? firstIssue.path.join(".") : "config";
    const msg = firstIssue ? firstIssue.message : "Invalid configuration";
    throw new ConfigError(`Invalid configuration for '${pathStr}': ${msg}`, result.error);
  }

  return result.data;
}
