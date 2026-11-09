import { describe, it, expect } from "vitest";
import { validateServerEnv, validateClientEnv, getEnv } from "./env";

describe("env validation", () => {
  const validServerEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/solanapilot",
    AUTH_SECRET: "super-secret-random-auth-token-at-least-32-chars",
    AUTH_GITHUB_ID: "github-client-id-12345",
    AUTH_GITHUB_SECRET: "github-client-secret-67890",
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
    NODE_ENV: "test",
  };

  const validClientEnv = {
    NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
    NEXT_PUBLIC_SOLANA_NETWORK: "devnet",
  };

  describe("validateServerEnv", () => {
    it("parses valid server environment variables successfully", () => {
      const parsed = validateServerEnv(validServerEnv);
      expect(parsed.DATABASE_URL).toBe(validServerEnv.DATABASE_URL);
      expect(parsed.AUTH_SECRET).toBe(validServerEnv.AUTH_SECRET);
      expect(parsed.AUTH_GITHUB_ID).toBe(validServerEnv.AUTH_GITHUB_ID);
      expect(parsed.AUTH_GITHUB_SECRET).toBe(validServerEnv.AUTH_GITHUB_SECRET);
      expect(parsed.SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
      expect(parsed.NODE_ENV).toBe("test");
    });

    it("applies defaults for optional server variables", () => {
      const minimalServerEnv = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/solanapilot",
        AUTH_SECRET: "super-secret-random-auth-token-at-least-32-chars",
        AUTH_GITHUB_ID: "github-client-id-12345",
        AUTH_GITHUB_SECRET: "github-client-secret-67890",
      };
      const parsed = validateServerEnv(minimalServerEnv);
      expect(parsed.SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
      expect(parsed.NODE_ENV).toBe("development");
    });

    it("fails fast naming only the missing variables", () => {
      const incompleteEnv = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/solanapilot",
      };
      expect(() => validateServerEnv(incompleteEnv)).toThrowError(
        /Missing server environment variable\(s\): AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET/,
      );
    });

    it("fails fast naming invalid variables with reasons", () => {
      const invalidEnv = {
        ...validServerEnv,
        DATABASE_URL: "not-a-valid-url",
        SOLANA_RPC_URL: "also-not-a-url",
      };
      expect(() => validateServerEnv(invalidEnv)).toThrowError(
        /Invalid server environment variable\(s\): DATABASE_URL, SOLANA_RPC_URL/,
      );
    });

    it("rejects secrets accidentally named with NEXT_PUBLIC_ prefix", () => {
      const leakyEnv = {
        ...validServerEnv,
        NEXT_PUBLIC_DATABASE_URL: "postgresql://user:pass@localhost:5432/solanapilot",
      };
      expect(() => validateServerEnv(leakyEnv)).toThrowError(
        /Forbidden public secret detected: NEXT_PUBLIC_DATABASE_URL/,
      );
    });
  });

  describe("validateClientEnv", () => {
    it("parses valid client environment variables", () => {
      const parsed = validateClientEnv(validClientEnv);
      expect(parsed.NEXT_PUBLIC_SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
      expect(parsed.NEXT_PUBLIC_SOLANA_NETWORK).toBe("devnet");
    });

    it("applies sensible defaults when client variables are omitted", () => {
      const parsed = validateClientEnv({});
      expect(parsed.NEXT_PUBLIC_SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
      expect(parsed.NEXT_PUBLIC_SOLANA_NETWORK).toBe("devnet");
    });

    it("fails fast when NEXT_PUBLIC_SOLANA_RPC_URL is invalid", () => {
      expect(() =>
        validateClientEnv({ NEXT_PUBLIC_SOLANA_RPC_URL: "bad-url" }),
      ).toThrowError(/Invalid client environment variable\(s\): NEXT_PUBLIC_SOLANA_RPC_URL/);
    });

    it("fails fast when NEXT_PUBLIC_SOLANA_NETWORK is not an allowed network", () => {
      expect(() =>
        validateClientEnv({ NEXT_PUBLIC_SOLANA_NETWORK: "mainnet-beta" }),
      ).toThrowError(/Invalid client environment variable\(s\): NEXT_PUBLIC_SOLANA_NETWORK/);
    });
  });

  describe("getEnv helper", () => {
    it("returns combined validated environment in server environment", () => {
      const env = getEnv({
        ...validServerEnv,
        ...validClientEnv,
      });
      expect(env.DATABASE_URL).toBe(validServerEnv.DATABASE_URL);
      expect(env.NEXT_PUBLIC_SOLANA_NETWORK).toBe("devnet");
    });
  });
});

