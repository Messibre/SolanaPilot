import * as path from "path";
import * as vscode from "vscode";
import { callAI } from "./aiClient";
import {
  getWorkspaceRoot,
  type WorkspaceFile,
  writeFilesToWorkspace,
} from "./fileWriter";
import { PROGRAM_GENERATION_PROMPT } from "./systemPrompt";
import { TerminalRunner } from "./terminalRunner";

interface ProgramGenerationResponse {
  type: "full_program";
  files: WorkspaceFile[];
  programName: string;
  description: string;
  instructions: string[];
  accounts: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSnakeCaseName(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

function validateProgramGenerationResponse(
  parsed: unknown,
): ProgramGenerationResponse {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response must be a JSON object.");
  }

  const response = parsed as Record<string, unknown>;

  if (response.type !== "full_program") {
    throw new Error('AI response must include "type": "full_program".');
  }

  if (!isNonEmptyString(response.programName)) {
    throw new Error("AI response missing programName.");
  }

  if (!isSnakeCaseName(response.programName)) {
    throw new Error(
      "AI response programName must be snake_case and start with a letter.",
    );
  }

  if (!isNonEmptyString(response.description)) {
    throw new Error("AI response missing description.");
  }

  if (!Array.isArray(response.instructions)) {
    throw new Error("AI response missing instructions array.");
  }

  if (!Array.isArray(response.accounts)) {
    throw new Error("AI response missing accounts array.");
  }

  if (!Array.isArray(response.files) || response.files.length === 0) {
    throw new Error("AI response missing files array.");
  }

  const validatedFiles: WorkspaceFile[] = [];
  for (const file of response.files) {
    if (!file || typeof file !== "object") {
      throw new Error("AI response contains invalid file entries.");
    }

    const fileRecord = file as Record<string, unknown>;
    if (!isNonEmptyString(fileRecord.path)) {
      throw new Error("AI response contains a file with an invalid path.");
    }
    if (typeof fileRecord.content !== "string") {
      throw new Error(
        `AI response file ${fileRecord.path} is missing string content.`,
      );
    }

    if (path.isAbsolute(fileRecord.path)) {
      throw new Error(`Refusing to write absolute path: ${fileRecord.path}`);
    }

    const normalized = path.normalize(fileRecord.path);
    if (normalized.split(path.sep).includes("..")) {
      throw new Error(
        `Refusing to write path traversal path: ${fileRecord.path}`,
      );
    }

    validatedFiles.push({
      path: fileRecord.path,
      content: fileRecord.content,
    });
  }

  return {
    type: "full_program",
    files: validatedFiles,
    programName: response.programName,
    description: response.description,
    instructions: response.instructions.filter(isNonEmptyString),
    accounts: response.accounts.filter(isNonEmptyString),
  };
}

function buildProgramPrompt(description: string, programName: string): string {
  return `${PROGRAM_GENERATION_PROMPT}

You are an expert Solana developer. Generate a COMPLETE, DEPLOYABLE Anchor
smart contract for the following:

PROGRAM DESCRIPTION: ${description}
PROGRAM NAME: ${programName}

REQUIREMENTS:
- Use Anchor framework (not native Rust)
- Maximum 3 instructions (keep it simple for hackathon)
- Include proper PDAs where state is needed
- Include #[error_code] enum with at least 2 custom errors
- Include account validation constraints on ALL accounts (has_one, mut, signer, etc)
- Add inline comments explaining Solana-specific decisions
- The code must COMPILE with: anchor build (Anchor 0.30+, Solana 1.18+)
- Use i64 for any numeric counters/amounts to avoid overflow issues
- Every instruction must validate all inputs

ANCHOR VERSION: 0.30.0
SOLANA VERSION: 1.18.0

CRITICAL JSON FORMATTING INSTRUCTIONS:
1. Return ONLY a single valid JSON object, no markdown wrappers, no backticks
2. IMPORTANT: All newlines in code must be represented as \\n (escaped)
3. All quotes in code must be represented as \\" (escaped)
4. All backslashes must be represented as \\\\ (escaped)
5. The JSON must be valid per JSON spec and parseable by JSON.parse()
6. Do NOT include "const", "let", "export" or any explanation text before or after the JSON

OUTPUT FORMAT: Return ONLY the JSON object matching this exact schema:

{
  "type": "full_program",
  "programName": "${programName}",
  "description": "one sentence description of what this program does",
  "files": [
    {
      "path": "programs/${programName}/src/lib.rs",
      "content": "complete rust file content here WITH ALL NEWLINES ESCAPED AS \\\\n"
    },
    {
      "path": "programs/${programName}/Cargo.toml",
      "content": "complete Cargo.toml content WITH ALL NEWLINES ESCAPED AS \\\\n"
    },
    {
      "path": "Anchor.toml",
      "content": "complete Anchor.toml configured for devnet WITH ALL NEWLINES ESCAPED AS \\\\n"
    },
    {
      "path": "Cargo.toml",
      "content": "workspace Cargo.toml content WITH ALL NEWLINES ESCAPED AS \\\\n"
    },
    {
      "path": "tests/${programName}.ts",
      "content": "basic anchor test file WITH ALL NEWLINES ESCAPED AS \\\\n"
    }
  ],
  "instructions": ["list", "of", "instruction", "names"],
  "accounts": ["list", "of", "account", "struct", "names"]
}

REMEMBER: Every single file content must have \\n instead of actual newlines.
If you include actual newlines instead of \\n, the JSON will be invalid.
`;
}

function parseAIResponse(raw: string): ProgramGenerationResponse {
  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Extract JSON object
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI did not return valid JSON. Try again.");
  }

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  // Try to parse JSON with multiple repair strategies
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch (parseError) {
    let fixed: string | null = null;

    // Strategy 1: Fix unescaped newlines and control characters
    try {
      fixed = cleaned;
      // Escape bare newlines and carriage returns that aren't already escaped
      fixed = fixed.replace(/(?<!\\)\n/g, "\\n").replace(/(?<!\\)\r/g, "\\r");
      parsed = JSON.parse(fixed) as unknown;
    } catch (fixError1) {
      // Strategy 2: More aggressive - escape all literal newlines in content fields
      try {
        fixed = cleaned.replace(
          /"content"\s*:\s*"([^"\\]|\\.)*"/g,
          (match: string) => {
            // Extract the string value and escape newlines
            const value = match.substring(0, match.length);
            const escaped = value
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
              .replace(/\t/g, "\\t");
            return escaped;
          },
        );
        parsed = JSON.parse(fixed) as unknown;
      } catch (fixError2) {
        // Strategy 3: Try replacing common JSON structural issues
        try {
          fixed = cleaned
            // Fix missing commas between properties
            .replace(/"\s*\n\s*"/g, '", "')
            // Fix escaped backslashes in content
            .replace(/\\\\n/g, "\\n")
            .replace(/\\\\r/g, "\\r");
          parsed = JSON.parse(fixed) as unknown;
        } catch (fixError3) {
          // Final attempt: log all errors for debugging
          const errorLines = [
            `Original error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            `Fix attempt 1 error: ${fixError1 instanceof Error ? fixError1.message : String(fixError1)}`,
            `Fix attempt 2 error: ${fixError2 instanceof Error ? fixError2.message : String(fixError2)}`,
            `Fix attempt 3 error: ${fixError3 instanceof Error ? fixError3.message : String(fixError3)}`,
          ];

          const contextStart = Math.max(0, 500);
          const contextEnd = Math.min(cleaned.length, 800);
          const errorContext = cleaned.substring(contextStart, contextEnd);

          throw new Error(
            `Failed to parse AI response as JSON after 3 repair attempts.\n${errorLines.join("\n")}\n\nJSON preview: ...${errorContext}...`,
          );
        }
      }
    }
  }

  return validateProgramGenerationResponse(parsed);
}

async function callAIWithSingleRetry(
  prompt: string,
): Promise<ProgramGenerationResponse> {
  let lastError: Error | null = null;

  // Try original request
  try {
    const rawResponse = await callAI(prompt, "", true);
    return parseAIResponse(rawResponse);
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    console.error("[SolanaPilot] Initial AI response parse failed:", lastError);
  }

  // Try retry with clearer instructions
  try {
    vscode.window.showInformationMessage(
      "Retrying program generation with stricter JSON format...",
    );
    const retryPrompt = `${prompt}

IMPORTANT: Your previous response was not valid JSON.
Return ONLY the complete JSON object, starting with { and ending with }.
Do NOT include any markdown, backticks, or explanation text.
Ensure all newlines in string values are escaped as \\n`;

    const retryResponse = await callAI(retryPrompt, "", true);
    return parseAIResponse(retryResponse);
  } catch (retryError) {
    lastError =
      retryError instanceof Error ? retryError : new Error(String(retryError));
    console.error("[SolanaPilot] Retry parse failed:", lastError);
  }

  // Show error and offer chat help
  const retryMessage = lastError?.message || "Unknown AI error";
  const choice = await vscode.window.showErrorMessage(
    `Failed to generate valid program JSON: ${retryMessage}\n\nTry adjusting your description or opening Chat for help.`,
    "Open Chat",
    "Try Again",
  );

  if (choice === "Open Chat") {
    void vscode.commands.executeCommand("solanaCopilot.openChat");
  } else if (choice === "Try Again") {
    return callAIWithSingleRetry(prompt);
  }

  throw new Error(retryMessage);
}

export async function generateAndDeploy(
  context: vscode.ExtensionContext,
): Promise<void> {
  void context;

  try {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage(
        "Please open a folder first (File -> Open Folder)",
      );
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: "🧠 Describe your Solana program",
      placeHolder:
        "e.g. A voting program where users create polls and cast votes on-chain",
      ignoreFocusOut: true,
      validateInput: (val) =>
        val.trim().length < 10
          ? "Please describe your program in more detail (min 10 characters)"
          : undefined,
    });

    if (!description) {
      return;
    }

    const suggestedName = description
      .split(" ")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

    const rawName = await vscode.window.showInputBox({
      prompt: "📦 Program name (snake_case)",
      placeHolder: "e.g. voting_program",
      value: suggestedName,
      validateInput: (val) =>
        /^[a-z][a-z0-9_]*$/.test(val)
          ? undefined
          : "Use only lowercase letters, numbers, and underscores. Must start with a letter.",
    });

    if (!rawName) {
      return;
    }

    const programName = rawName.trim();
    let generated: ProgramGenerationResponse | undefined;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `⚡ SolanaPilot: Generating "${programName}"...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          message: "Crafting your Solana program with Gemini AI...",
        });
        const fullPrompt = buildProgramPrompt(description, programName);
        generated = await callAIWithSingleRetry(fullPrompt);

        progress.report({ message: "Parsing generated code..." });
        if (!generated) {
          throw new Error("No AI response received");
        }
      },
    );

    if (!generated) {
      return;
    }

    // Ask for confirmation before writing files to workspace
    const confirmWrite = await vscode.window.showInformationMessage(
      `⚠️ About to write ${generated.files.length} files to your workspace:\n\n${generated.files.map((f) => `• ${f.path}`).join("\n")}\n\nDo you want to proceed?`,
      { modal: true },
      "Yes, Write Files",
      "Cancel",
    );

    if (confirmWrite !== "Yes, Write Files") {
      vscode.window.showInformationMessage("Program generation cancelled.");
      return;
    }

    // Now write files after confirmation
    const wrote = await writeFilesToWorkspace(generated.files);
    if (!wrote) {
      throw new Error("Failed to write generated files to workspace");
    }

    const files = generated.files;
    const choice = await vscode.window.showInformationMessage(
      `✅ "${programName}" generated! ${files.length} files written. Ready to deploy?`,
      { modal: false },
      "Deploy to Devnet",
      "View Code Only",
      "Also Generate Frontend",
    );

    if (choice === "Deploy to Devnet") {
      const runner = TerminalRunner.getInstance();
      runner.runDeploy(workspaceRoot);
    } else if (choice === "Also Generate Frontend") {
      const runner = TerminalRunner.getInstance();
      runner.runDeploy(workspaceRoot);
      void vscode.window.showInformationMessage(
        '🏗️ Deploy running. Run "SolanaPilot: Generate Frontend" after deploy completes.',
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generator error";
    vscode.window.showErrorMessage(
      `SolanaPilot could not generate the program: ${message}`,
    );
  }
}
