import { describe, expect, it } from "vitest";
import { scanContent, SECRET_PATTERNS } from "./check-secrets.mjs";

describe("check-secrets", () => {
  it("has definitions for all required pattern categories", () => {
    expect(SECRET_PATTERNS.length).toBeGreaterThanOrEqual(8);
  });

  it("detects Gemini API keys", () => {
    // 39 chars starting with AIza followed by 35 chars
    const sample = "const key = \"AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd\";";
    const findings = scanContent(sample, "src/config.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("Gemini API Key");
    expect(findings[0].line).toBe(1);
    // Ensure matched secret text is NOT stored in finding
    expect(findings[0]).not.toHaveProperty("matchedText");
    expect(findings[0]).not.toHaveProperty("secret");
  });

  it("detects Anthropic API keys", () => {
    const sample = "const anthropicKey = \"sk-ant-api03-abcdef1234567890abcdef1234567890\";";
    const findings = scanContent(sample, "src/anthropic.ts");
    expect(findings.some((f: { rule: string }) => f.rule === "Anthropic API Key")).toBe(true);
  });

  it("detects OpenAI API keys", () => {
    const sample = "const oaiKey = \"sk-Proj1234567890abcdef1234567890abcdef\";";
    const findings = scanContent(sample, "src/openai.ts");
    expect(findings.some((f: { rule: string }) => f.rule === "OpenAI API Key")).toBe(true);
  });

  it("detects GitHub tokens", () => {
    const sample = "const token = \"ghp_1234567890abcdefghijklmnopqrstuvwxyz\";";
    const findings = scanContent(sample, "src/github.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("GitHub Token");
  });

  it("detects Solana 64-number keypair arrays", () => {
    const numbers = Array.from({ length: 64 }, (_, i) => (i % 256)).join(", ");
    const sample = `const keypair = [${numbers}];`;
    const findings = scanContent(sample, "src/wallet.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("Solana 64-byte Keypair Array");
  });

  it("detects Base58 80-90 char secrets assigned to key/secret", () => {
    // Base58 excluding 0, O, I, l
    const base58Str = "2".repeat(85);
    const sample = `const secret_key = "${base58Str}";`;
    const findings = scanContent(sample, "src/signer.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("Base58 Key/Secret");
  });

  it("detects Bearer tokens", () => {
    const sample = "headers['Authorization'] = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';";
    const findings = scanContent(sample, "src/api.ts");
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("Bearer Token");
  });

  it("detects Private Key block", () => {
    const sample = "-----BEGIN RSA PRIVATE KEY-----";
    const findings = scanContent(sample, "src/cert.pem");
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("Private Key Block");
  });

  it("ignores placeholders in .env.example files", () => {
    const sample = "GEMINI_API_KEY=AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd\nGITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz";
    const findings = scanContent(sample, ".env.example");
    expect(findings).toHaveLength(0);
  });

  it("ignores placeholder keywords in regular files", () => {
    const sample = "const apiKey = 'your-api-key-here-placeholder';\nconst fake = 'dummy-key';";
    const findings = scanContent(sample, "src/example.ts");
    expect(findings).toHaveLength(0);
  });
});
