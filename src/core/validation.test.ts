import { describe, it, expect } from "vitest";
import {
  programNameSchema,
  pubkeySchema,
  userPromptSchema,
  relativeWorkspacePathSchema,
  httpsUrlSchema,
  providerIdSchema,
  modelNameSchema,
  validateProgramName,
  validatePubkey,
  validateUserPrompt,
  validateRelativeWorkspacePath,
  validateHttpsUrl,
  validateProviderId,
  validateModelName,
} from "./validation";

describe("validation - programNameSchema", () => {
  it("accepts valid snake_case program names between 3 and 32 chars", () => {
    expect(programNameSchema.safeParse("abc").success).toBe(true);
    expect(validateProgramName("abc")).toBe("abc"); // min len 3
    expect(validateProgramName("solana_pilot")).toBe("solana_pilot");
    expect(validateProgramName("a".repeat(16) + "_" + "b".repeat(15))).toBe(
      "a".repeat(16) + "_" + "b".repeat(15)
    ); // len 32
  });

  it("rejects boundary violations (len-1 = 2, len+1 = 33)", () => {
    expect(() => validateProgramName("ab")).toThrow(); // len 2
    expect(() => validateProgramName("a".repeat(33))).toThrow(); // len 33
  });

  it("rejects non-snake_case formats", () => {
    expect(() => validateProgramName("SolanaPilot")).toThrow(); // PascalCase
    expect(() => validateProgramName("solanaPilot")).toThrow(); // camelCase
    expect(() => validateProgramName("solana-pilot")).toThrow(); // kebab-case
    expect(() => validateProgramName("solana pilot")).toThrow(); // spaces
    expect(() => validateProgramName("solana__pilot")).toThrow(); // consecutive underscores
    expect(() => validateProgramName("_solana_pilot")).toThrow(); // leading underscore
    expect(() => validateProgramName("solana_pilot_")).toThrow(); // trailing underscore
    expect(() => validateProgramName("solana_pilot!🦀")).toThrow(); // unicode/special chars
  });
});

