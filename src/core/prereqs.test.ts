import { describe, it, expect } from "vitest";
import {
  parseSemver,
  parseToolVersion,
  checkAnchorVersion,
  evaluateToolNotices,
  evaluateFirstRun,
  createPrereqSessionState,
  shouldShowToolNotices,
  markToolNoticesShown,
} from "./prereqs";

describe("core/prereqs", () => {
  describe("parseSemver", () => {
    it("parses standard semver strings", () => {
      expect(parseSemver("1.18.26")).toEqual({ major: 1, minor: 18, patch: 26 });
      expect(parseSemver("0.31.0")).toEqual({ major: 0, minor: 31, patch: 0 });
      expect(parseSemver("0.30.1")).toEqual({ major: 0, minor: 30, patch: 1 });
    });

    it("handles semver with pre-release tags or trailing text", () => {
      expect(parseSemver("0.31.0-alpha.1")).toEqual({ major: 0, minor: 31, patch: 0 });
      expect(parseSemver("2.0.0 (src:00000000)")).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    it("returns null for non-semver strings", () => {
      expect(parseSemver("unknown")).toBeNull();
      expect(parseSemver("")).toBeNull();
    });
  });

  describe("parseToolVersion", () => {
    it("parses solana cli output", () => {
      const output = "solana-cli 1.18.26 (src:00000000; feat:123456789, client:Agave)";
      const parsed = parseToolVersion(output);
      expect(parsed).toEqual({
        raw: output,
        version: "1.18.26",
        semver: { major: 1, minor: 18, patch: 26 },
      });
    });

    it("parses anchor cli output", () => {
      const output = "anchor-cli 0.31.0";
      const parsed = parseToolVersion(output);
      expect(parsed).toEqual({
        raw: output,
        version: "0.31.0",
        semver: { major: 0, minor: 31, patch: 0 },
      });
    });

    it("returns null for empty or unrecognized output", () => {
      expect(parseToolVersion("")).toBeNull();
      expect(parseToolVersion("command not found")).toBeNull();
    });
  });

  describe("checkAnchorVersion", () => {
    it("approves Anchor >= 0.31.0", () => {
      const result = checkAnchorVersion("anchor-cli 0.31.0");
      expect(result.supported).toBe(true);
      expect(result.version).toBe("0.31.0");
      expect(result.warning).toBeUndefined();
    });

    it("approves Anchor 0.32.0 and higher", () => {
      const result = checkAnchorVersion("anchor-cli 0.32.1");
      expect(result.supported).toBe(true);
      expect(result.version).toBe("0.32.1");
    });

    it("warns when Anchor < 0.31.0", () => {
      const result = checkAnchorVersion("anchor-cli 0.30.1");
      expect(result.supported).toBe(false);
      expect(result.version).toBe("0.30.1");
      expect(result.warning).toContain("Anchor >= 0.31 is required");
    });

    it("warns when Anchor version cannot be parsed", () => {
      const result = checkAnchorVersion("not a version string");
      expect(result.supported).toBe(false);
      expect(result.warning).toContain("Unable to detect Anchor version");
    });
  });

  describe("evaluateToolNotices", () => {
    it("returns notice if Solana CLI is missing", () => {
      const notices = evaluateToolNotices({
        solanaInstalled: false,
        anchorInstalled: true,
        anchorVersion: "0.31.0",
        anchorSupported: true,
      });
      expect(notices).toContainEqual({
        severity: "warning",
        tool: "solana",
        message: "Solana CLI is not installed or not in PATH.",
      });
    });

    it("returns notice if Anchor CLI is missing", () => {
      const notices = evaluateToolNotices({
        solanaInstalled: true,
        solanaVersion: "1.18.26",
        anchorInstalled: false,
        anchorSupported: false,
      });
      expect(notices).toContainEqual({
        severity: "warning",
        tool: "anchor",
        message: "Anchor CLI is not installed or not in PATH.",
      });
    });

    it("returns warning if Anchor version is < 0.31", () => {
      const notices = evaluateToolNotices({
        solanaInstalled: true,
        solanaVersion: "1.18.26",
        anchorInstalled: true,
        anchorVersion: "0.30.1",
        anchorSupported: false,
        anchorWarning: "Anchor >= 0.31 is required for SolanaPilot 2.0 (detected 0.30.1).",
      });
      expect(notices).toContainEqual({
        severity: "warning",
        tool: "anchor",
        message: "Anchor >= 0.31 is required for SolanaPilot 2.0 (detected 0.30.1).",
      });
    });

    it("returns empty array when all tools are installed and supported", () => {
      const notices = evaluateToolNotices({
        solanaInstalled: true,
        solanaVersion: "1.18.26",
        anchorInstalled: true,
        anchorVersion: "0.31.0",
        anchorSupported: true,
      });
      expect(notices).toHaveLength(0);
    });
  });

  describe("evaluateFirstRun", () => {
    it("does not prompt if extension has run before", () => {
      const res = evaluateFirstRun({
        hasRunBefore: true,
        provider: "gemini",
        hasApiKey: false,
      });
      expect(res.shouldPrompt).toBe(false);
    });

    it("prompts and recommends Ollama if first run with no API key", () => {
      const res = evaluateFirstRun({
        hasRunBefore: false,
        provider: "gemini",
        hasApiKey: false,
      });
      expect(res.shouldPrompt).toBe(true);
      expect(res.recommendOllama).toBe(true);
      expect(res.message).toContain("No API key configured");
      expect(res.message).toContain("Ollama");
    });

    it("does not prompt if first run already configured with an API key", () => {
      const res = evaluateFirstRun({
        hasRunBefore: false,
        provider: "gemini",
        hasApiKey: true,
      });
      expect(res.shouldPrompt).toBe(false);
    });

    it("does not prompt if first run provider is already ollama", () => {
      const res = evaluateFirstRun({
        hasRunBefore: false,
        provider: "ollama",
        hasApiKey: false,
      });
      expect(res.shouldPrompt).toBe(false);
    });
  });

  describe("session-cached notice checks", () => {
    it("shows notices only once per session", () => {
      const session = createPrereqSessionState();
      expect(shouldShowToolNotices(session)).toBe(true);
      markToolNoticesShown(session);
      expect(shouldShowToolNotices(session)).toBe(false);
    });
  });
});
