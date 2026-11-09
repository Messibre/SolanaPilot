/**
 * AI client routing all legacy AI calls through LlmGateway.
 * Strictly adheres to Agent.md §6 and §10.
 * Replaced @google/generative-ai with LlmGateway and modern providers.
 */

import * as vscode from "vscode";
import { LlmGateway, type ClientFactory } from "./ai/gateway";
import { GeminiClient } from "./ai/providers/gemini";
import { AnthropicClient } from "./ai/providers/anthropic";
import { OpenAiCompatibleClient } from "./ai/providers/openaiCompatible";
import { OllamaClient } from "./ai/providers/ollama";
import { MockLlmClient } from "./ai/providers/mock";
import { loadConfig } from "./core/config";
import { SOLANA_SYSTEM_PROMPT } from "./systemPrompt";
import { BudgetTracker } from "./agent/budget";
import type { ProviderId } from "./core/validation";

const budgetTracker = new BudgetTracker({ maxCallsPerHour: 50 });

const defaultFactory: ClientFactory = (id: ProviderId, config, apiKey) => {
  if (id === "gemini") {
    return new GeminiClient({ apiKey: apiKey ?? "", defaultModel: config.model });
  }
  if (id === "anthropic") {
    return new AnthropicClient({ apiKey, defaultModel: config.model });
  }
  if (id === "openaiCompatible") {
    return new OpenAiCompatibleClient({
      preset: "openai",
      apiKey,
      baseUrl: config.customEndpoint.url,
      defaultModel: config.model,
      isLocal: config.customEndpoint.isLocal,
    });
  }
  if (id === "ollama") {
    return new OllamaClient({
      baseUrl: config.ollama.baseUrl,
      defaultModel: config.model,
    });
  }
  return new MockLlmClient();
};

export function initAI(apiKey?: string): void {
  void apiKey;
}

function truncateContext(context: string): string {
  const MAX_CONTEXT_LENGTH = 4000;
  if (context.length <= MAX_CONTEXT_LENGTH) {
    return context;
  }
  return (
    context.substring(0, MAX_CONTEXT_LENGTH) +
    "\n\n...[truncated due to length]"
  );
}

export async function callAI(
  userMessage: string,
  workspaceContext: string,
  expectJSON = false
): Promise<string> {
  budgetTracker.recordCall();

  const vsConfig = vscode.workspace.getConfiguration("solanaPilot");
  const rawConfig: Record<string, unknown> = {};

  const provider = vsConfig.get<string>("provider");
  if (provider) rawConfig.provider = provider;

  const model = vsConfig.get<string>("model");
  if (model) rawConfig.model = model;

  const config = loadConfig(rawConfig);
  const secretResolver = async (keyOrProvider: string): Promise<string | undefined> => {
    return (
      process.env[keyOrProvider] ??
      process.env[keyOrProvider.toUpperCase()] ??
      process.env.GEMINI_API_KEY
    );
  };

  const gateway = new LlmGateway({
    config,
    secrets: secretResolver,
    clientFactory: defaultFactory,
  });

  const truncated = truncateContext(workspaceContext || "");
  const systemPrompt = SOLANA_SYSTEM_PROMPT.replace(
    "{WORKSPACE_CONTEXT}",
    truncated || "No workspace context available"
  );

  const result = await gateway.generate({
    model: config.model,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    jsonMode: expectJSON,
  });

  if (!result.text || result.text.trim() === "") {
    throw new Error("Empty response from AI gateway. Please try again.");
  }

  return result.text;
}