describe("validation - pubkeySchema", () => {
  it("accepts valid 32-byte base58 public keys", () => {
    // 32 zero bytes in base58 is 32 ones
    const systemProgram = "11111111111111111111111111111111";
    expect(pubkeySchema.safeParse(systemProgram).success).toBe(true);
    expect(validatePubkey(systemProgram)).toBe(systemProgram);

    // standard 44 char solana pubkey
    const tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    expect(validatePubkey(tokenProgram)).toBe(tokenProgram);
  });

  it("rejects invalid base58 characters", () => {
    // 0, O, I, l are forbidden in base58
    expect(() => validatePubkey("01111111111111111111111111111111")).toThrow();
    expect(() => validatePubkey("O1111111111111111111111111111111")).toThrow();
    expect(() => validatePubkey("I1111111111111111111111111111111")).toThrow();
    expect(() => validatePubkey("l1111111111111111111111111111111")).toThrow();
  });

  it("rejects keys that do not decode to exactly 32 bytes", () => {
    // too short
    expect(() => validatePubkey("1111111111111111")).toThrow();
    // too long
    expect(() => validatePubkey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA9999")).toThrow();
  });

  it("rejects unicode or malformed input", () => {
    expect(() => validatePubkey("🦀TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9")).toThrow();
    expect(() => validatePubkey("")).toThrow();
  });
});

describe("validation - userPromptSchema", () => {
  it("accepts and trims valid prompt within 1-4000 characters", () => {
    expect(userPromptSchema.safeParse("test").success).toBe(true);
    expect(validateUserPrompt("  create an escrow program  ")).toBe("create an escrow program");
    expect(validateUserPrompt("x")).toBe("x"); // min len 1
    const maxPrompt = "a".repeat(4000);
    expect(validateUserPrompt(maxPrompt)).toBe(maxPrompt); // max len 4000
  });

  it("rejects empty or whitespace-only prompts (len-1 = 0)", () => {
    expect(() => validateUserPrompt("")).toThrow();
    expect(() => validateUserPrompt("   \n\t  ")).toThrow();
  });

  it("rejects prompts exceeding 4000 chars (len+1 = 4001)", () => {
    const tooLong = "a".repeat(4001);
    expect(() => validateUserPrompt(tooLong)).toThrow();
  });

  it("rejects prompts containing null bytes", () => {
    expect(() => validateUserPrompt("generate code\0malicious")).toThrow();
  });
});

describe("validation - relativeWorkspacePathSchema", () => {
  it("accepts safe relative workspace paths", () => {
    expect(relativeWorkspacePathSchema.safeParse("src/lib.rs").success).toBe(true);
    expect(validateRelativeWorkspacePath("src/lib.rs")).toBe("src/lib.rs");
    expect(validateRelativeWorkspacePath("programs/escrow/src/lib.rs")).toBe(
      "programs/escrow/src/lib.rs"
    );
    expect(validateRelativeWorkspacePath("Anchor.toml")).toBe("Anchor.toml");
  });

  it("rejects absolute paths and drive prefixes", () => {
    expect(() => validateRelativeWorkspacePath("/etc/passwd")).toThrow();
    expect(() => validateRelativeWorkspacePath("/src/lib.rs")).toThrow();
    expect(() => validateRelativeWorkspacePath("C:\\Windows\\system32")).toThrow();
    expect(() => validateRelativeWorkspacePath("D:/repo/src")).toThrow();
  });

  it("rejects traversal outside workspace", () => {
    expect(() => validateRelativeWorkspacePath("../secrets")).toThrow();
    expect(() => validateRelativeWorkspacePath("src/../../outside")).toThrow();
  });

  it("rejects paths with null bytes", () => {
    expect(() => validateRelativeWorkspacePath("src/lib.rs\0.txt")).toThrow();
  });
});

describe("validation - httpsUrlSchema", () => {
  it("accepts valid https URLs", () => {
    expect(httpsUrlSchema.safeParse("https://api.devnet.solana.com").success).toBe(true);
    expect(validateHttpsUrl("https://api.devnet.solana.com")).toBe("https://api.devnet.solana.com");
    expect(validateHttpsUrl("https://github.com/solana-labs/solana")).toBe(
      "https://github.com/solana-labs/solana"
    );
  });

  it("rejects non-https URLs and invalid URLs", () => {
    expect(() => validateHttpsUrl("http://api.devnet.solana.com")).toThrow();
    expect(() => validateHttpsUrl("file:///etc/passwd")).toThrow();
    expect(() => validateHttpsUrl("ftp://ftp.example.com")).toThrow();
    expect(() => validateHttpsUrl("not-a-url")).toThrow();
  });
});

describe("validation - providerIdSchema", () => {
  it("accepts known provider IDs", () => {
    expect(providerIdSchema.safeParse("mock").success).toBe(true);
    expect(validateProviderId("mock")).toBe("mock");
    expect(validateProviderId("gemini")).toBe("gemini");
    expect(validateProviderId("openaiCompatible")).toBe("openaiCompatible");
    expect(validateProviderId("anthropic")).toBe("anthropic");
    expect(validateProviderId("ollama")).toBe("ollama");
  });

  it("rejects unknown or invalid provider IDs", () => {
    expect(() => validateProviderId("unknown")).toThrow();
    expect(() => validateProviderId("")).toThrow();
    expect(() => validateProviderId("GEMINI")).toThrow();
  });
});

describe("validation - modelNameSchema", () => {
  it("accepts valid model names between 1 and 128 characters", () => {
    expect(modelNameSchema.safeParse("gemini-2.5-pro").success).toBe(true);
    expect(validateModelName("gemini-2.5-pro")).toBe("gemini-2.5-pro");
    expect(validateModelName("claude-3-5-sonnet-20241022")).toBe("claude-3-5-sonnet-20241022");
    expect(validateModelName("deepseek-r1:8b")).toBe("deepseek-r1:8b");
    expect(validateModelName("m")).toBe("m"); // min len 1
    const maxModel = "m".repeat(128);
    expect(validateModelName(maxModel)).toBe(maxModel); // max len 128
  });

  it("rejects empty or too long model names (len-1 = 0, len+1 = 129)", () => {
    expect(() => validateModelName("")).toThrow();
    expect(() => validateModelName("   ")).toThrow();
    expect(() => validateModelName("m".repeat(129))).toThrow();
  });

  it("rejects model names with invalid special characters", () => {
    expect(() => validateModelName("model;drop table")).toThrow();
    expect(() => validateModelName("model with spaces")).toThrow();
    expect(() => validateModelName("model<script>")).toThrow();
  });
});
