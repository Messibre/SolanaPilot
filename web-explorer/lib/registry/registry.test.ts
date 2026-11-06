import { describe, it, expect, beforeEach } from "vitest";
import {
  parseProgramsQuery,
  filterPrograms,
  TtlCache,
  type ProgramRecord,
} from "./index";

describe("Explorer Data Layer & Registry Query (T-068)", () => {
  const samplePrograms: ProgramRecord[] = [
    {
      programId: "11111111111111111111111111111111",
      authority: "Auth1111111111111111111111111111111111111111",
      name: "Token Vault",
      description: "Escrow and vault program",
      version: "1.0.0",
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      programId: "22222222222222222222222222222222",
      authority: "Auth2222222222222222222222222222222222222222",
      name: "AMM DEX",
      description: "Automated market maker",
      version: "0.2.0",
      createdAt: 2000,
      updatedAt: 2000,
    },
    {
      programId: "33333333333333333333333333333333",
      authority: "Auth1111111111111111111111111111111111111111",
      name: "NFT Marketplace",
      description: "Digital asset marketplace",
      version: "1.1.0",
      createdAt: 3000,
      updatedAt: 3000,
    },
  ];

  describe("1. Query Clamping", () => {
    it("clamps pageSize to max 50 when requesting more than 50", () => {
      const parsed = parseProgramsQuery({ pageSize: "100", offset: "0" });
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.pageSize).toBe(50);
      }
    });

    it("clamps pageSize to min 1 when requesting 0 or negative", () => {
      const parsed = parseProgramsQuery({ pageSize: "-10", offset: "0" });
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.pageSize).toBe(1);
      }
    });

    it("clamps offset to min 0 when negative", () => {
      const parsed = parseProgramsQuery({ pageSize: "20", offset: "-5" });
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.offset).toBe(0);
      }
    });

    it("applies default pageSize 20 and offset 0 when omitted", () => {
      const parsed = parseProgramsQuery({});
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.pageSize).toBe(20);
        expect(parsed.data.offset).toBe(0);
      }
    });
  });

  describe("2. Bad Pubkeys", () => {
    it("rejects invalid base58 characters in authority filter", () => {
      const parsed = parseProgramsQuery({ authority: "0OIl_invalid_base58!" });
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(parsed.error).toMatch(/invalid.*public key|base58/i);
      }
    });

    it("rejects pubkey that decodes to incorrect byte length (not 32 bytes)", () => {
      const shortKey = "1111";
      const parsedShort = parseProgramsQuery({ authority: shortKey });
      expect(parsedShort.ok).toBe(false);
      if (!parsedShort.ok) {
        expect(parsedShort.error).toMatch(/invalid.*public key|32 bytes/i);
      }
    });
  });

  describe("3. Cache Expiry with Fake Clock", () => {
    let mockTime: number;
    let cache: TtlCache<string, string>;

    beforeEach(() => {
      mockTime = 1_000_000;
      cache = new TtlCache<string, string>({
        ttlMs: 5000,
        now: () => mockTime,
      });
    });

    it("returns cached value before TTL expires", () => {
      cache.set("programs_list", "data_v1");
      mockTime += 2000; // 2s elapsed < 5s TTL
      expect(cache.get("programs_list")).toBe("data_v1");
    });

    it("expires value when TTL is exceeded", () => {
      cache.set("programs_list", "data_v1");
      mockTime += 5001; // 5.001s elapsed > 5s TTL
      expect(cache.get("programs_list")).toBeNull();
    });

    it("resets expiry when updated", () => {
      cache.set("programs_list", "data_v1");
      mockTime += 4000;
      cache.set("programs_list", "data_v2");
      mockTime += 3000; // 3s since reset < 5s TTL
      expect(cache.get("programs_list")).toBe("data_v2");
    });
  });

  describe("4. 'My Programs' (Authority) Filter", () => {
    it("filters programs strictly matching user's linked authority wallet", () => {
      const auth1 = "Auth1111111111111111111111111111111111111111";
      const filtered = filterPrograms(samplePrograms, {
        authority: auth1,
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every((p) => p.authority === auth1)).toBe(true);
      expect(filtered.map((p) => p.name)).toEqual(["Token Vault", "NFT Marketplace"]);
    });

    it("returns empty list if authority has no registered programs", () => {
      const unknownAuth = "Auth9999999999999999999999999999999999999999";
      const filtered = filterPrograms(samplePrograms, {
        authority: unknownAuth,
      });

      expect(filtered).toHaveLength(0);
    });
  });
});
