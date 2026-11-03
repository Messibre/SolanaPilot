/**
 * VS Code command handlers for provider and model selection, connection testing, and key management.
 * Adapter code contains zero business logic; delegates to core/ai providers per Agent.md §6.
 * Permitted to import 'vscode'.
 */

import * as vscode from "vscode";
import { getProviderKey, promptSetApiKey } from "./secretStorage";
import { updateStatusBar } from "./statusBar";
import { GeminiClient } from "../ai/providers/gemini";
import { AnthropicClient } from "../ai/providers/anthropic";
import { OpenAiCompatibleClient } from "../ai/providers/openaiCompatible";
import { OllamaClient } from "../ai/providers/ollama";
import { MockLlmClient } from "../ai/providers/mock";
import type { LlmClient } from "../ai/types";
import { ConfigError, SolanaPilotError } from "../core/errors";

const PROVIDER_OPTIONS = [
  { label: "gemini", description: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { label: "anthropic", description: "Anthropic Claude", defaultModel: "claude-3-5-sonnet-20241022" },
  { label: "openaiCompatible", description: "OpenAI or OpenRouter", defaultModel: "gpt-4o" },
  { label: "ollama", description: "Ollama (Local inference)", defaultModel: "codellama" },
  { label: "mock", description: "Mock provider (Offline testing)", defaultModel: "mock-model" },
];

const MODEL_PRESETS: Record<string, string[]> = {
  gemini: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
  openaiCompatible: ["gpt-4o", "gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
  ollama: ["codellama", "llama3"],
  mock: ["mock-model"],
};

export async function promptSelectProviderAndModel(
  _context: vscode.ExtensionContext,
  statusBar?: vscode.StatusBarItem
): Promise<void> {
  const chosenProvider = await vscode.window.showQuickPick(PROVIDER_OPTIONS, {
    placeHolder: "Select active AI Provider",
  });
  if (!chosenProvider) return;

  const provider = chosenProvider.label;
  const presets = MODEL_PRESETS[provider] ?? [chosenProvider.defaultModel];

  const modelOptions = [
    ...presets.map((m) => ({ label: m, description: "Preset model" })),
    { label: "Custom model...", description: "Enter custom model identifier" },
  ];

  const chosenModelItem = await vscode.window.showQuickPick(modelOptions, {
    placeHolder: `Select model for ${provider}`,
  });
  if (!chosenModelItem) return;

  let model = chosenModelItem.label;
  if (chosenModelItem.label === "Custom model...") {
    const customInput = await vscode.window.showInputBox({
      prompt: `Enter custom model identifier for ${provider}`,
      placeHolder: chosenProvider.defaultModel,
    });
    if (!customInput) return;
    model = customInput.trim();
  }

  const config = vscode.workspace.getConfiguration("solanaPilot");
  await config.update("provider", provider, vscode.ConfigurationTarget.Global);
  await config.update("model", model, vscode.ConfigurationTarget.Global);

  if (statusBar) {
    updateStatusBar(statusBar);
  }

  void vscode.window.showInformationMessage(
    `SolanaPilot: Switched to ${provider} · ${model}`
  );
}

export async function testConnection(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("solanaPilot");
  const provider = config.get<string>("provider") ?? "gemini";
  const model = config.get<string>("model") ?? "gemini-2.0-flash";

  try {
    const client = await createClientForTest(context, provider, model);
    await client.healthCheck();
    void vscode.window.showInformationMessage(
      `SolanaPilot: Connection to ${provider} (${model}) succeeded!`
    );
  } catch (err: unknown) {
    const errorMsg =
      err instanceof SolanaPilotError ? err.userMessage : (err as Error).message ?? String(err);

    if (err instanceof ConfigError && /not running/i.test(errorMsg)) {
      void vscode.window.showErrorMessage(`SolanaPilot: ${errorMsg}`);
      return;
    }

    const action = await vscode.window.showErrorMessage(
      `SolanaPilot: Connection to ${provider} failed: ${errorMsg}`,
      "Set API Key"
    );

    if (action === "Set API Key") {
      await promptSetApiKey(context, provider);
    }
  }
}

async function createClientForTest(
  context: vscode.ExtensionContext,
  provider: string,
  model: string
): Promise<LlmClient> {
  if (provider === "mock") {
    return new MockLlmClient();
  }

  if (provider === "ollama") {
    const config = vscode.workspace.getConfiguration("solanaPilot");
    const baseUrl = config.get<string>("ollama.baseUrl") ?? "http://127.0.0.1:11434";
    return new OllamaClient({ baseUrl, defaultModel: model });
  }

  const apiKey = await getProviderKey(context, provider);
  if (!apiKey) {
    throw new ConfigError(
      `API key is missing for ${provider}. Use 'SolanaPilot: Set API Key' to configure credentials.`
    );
  }

  if (provider === "gemini") {
    return new GeminiClient({ apiKey, defaultModel: model });
  }

  if (provider === "anthropic") {
    return new AnthropicClient({ apiKey, defaultModel: model });
  }

  if (provider === "openaiCompatible") {
    return new OpenAiCompatibleClient({
      preset: "openai",
      apiKey,
      defaultModel: model,
    });
  }

  throw new ConfigError(`Unknown or unsupported provider '${provider}'`);
}
