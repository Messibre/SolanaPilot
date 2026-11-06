/**
 * Pure prerequisite checking and first-run decision logic.
 * Zero VS Code dependencies per Agent.md §6.
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export interface ParsedToolVersion {
  raw: string;
  version: string;
  semver: SemVer | null;
}

export interface AnchorVersionCheck {
  supported: boolean;
  version?: string;
  warning?: string;
}

export interface ToolStatus {
  solanaInstalled: boolean;
  solanaVersion?: string;
  anchorInstalled: boolean;
  anchorVersion?: string;
  anchorSupported: boolean;
  anchorWarning?: string;
}

export interface ToolNotice {
  severity: "info" | "warning" | "error";
  tool: "solana" | "anchor";
  message: string;
}

export interface FirstRunInputs {
  hasRunBefore: boolean;
  provider: string;
  hasApiKey: boolean;
}

export interface FirstRunRecommendation {
  shouldPrompt: boolean;
  recommendOllama: boolean;
  message: string;
}

export interface PrereqSessionState {
  toolNoticesShown: boolean;
}

/**
 * Parses a standard semver string (e.g. "1.18.26", "0.31.0-alpha.1").
 */
export function parseSemver(versionStr: string): SemVer | null {
  if (!versionStr) {
    return null;
  }
  const match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Extracts and parses semver from CLI version output strings.
 * Examples:
 *   "solana-cli 1.18.26 (src:00000000; feat:123456789, client:Agave)"
 *   "anchor-cli 0.31.0"
 */
export function parseToolVersion(rawOutput: string): ParsedToolVersion | null {
  if (!rawOutput) {
    return null;
  }
  const match = rawOutput.match(/(?:solana-cli|anchor-cli|solana|anchor)?\s*(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/i);
  if (!match) {
    return null;
  }
  const version = match[1];
  const semver = parseSemver(version);
  return {
    raw: rawOutput,
    version,
    semver,
  };
}

/**
 * Checks whether an Anchor CLI version meets minimum requirements (Anchor >= 0.31).
 */
export function checkAnchorVersion(rawOutput: string): AnchorVersionCheck {
  const parsed = parseToolVersion(rawOutput);
  if (!parsed || !parsed.semver) {
    return {
      supported: false,
      warning: "Unable to detect Anchor version. SolanaPilot requires Anchor >= 0.31.",
    };
  }

  const { major, minor } = parsed.semver;
  if (major > 0 || (major === 0 && minor >= 31)) {
    return {
      supported: true,
      version: parsed.version,
    };
  }

  return {
    supported: false,
    version: parsed.version,
    warning: `Anchor >= 0.31 is required for SolanaPilot 2.0 (detected ${parsed.version}).`,
  };
}

/**
 * Evaluates tool statuses and generates human-readable missing or outdated tool notices.
 */
export function evaluateToolNotices(status: ToolStatus): ToolNotice[] {
  const notices: ToolNotice[] = [];

  if (!status.solanaInstalled) {
    notices.push({
      severity: "warning",
      tool: "solana",
      message: "Solana CLI is not installed or not in PATH.",
    });
  }

  if (!status.anchorInstalled) {
    notices.push({
      severity: "warning",
      tool: "anchor",
      message: "Anchor CLI is not installed or not in PATH.",
    });
  } else if (!status.anchorSupported) {
    notices.push({
      severity: "warning",
      tool: "anchor",
      message: status.anchorWarning ?? "Anchor version is unsupported. SolanaPilot requires Anchor >= 0.31.",
    });
  }

  return notices;
}

/**
 * Evaluates whether to present the first-run configuration flow.
 * If user has no API key configured for a cloud provider, offers Ollama (local offline).
 */
export function evaluateFirstRun(inputs: FirstRunInputs): FirstRunRecommendation {
  if (inputs.hasRunBefore) {
    return {
      shouldPrompt: false,
      recommendOllama: false,
      message: "",
    };
  }

  if (inputs.provider !== "ollama" && !inputs.hasApiKey) {
    return {
      shouldPrompt: true,
      recommendOllama: true,
      message: `No API key configured for provider "${inputs.provider}". You can use local Ollama (free, private) or configure your API key now.`,
    };
  }

  return {
    shouldPrompt: false,
    recommendOllama: false,
    message: "",
  };
}

/**
 * Factory for in-memory session prerequisite state.
 */
export function createPrereqSessionState(): PrereqSessionState {
  return {
    toolNoticesShown: false,
  };
}

/**
 * Checks if missing tool notices should be shown in the current session.
 */
export function shouldShowToolNotices(session: PrereqSessionState): boolean {
  return !session.toolNoticesShown;
}

/**
 * Marks tool notices as shown for this session.
 */
export function markToolNoticesShown(session: PrereqSessionState): void {
  session.toolNoticesShown = true;
}
