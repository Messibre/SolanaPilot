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
  files: WorkspaceFile[];
  programName: string;
  description: string;
  instructions: string[];
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

  // Try to parse JSON, with improved error handling
  let parsed: Partial<ProgramGenerationResponse>;
  try {
    parsed = JSON.parse(cleaned) as Partial<ProgramGenerationResponse>;
  } catch (parseError) {
    // If parsing fails, try to fix common issues with unescaped newlines
    // This is a workaround for AI models returning JSON with actual newlines in strings
    try {
      // Replace actual newlines inside JSON strings with escaped newlines
      // This regex is conservative and only replaces newlines in content values
      let fixed = cleaned.replace(
        /"content":\s*"([^"]*)"/g,
        (match: string) => {
          const escaped = match
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");
          return escaped;
        },
      );

      parsed = JSON.parse(fixed) as Partial<ProgramGenerationResponse>;
    } catch (fixError) {
      // Last resort: show helpful error with context
      const errorContext = cleaned.substring(
        Math.max(0, 1100 - 200),
        Math.min(cleaned.length, 1100 + 200),
      );
      throw new Error(
        `Failed to parse AI response as JSON. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}\n\nContext around error: ...${errorContext}...`,
      );
    }
  }

  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error("AI response missing files array");
  }
  if (parsed.files.length === 0) {
    throw new Error("AI returned empty files array");
  }
  if (
    parsed.files.some(
      (file) =>
        !file ||
        typeof file.path !== "string" ||
        file.path.trim().length === 0 ||
        typeof file.content !== "string",
    )
  ) {
    throw new Error("AI response contains invalid file entries");
  }

  return {
    files: parsed.files,
    programName:
      typeof parsed.programName === "string" ? parsed.programName : "",
    description:
      typeof parsed.description === "string" ? parsed.description : "",
    instructions: Array.isArray(parsed.instructions)
      ? parsed.instructions.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

async function callAIWithSingleRetry(
  prompt: string,
): Promise<ProgramGenerationResponse> {
  try {
    const rawResponse = await callAI(prompt, "", true);
    return parseAIResponse(rawResponse);
  } catch (error) {
    vscode.window.showErrorMessage("Failed to parse AI response. Retrying...");
    const retryPrompt = `${prompt}

Your previous response was not valid JSON.
Return ONLY the JSON object with no other text.`;

    try {
      const retryResponse = await callAI(retryPrompt, "", true);
      return parseAIResponse(retryResponse);
    } catch (retryError) {
      const retryMessage =
        retryError instanceof Error ? retryError.message : "Unknown AI error";
      const choice = await vscode.window.showErrorMessage(
        `Failed to generate valid program JSON: ${retryMessage}`,
        "Open Chat",
      );

      if (choice === "Open Chat") {
        void vscode.commands.executeCommand("solanaCopilot.openChat");
      }

      throw new Error(retryMessage);
    }
  }
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
