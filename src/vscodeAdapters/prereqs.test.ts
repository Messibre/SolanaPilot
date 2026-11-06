import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as vscode from "vscode";

const mockShowInformationMessage = vi.fn();
const mockShowWarningMessage = vi.fn();
const mockUpdateConfig = vi.fn();
const mockGetConfig = vi.fn();
const mockGlobalStateGet = vi.fn();
const mockGlobalStateUpdate = vi.fn();
const mockPromptSetApiKey = vi.fn();
const mockGetProviderKey = vi.fn();

vi.mock("vscode", () => ({
  window: {
    showInformationMessage: (...args: unknown[]) => mockShowInformationMessage(...args),
    showWarningMessage: (...args: unknown[]) => mockShowWarningMessage(...args),
  },
  workspace: {
    getConfiguration: () => ({
      get: (...args: unknown[]) => mockGetConfig(...args),
      update: (...args: unknown[]) => mockUpdateConfig(...args),
    }),
  },
  ConfigurationTarget: {
    Global: 1,
  },
}));

vi.mock("./secretStorage", () => ({
  getProviderKey: (...args: unknown[]) => mockGetProviderKey(...args),
  promptSetApiKey: (...args: unknown[]) => mockPromptSetApiKey(...args),
}));

vi.mock("child_process", () => ({
  execFile: vi.fn(
    (
      cmd: string,
      args: string[],
      opts: unknown,
      cb?: (err: Error | null, res: { stdout: string; stderr: string }) => void
    ) => {
      const callback = typeof opts === "function" ? (opts as typeof cb) : cb;
      if (cmd === "solana") {
        callback?.(null, { stdout: "solana-cli 1.18.26\n", stderr: "" });
      } else if (cmd === "anchor") {
        callback?.(null, { stdout: "anchor-cli 0.31.0\n", stderr: "" });
      } else {
        callback?.(new Error("Command not found"), { stdout: "", stderr: "" });
      }
    }
  ),
}));

import { runFirstRunFlow, checkPrerequisitesOncePerSession } from "./prereqs";

interface MockExtensionContext {
  globalState: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

describe("vscodeAdapters/prereqs", () => {
  let fakeContext: MockExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeContext = {
      globalState: {
        get: mockGlobalStateGet,
        update: mockGlobalStateUpdate,
      },
    };
  });

  it("skips first run flow if already run before", async () => {
    mockGlobalStateGet.mockReturnValue(true);

    await runFirstRunFlow(fakeContext as unknown as vscode.ExtensionContext);

    expect(mockShowInformationMessage).not.toHaveBeenCalled();
    expect(mockGlobalStateUpdate).not.toHaveBeenCalled();
  });

  it("prompts user and updates config to Ollama if selected", async () => {
    mockGlobalStateGet.mockReturnValue(false);
    mockGetConfig.mockReturnValue("gemini");
    mockGetProviderKey.mockResolvedValue("");
    mockShowInformationMessage.mockResolvedValue("Use Ollama (Local)");

    await runFirstRunFlow(fakeContext as unknown as vscode.ExtensionContext);

    expect(mockShowInformationMessage).toHaveBeenCalled();
    expect(mockUpdateConfig).toHaveBeenCalledWith("provider", "ollama", 1);
    expect(mockGlobalStateUpdate).toHaveBeenCalledWith("solanaPilot.hasRunBefore", true);
  });

  it("prompts user and calls promptSetApiKey if Set API Key selected", async () => {
    mockGlobalStateGet.mockReturnValue(false);
    mockGetConfig.mockReturnValue("anthropic");
    mockGetProviderKey.mockResolvedValue("");
    mockShowInformationMessage.mockResolvedValue("Set API Key");

    await runFirstRunFlow(fakeContext as unknown as vscode.ExtensionContext);

    expect(mockShowInformationMessage).toHaveBeenCalled();
    expect(mockPromptSetApiKey).toHaveBeenCalledWith(
      fakeContext as unknown as vscode.ExtensionContext
    );
    expect(mockGlobalStateUpdate).toHaveBeenCalledWith("solanaPilot.hasRunBefore", true);
  });

  it("does not prompt if key already exists on first run", async () => {
    mockGlobalStateGet.mockReturnValue(false);
    mockGetConfig.mockReturnValue("gemini");
    mockGetProviderKey.mockResolvedValue("AIzaSyFakeKey");

    await runFirstRunFlow(fakeContext as unknown as vscode.ExtensionContext);

    expect(mockShowInformationMessage).not.toHaveBeenCalled();
  });

  it("runs prerequisite checks without throwing", async () => {
    mockGlobalStateGet.mockReturnValue(true);

    await expect(
      checkPrerequisitesOncePerSession(fakeContext as unknown as vscode.ExtensionContext)
    ).resolves.not.toThrow();
  });
});
