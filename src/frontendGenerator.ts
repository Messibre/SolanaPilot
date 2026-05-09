import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { callAI } from "./aiClient";
import { writeFilesToWorkspace } from "./fileWriter";
import { FRONTEND_PROMPT } from "./systemPrompt";
import { TerminalRunner } from "./terminalRunner";

interface FrontendGenerationResponse {
  type: "frontend";
  files?: Array<{ path: string; content: string }>;
  startCommand?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateFrontendGenerationResponse(
  parsed: unknown,
): FrontendGenerationResponse {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response must be a JSON object.");
  }

  const response = parsed as Record<string, unknown>;

  if (response.type !== "frontend") {
    throw new Error('AI response must include "type": "frontend".');
  }

  if (!Array.isArray(response.files) || response.files.length === 0) {
    throw new Error("AI response missing files array.");
  }

  const files = response.files.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("AI response contains invalid file entries.");
    }

    const fileRecord = file as Record<string, unknown>;
    if (!isNonEmptyString(fileRecord.path)) {
      throw new Error("AI response contains a file with an invalid path.");
    }

    if (typeof fileRecord.content !== "string") {
      throw new Error(`File content for ${fileRecord.path} is not a string.`);
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

    if (Buffer.byteLength(fileRecord.content, "utf-8") > 1_000_000) {
      throw new Error(
        `File too large: ${fileRecord.path} exceeds 1000000 bytes`,
      );
    }

    return {
      path: fileRecord.path,
      content: fileRecord.content,
    };
  });

  return {
    type: "frontend",
    files,
    startCommand: isNonEmptyString(response.startCommand)
      ? response.startCommand
      : undefined,
  };
}

async function findIDLFile(workspaceRoot: string): Promise<string | null> {
  try {
    const idlDir = path.join(workspaceRoot, "target", "idl");

    if (!fs.existsSync(idlDir)) {
      return null;
    }

    const files = fs.readdirSync(idlDir);
    const idlFile = files
      .filter((file) => file.endsWith(".json") && !file.endsWith("_test.json"))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(idlDir, a));
        const statB = fs.statSync(path.join(idlDir, b));
        return statB.mtimeMs - statA.mtimeMs;
      })[0];

    return idlFile ? path.join(idlDir, idlFile) : null;
  } catch {
    return null;
  }
}

async function extractProgramID(workspaceRoot: string): Promise<string | null> {
  try {
    const anchorToml = path.join(workspaceRoot, "Anchor.toml");

    if (!fs.existsSync(anchorToml)) {
      return null;
    }

    const content = fs.readFileSync(anchorToml, "utf-8");
    const lines = content.split(/\r?\n/);
    let inDevnetSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        inDevnetSection = trimmed === "[programs.devnet]";
        continue;
      }

      if (!inDevnetSection || trimmed.length === 0 || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(
        /^[A-Za-z0-9_]+\s*=\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"$/,
      );
      if (match) {
        return match[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseFrontendResponse(raw: string): FrontendGenerationResponse {
  let cleaned = raw.trim();

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
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI response does not contain valid JSON.");
  }

  const slice = cleaned.slice(jsonStart, jsonEnd + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(slice) as unknown;
  } catch {
    throw new Error("AI response JSON is malformed.");
  }

  return validateFrontendGenerationResponse(parsed);
}

function buildFrontendPrompt(idlJson: unknown, programId: string): string {
  return FRONTEND_PROMPT.replace(
    "{IDL}",
    JSON.stringify(idlJson, null, 2),
  ).replace("{PROGRAM_ID}", programId);
}

async function callFrontendAIWithRetry(
  prompt: string,
): Promise<FrontendGenerationResponse> {
  try {
    const rawResponse = await callAI(prompt, "", true);
    return parseFrontendResponse(rawResponse);
  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to parse frontend response. Retrying once...",
    );
    const retryPrompt = `${prompt}

Your previous response was not valid JSON.
Return ONLY the JSON object with no other text.`;
    const retryResponse = await callAI(retryPrompt, "", true);
    return parseFrontendResponse(retryResponse);
  }
}

export async function generateFrontend(workspaceRoot: string): Promise<void> {
  try {
    const idlFilePath = await findIDLFile(workspaceRoot);
    if (!idlFilePath) {
      void vscode.window.showErrorMessage(
        "No Anchor IDL found. Build your program first with `anchor build`.",
      );
      return;
    }

    let idlJson: unknown;
    try {
      idlJson = JSON.parse(fs.readFileSync(idlFilePath, "utf-8"));
    } catch {
      void vscode.window.showErrorMessage(
        "Failed to parse the IDL file. Make sure `anchor build` completed successfully.",
      );
      return;
    }

    let programId = await extractProgramID(workspaceRoot);
    if (!programId) {
      const input = await vscode.window.showInputBox({
        prompt: "Enter the Program ID for this Anchor app",
        placeHolder: "e.g. 11111111111111111111111111111111",
        ignoreFocusOut: true,
        validateInput: (value) =>
          value.trim().length >= 32
            ? undefined
            : "Program ID must be at least 32 characters.",
      });

      if (!input) {
        return;
      }

      programId = input.trim();
    }

    let generated: FrontendGenerationResponse | undefined;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "SolanaPilot: Generating React frontend...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Generating frontend files..." });
        const fullPrompt = buildFrontendPrompt(idlJson, programId!);
        generated = await callFrontendAIWithRetry(fullPrompt);

        if (!generated?.files?.length) {
          throw new Error("No frontend files were generated.");
        }

        progress.report({ message: "Writing frontend files..." });
        const wrote = await writeFilesToWorkspace(generated.files);
        if (!wrote) {
          throw new Error("Failed to write generated frontend files.");
        }
      },
    );

    if (!generated?.files?.length) {
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      "Frontend generated. Start the dev server now?",
      "Start Now",
      "Later",
    );

    if (choice === "Start Now") {
      await startDevServer(workspaceRoot);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown frontend generation error";
    void vscode.window.showErrorMessage(
      `Frontend generation failed: ${message}`,
    );
  }
}

async function startDevServer(workspaceRoot: string): Promise<void> {
  const runner = TerminalRunner.getInstance();
  await runner.runFrontendSetup(workspaceRoot);
}
