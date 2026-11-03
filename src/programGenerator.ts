/**
 * Legacy Program Generator Migration Adapter.
 * Migrated to modular agent stages in src/agent/stages/.
 * Provides backward-compatible generateAndDeploy() entry point for VS Code extension commands.
 * Strictly adheres to Agent.md §6, §8, and §10.
 */

import * as vscode from "vscode";
import { getWorkspaceRoot } from "./fileWriter";
import { loadConfig } from "./core/config";
import type { ProviderId } from "./core/validation";
import type { LlmClient } from "./ai/types";
import { LlmGateway, type ClientFactory } from "./ai/gateway";
import { GeminiClient } from "./ai/providers/gemini";
import { AnthropicClient } from "./ai/providers/anthropic";
import { OpenAiCompatibleClient } from "./ai/providers/openaiCompatible";
import { OllamaClient } from "./ai/providers/ollama";
import { MockLlmClient } from "./ai/providers/mock";
import { runPipeline } from "./agent/stages/pipelineRunner";

function createGateway(): LlmClient {
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

/**
 * VS Code command handler for "solanaCopilot.generateProgram".
 * Prompts user for description and name, then runs the agent pipeline.
 */
export async function generateAndDeploy(context: vscode.ExtensionContext): Promise<void> {
  void context;

  try {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      void vscode.window.showErrorMessage("Please open a folder first (File -> Open Folder)");
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: "🧠 Describe your Solana program",
      placeHolder: "e.g. A voting program where users create polls and cast votes on-chain",
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
    const gateway = createGateway();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SolanaPilot: Building "${programName}"...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Running pipeline..." });

        const result = await runPipeline({
          workspaceRoot,
          client: gateway,
          userPrompt: description,
          programName,
          confirmDeploy: async () => {
            const answer = await vscode.window.showInformationMessage(
              `Deploy "${programName}" to Solana Devnet?`,
              { modal: true },
              "Deploy to Devnet",
              "Skip Deploy"
            );
            return answer === "Deploy to Devnet";
          },
          onTransition: (stage) => {
            progress.report({ message: `Stage: ${stage}` });
          },
          onOutput: (msg) => {
            // Can be piped to output channel
            void msg;
          },
        });

        if (!result.ok) {
          throw new Error(result.error ?? "Pipeline execution failed");
        }

        void vscode.window.showInformationMessage(
          `✨ "${programName}" generation completed successfully at stage: ${result.finalStage}`
        );
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    void vscode.window.showErrorMessage(`SolanaPilot could not complete generation: ${message}`);
  }
}
