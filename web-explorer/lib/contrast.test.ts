import { describe, it, expect } from "vitest";

// WCAG 2.1 relative luminance calculation
function srgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export const TOKENS = {
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
    accent: "#7A22E0", // adjusted to guarantee >= 4.5:1 on white/light surfaces and with accentFg #FFFFFF
    accentFg: "#FFFFFF",
    success: "#0E9F65",
    danger: "#C8303F",
  },
};

describe("design token contrast ratios (WCAG AA)", () => {
  describe("dark theme", () => {
    const t = TOKENS.dark;

    it("text on background meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.text, t.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text on surface meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.text, t.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text on surface-2 meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.text, t.surface2);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("muted text on background meets AA large/UI standard (>= 3.0:1) and near body (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.textMuted, t.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("accent-fg on accent button meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.accentFg, t.accent);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("danger on background meets AA large/UI standard (>= 3.0:1)", () => {
      const ratio = getContrastRatio(t.danger, t.bg);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("light theme", () => {
    const t = TOKENS.light;

    it("text on background meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.text, t.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text on surface meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.text, t.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text on surface-2 meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.text, t.surface2);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("muted text on background meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.textMuted, t.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("accent-fg on accent button meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.accentFg, t.accent);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("danger text on background meets AA normal text standard (>= 4.5:1)", () => {
      const ratio = getContrastRatio(t.danger, t.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
