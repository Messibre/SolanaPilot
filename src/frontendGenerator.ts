import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { LlmClient } from "./ai/types";
import { LlmGateway, type ClientFactory } from "./ai/gateway";
import { GeminiClient } from "./ai/providers/gemini";
import { AnthropicClient } from "./ai/providers/anthropic";
import { OpenAiCompatibleClient } from "./ai/providers/openaiCompatible";
import { OllamaClient } from "./ai/providers/ollama";
import { MockLlmClient } from "./ai/providers/mock";
import { loadConfig } from "./core/config";
import type { ProviderId } from "./core/validation";
import { writeFilesToWorkspace } from "./fileWriter";
import { TerminalRunner } from "./terminalRunner";
import {
  frontendStage,
  type FrontendGenerationResponse,
} from "./agent/stages/frontend";

export {
  FrontendFileSchema,
  FrontendGenerationSchema,
  frontendStage,
  buildFrontendPrompt,
  type FrontendGenerationResponse,
  type FrontendStageInput,
} from "./agent/stages/frontend";

export async function findIDLFile(workspaceRoot: string): Promise<string | null> {
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

export async function extractProgramID(workspaceRoot: string): Promise<string | null> {
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

function createDefaultGateway(): LlmClient {
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

  const defaultFactory: ClientFactory = (id: ProviderId, cfg, apiKey) => {
    if (id === "gemini") {
      return new GeminiClient({ apiKey: apiKey ?? "", defaultModel: cfg.model });
    }
    if (id === "anthropic") {
      return new AnthropicClient({ apiKey, defaultModel: cfg.model });
    }
    if (id === "openaiCompatible") {
      return new OpenAiCompatibleClient({
        preset: "openai",
        apiKey,
        baseUrl: cfg.customEndpoint.url,
        defaultModel: cfg.model,
        isLocal: cfg.customEndpoint.isLocal,
      });
    }
    if (id === "ollama") {
      return new OllamaClient({
        baseUrl: cfg.ollama.baseUrl,
        defaultModel: cfg.model,
      });
    }
    return new MockLlmClient();
  };

  const gateway = new LlmGateway({
    config,
    secrets: secretResolver,
    clientFactory: defaultFactory,
  });

  return {
    id: config.provider,
    generate: (req) => gateway.generate(req),
    healthCheck: async () => {},
  };
}

export async function generateFrontend(
  workspaceRoot: string,
  clientOverride?: LlmClient
): Promise<void> {
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
        progress.report({ message: "Generating frontend files with AI..." });
        const client = clientOverride ?? createDefaultGateway();
        generated = await frontendStage({
          client,
          idlJson,
          programId: programId!,
        });
      },
    );

    if (!generated?.files?.length) {
      throw new Error("No frontend files were generated.");
    }

    const appExists = fs.existsSync(path.join(workspaceRoot, "app"));
    const confirmWrite = await vscode.window.showWarningMessage(
      `About to write ${generated.files.length} frontend files to your workspace${
        appExists ? " and overwrite files inside the existing app folder" : ""
      }:\n\n${generated.files.map((file) => `• ${file.path}`).join("\n")}`,
      { modal: true },
      "Yes, Write Frontend",
      "Cancel",
    );

    if (confirmWrite !== "Yes, Write Frontend") {
      void vscode.window.showInformationMessage(
        "Frontend generation cancelled before writing files.",
      );
      return;
    }

    const wrote = await writeFilesToWorkspace(generated.files);
    if (!wrote) {
      throw new Error("Failed to write generated frontend files.");
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
