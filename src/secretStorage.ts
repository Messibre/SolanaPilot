/**
 * Legacy secret storage adapter, delegates to src/vscodeAdapters/secretStorage.ts.
 * Preserved for backwards compatibility until old clients are retired in T-029.
 */

import * as vscode from "vscode";
import {
  storeProviderKey,
  getProviderKey,
  promptSetApiKey,
} from "./vscodeAdapters/secretStorage";

export async function saveApiKey(
  context: vscode.ExtensionContext,
  key: string
): Promise<void> {
  await storeProviderKey(context, "gemini", key);
}

export async function getApiKey(
  context: vscode.ExtensionContext,
  silent = false
): Promise<string | undefined> {
  const key = await getProviderKey(context, "gemini");
  if (key || silent) {
    return key;
  }

  await promptSetApiKey(context, "gemini");
  return await getProviderKey(context, "gemini");
}
