import * as vscode from "vscode";

/**
 * Save API key to VS Code's secure secret storage
 */
export async function saveApiKey(
  context: vscode.ExtensionContext,
  key: string,
): Promise<void> {
  try {
    await context.secrets.store("solanaPilot.geminiApiKey", key);
    console.log("[SolanaPilot] API key saved to secure storage");
  } catch (err) {
    console.error("[SolanaPilot] Error saving API key:", err);
    throw err;
  }
}

/**
 * Retrieve API key from VS Code's secure secret storage.
 * If not found and not silent, prompts user to enter their API key.
 *
 * @param context   Extension context
 * @param silent    If true: don't prompt, just return undefined if not found
 * @returns API key string or undefined
 */
export async function getApiKey(
  context: vscode.ExtensionContext,
  silent: boolean = false,
): Promise<string | undefined> {
  try {
    // Try to retrieve stored key
    const storedKey = await context.secrets.get("solanaPilot.geminiApiKey");

    if (storedKey) {
      return storedKey;
    }

    // If not found and in silent mode, return undefined
    if (silent) {
      return undefined;
    }

    // Prompt user for API key
    const userKey = await vscode.window.showInputBox({
      prompt: "Enter your Gemini API key (free at aistudio.google.com)",
      placeHolder: "AIza...",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return "API key cannot be empty";
        }
        if (!trimmed.startsWith("AIza")) {
          return 'Gemini API keys typically start with "AIza"';
        }
        if (trimmed.length < 20) {
          return "API key seems too short. Make sure you copied it fully.";
        }
        return undefined;
      },
    });

    if (userKey) {
      // Save the key
      await saveApiKey(context, userKey);
      return userKey;
    }

    // User cancelled
    await vscode.window.showErrorMessage(
      "API key is required for SolanaPilot to work",
    );
    return undefined;
  } catch (err) {
    console.error("[SolanaPilot] Error getting API key:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(
      `Error accessing API key: ${errorMessage}`,
    );
    return undefined;
  }
}
