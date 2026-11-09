import { describe, expect, it } from "vitest";

// WCAG relative luminance formula
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function channelLuminance(channel: number): number {
  const val = channel / 255;
  return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const themeTokens = {
  dark: {
    bg: "#121214",
    surface: "#1A1A1E",
    surface2: "#222228",
    border: "#2E2E35",
    text: "#ECECEF",
    textMuted: "#9A9AA5",
    accent: "#9945FF",
    accentFg: "#FFFFFF",
    success: "#14F195",
    danger: "#F05D6C",
  },
  light: {
    bg: "#F4F4F6",
    surface: "#FFFFFF",
    surface2: "#EBEBEF",
    border: "#D9D9E0",
    text: "#17171A",
    textMuted: "#5E5E69",
    accent: "#8A3FEF",
    accentFg: "#FFFFFF",
    success: "#0E9F65",
    danger: "#C8303F",
  },
};

describe("Design System WCAG Contrast Tests (Agent.md §14)", () => {
  describe("Dark Theme", () => {
    it("body text on bg meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(themeTokens.dark.text, themeTokens.dark.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("body text on surface meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(themeTokens.dark.text, themeTokens.dark.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text muted on bg meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(
        themeTokens.dark.textMuted,
        themeTokens.dark.bg,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("accentFg on accent meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(
        themeTokens.dark.accentFg,
        themeTokens.dark.accent,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Light Theme", () => {
    it("body text on bg meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(themeTokens.light.text, themeTokens.light.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("body text on surface meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(
        themeTokens.light.text,
        themeTokens.light.surface,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text muted on bg meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(
        themeTokens.light.textMuted,
        themeTokens.light.bg,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("accentFg on accent meets WCAG AA (>= 4.5:1)", () => {
      const ratio = contrastRatio(
        themeTokens.light.accentFg,
        themeTokens.light.accent,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
