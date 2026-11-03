/**
 * Normalized types and interfaces for multi-provider AI interactions.
 * Adheres strictly to Agent.md §6 and §10.
 * Zero vscode imports allowed.
 */

import type { ProviderId, ModelName } from "../core/validation";

export type MessageRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: MessageRole;
  content: string;
}

export interface LlmRequest {
  model?: ModelName;
  messages: LlmMessage[];
  system?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResult {
  text: string;
  provider: ProviderId;
  model: string;
  usage?: LlmUsage;
  latencyMs?: number;
}

export interface LlmClient {
  readonly id: ProviderId;
  generate(req: LlmRequest): Promise<LlmResult>;
  healthCheck(): Promise<void>;
}

export type SecretResolver = (key: string) => Promise<string | undefined> | string | undefined;
export type SecretStore = Record<string, string | undefined> | SecretResolver;
