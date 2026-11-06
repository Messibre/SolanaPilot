import { describe, expect, it } from "vitest";
import { redact, redactString } from "./redact";

describe("redact", () => {
  describe("secret families", () => {
    it("redacts Gemini API keys while keeping debug prefix", () => {
      const input = "Using key AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd for call";
      expect(redactString(input)).toBe("Using key AIza...[redacted:gemini] for call");
    });

    it("redacts Anthropic API keys while keeping debug prefix", () => {
      const input = "Key: sk-ant-api03-abcdef1234567890abcdef1234567890";
      expect(redactString(input)).toBe("Key: sk-ant...[redacted:anthropic]");
    });

    it("redacts OpenAI API keys while keeping debug prefix", () => {
      const input = "Using key sk-Proj1234567890abcdef1234567890abcdef";
      expect(redactString(input)).toBe("Using key sk...[redacted:openai]");
    });

    it("redacts GitHub tokens while keeping debug prefix", () => {
      const input = "Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz";
      expect(redactString(input)).toBe("Token: ghp...[redacted:github]");
    });

    it("redacts standalone Bearer tokens", () => {
      const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      expect(redactString(input)).toBe("Authorization: Bearer [redacted:token]");
    });

    it("redacts private key blocks", () => {
      const input = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
      expect(redactString(input)).toBe("[redacted:private_key]");
    });

    it("redacts email addresses", () => {
      const input = "Contact dev@solanapilot.com for support";
      expect(redactString(input)).toBe("Contact [redacted:email] for support");
    });

    it("redacts credentials in URLs", () => {
      const input = "Connecting to https://user:super_secret_pass@api.solanapilot.com/v1";
      expect(redactString(input)).toBe("Connecting to https://[redacted:credentials]@api.solanapilot.com/v1");
    });

    it("redacts long base58 secrets (80-90 chars)", () => {
      const longBase58 = "2".repeat(85);
      const input = `Private key: ${longBase58}`;
      expect(redactString(input)).toBe("Private key: [redacted:base58_secret]");
    });

    it("redacts 64-byte Solana keypair arrays", () => {
      const keypairBytes = Array.from({ length: 64 }, (_, i) => i % 256);
      const result = redact(keypairBytes);
      expect(result).toBe("[redacted:solana_keypair_bytes]");
    });
  });

  describe("nested objects, arrays, and keys", () => {
    it("deep redacts nested structures", () => {
      const obj = {
        user: {
          email: "dev@example.com",
          auth: {
            token: "secret-token-value",
            meta: "public info",
          },
        },
        logs: [
          "Call with AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd",
          { key: "sk-ant-api03-abcdef1234567890abcdef1234567890" },
        ],
      };

      const redacted = redact(obj) as {
        user: { email: string; auth: { token: string; meta: string } };
        logs: [string, { key: string }];
      };
      expect(redacted.user.email).toBe("[redacted:email]");
      expect(redacted.user.auth.token).toBe("[redacted:sensitive_key]");
      expect(redacted.user.auth.meta).toBe("public info");
      expect(redacted.logs[0]).toBe("Call with AIza...[redacted:gemini]");
      expect(redacted.logs[1].key).toBe("[redacted:sensitive_key]");
    });

    it("handles cyclic references safely without infinite recursion", () => {
      const cyclic: Record<string, unknown> = {
        name: "test",
        secretVal: "AIzaSyB9z8X7w6v5u4t3s2r1q0pOnMlKjIhGfEd",
      };
      cyclic.self = cyclic;

      const result = redact(cyclic) as Record<string, unknown>;
      expect(result.name).toBe("test");
      expect(result.secretVal).toBe("AIza...[redacted:gemini]");
      expect(result.self).toBe("[Circular]");
    });
  });

  describe("over-redaction checks (must NOT redact valid Solana artifacts)", () => {
    it("does NOT redact standard Solana public keys or program IDs (32-44 base58 chars)", () => {
      const pubkey1 = "11111111111111111111111111111111"; // System program
      const pubkey2 = "HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa"; // Registry ID
      const pubkey3 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; // SPL Token

      expect(redactString(`Program ID: ${pubkey1}`)).toBe(`Program ID: ${pubkey1}`);
      expect(redactString(`Deployed at ${pubkey2}`)).toBe(`Deployed at ${pubkey2}`);
      expect(redactString(`Token program ${pubkey3}`)).toBe(`Token program ${pubkey3}`);
    });

    it("does NOT redact normal text or non-secret arrays", () => {
      const regularText = "The skating pilot secretly generated code for Solana hackathon";
      expect(redactString(regularText)).toBe(regularText);

      const normalArray = [1, 2, 3, 4, 5];
      expect(redact(normalArray)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("under-redaction documented limits", () => {
    it("documents that obfuscated variants (split by whitespace) are known limits", () => {
      // Documented limit per Agent.md §11 & Done when:
      // An obfuscated key split across tokens/spaces is not detected by token regex
      const splitKey = "AIza Sy12345 67890";
      // This documents the boundary limit of regex-based redaction:
      expect(redactString(splitKey)).toBe(splitKey);
    });
  });
});
