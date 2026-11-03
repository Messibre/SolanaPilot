import { describe, expect, it } from "vitest";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

describe("clamp", () => {
  it("clamps values between min and max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

