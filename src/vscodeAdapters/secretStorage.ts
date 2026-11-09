/**
 * VS Code SecretStorage adapter for per-provider API key management.
 * Permitted to import 'vscode' per Agent.md §6.
 */

import * as vscode from "vscode";
import type { SecretResolver } from "../ai/types";

const SECRET_KEY_MAP: Record<string, string> = {
  gemini: "solanaPilot.key.gemini",
  anthropic: "solanaPilot.key.anthropic",
  openaiCompatible: "solanaPilot.key.openai",
  openai: "solanaPilot.key.openai",
  openrouter: "solanaPilot.key.openrouter",
  custom: "solanaPilot.key.custom",
};

export function getSecretKeyName(provider: string): string {
  return SECRET_KEY_MAP[provider] ?? `solanaPilot.key.${provider}`;
}

export function validateKeyForProvider(provider: string, value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "API key cannot be empty";
  }

  if (provider === "gemini") {
    if (!trimmed.startsWith("AIza")) {
      return 'Gemini API keys typically start with "AIza"';
    }
    if (trimmed.length < 20) {
      return "Gemini API key seems too short. Make sure you copied it fully.";
    }
  } else if (provider === "anthropic") {
    if (!trimmed.startsWith("sk-ant-")) {
      return 'Anthropic API keys typically start with "sk-ant-"';
    }
    if (trimmed.length < 20) {
      return "Anthropic API key seems too short. Make sure you copied it fully.";
    }
  } else if (provider === "openai" || provider === "openaiCompatible") {
    if (!trimmed.startsWith("sk-")) {
      return 'OpenAI API keys typically start with "sk-"';
    }
    if (trimmed.length < 20) {
      return "OpenAI API key seems too short.";
    }
  } else if (provider === "openrouter") {
    if (!trimmed.startsWith("sk-or-") && !trimmed.startsWith("sk-")) {
      return 'OpenRouter API keys typically start with "sk-or-" or "sk-"';
    }
    if (trimmed.length < 20) {
      return "OpenRouter API key seems too short.";
    }
  }

  return undefined;
}

export async function storeProviderKey(
  context: vscode.ExtensionContext,
  provider: string,
  key: string
): Promise<void> {
  const secretKey = getSecretKeyName(provider);
  await context.secrets.store(secretKey, key.trim());
  if (provider === "gemini") {
    // Preserve legacy key for backwards compatibility
    await context.secrets.store("solanaPilot.geminiApiKey", key.trim());
  }
}

export async function getProviderKey(
  context: vscode.ExtensionContext,
  provider: string
): Promise<string | undefined> {
  const secretKey = getSecretKeyName(provider);
  const stored = await context.secrets.get(secretKey);
  if (stored) {
    return stored;
  }
  if (provider === "gemini") {
    return await context.secrets.get("solanaPilot.geminiApiKey");
  }
  return undefined;
}

export function createSecretResolver(context: vscode.ExtensionContext): SecretResolver {
  return async (providerOrKey: string): Promise<string | undefined> => {
    return await getProviderKey(context, providerOrKey);
  };
}

export async function promptSetApiKey(
  context: vscode.ExtensionContext,
  initialProvider?: string
): Promise<void> {
  let provider = initialProvider;

  if (!provider) {
    const selected = await vscode.window.showQuickPick(
      [
        { label: "gemini", description: "Google Gemini (free tier at aistudio.google.com)" },
        { label: "anthropic", description: "Anthropic Claude (console.anthropic.com)" },
        { label: "openaiCompatible", description: "OpenAI or OpenRouter" },
      ],
      { placeHolder: "Select AI provider for the API key" }
    );

    if (!selected) return;
    provider = selected.label;
  }

  const promptText = `Enter API key for ${provider}`;
  const placeHolder = provider === "gemini" ? "AIza..." : provider === "anthropic" ? "sk-ant-..." : "sk-...";

  const inputKey = await vscode.window.showInputBox({
    prompt: promptText,
    placeHolder,
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => validateKeyForProvider(provider!, value),
  });

  if (!inputKey) return;

  await storeProviderKey(context, provider, inputKey);
  void vscode.window.showInformationMessage(`SolanaPilot: API key saved for ${provider}.`);
}
