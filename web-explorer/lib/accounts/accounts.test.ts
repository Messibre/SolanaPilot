import { describe, it, expect, beforeEach } from "vitest";
import {
  linkIdentity,
  unlinkIdentity,
  getUserIdentities,
  type AccountLinkDatabase,
} from "./index";

class FakeAccountLinkDb implements AccountLinkDatabase {
  users: Array<{ id: string }> = [];
  identities: Array<{
    id: string;
    provider: string;
    providerAccountId: string;
    userId: string;
  }> = [];

  private idCounter = 1;

  async findIdentity(provider: string, providerAccountId: string) {
    const found = this.identities.find(
      (i) => i.provider === provider && i.providerAccountId === providerAccountId
    );
    return found ? { ...found } : null;
  }

  async findUserIdentities(userId: string) {
    return this.identities
      .filter((i) => i.userId === userId)
      .map((i) => ({ ...i }));
  }

  async createIdentity(data: {
    provider: string;
    providerAccountId: string;
    userId: string;
  }) {
    const record = {
      id: `id_${this.idCounter++}`,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      userId: data.userId,
    };
    this.identities.push(record);
    return { ...record };
  }

  async deleteIdentity(provider: string, providerAccountId: string, userId: string) {
    const idx = this.identities.findIndex(
      (i) =>
        i.provider === provider &&
        i.providerAccountId === providerAccountId &&
        i.userId === userId
    );
    if (idx !== -1) {
      this.identities.splice(idx, 1);
      return true;
    }
    return false;
  }
}

describe("Account Linking & Unlinking (T-066)", () => {
  let fakeDb: FakeAccountLinkDb;
  const userA = "usr_alice";
  const userB = "usr_bob";

  beforeEach(async () => {
    fakeDb = new FakeAccountLinkDb();
    fakeDb.users.push({ id: userA }, { id: userB });

    // Initial state: Alice has GitHub, Bob has Solana
    await fakeDb.createIdentity({
      provider: "github",
      providerAccountId: "gh_alice_123",
      userId: userA,
    });

    await fakeDb.createIdentity({
      provider: "solana",
      providerAccountId: "sol_bob_456",
      userId: userB,
    });
  });

  it("1. allows signed-in user to link a second provider", async () => {
    const result = await linkIdentity(fakeDb, {
      userId: userA,
      provider: "solana",
      providerAccountId: "sol_alice_789",
    });

    expect(result.ok).toBe(true);
    const identities = await getUserIdentities(fakeDb, userA);
    expect(identities).toHaveLength(2);
    expect(identities.map((i) => i.provider)).toEqual(["github", "solana"]);
  });

  it("2. refuses linking identity already linked to another user with clear error", async () => {
    // Alice attempts to link Bob's Solana wallet
    const result = await linkIdentity(fakeDb, {
      userId: userA,
      provider: "solana",
      providerAccountId: "sol_bob_456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/already linked to another account/i);
    }

    // Alice's identities remain unchanged
    const identities = await getUserIdentities(fakeDb, userA);
    expect(identities).toHaveLength(1);
  });

  it("3. handles idempotent linking if identity is already linked to same user", async () => {
    const result = await linkIdentity(fakeDb, {
      userId: userA,
      provider: "github",
      providerAccountId: "gh_alice_123",
    });

    expect(result.ok).toBe(true);
    const identities = await getUserIdentities(fakeDb, userA);
    expect(identities).toHaveLength(1);
  });

  it("4. refuses unlinking if it would leave zero identities", async () => {
    // Alice currently has only 1 identity (github)
    const result = await unlinkIdentity(fakeDb, {
      userId: userA,
      provider: "github",
      providerAccountId: "gh_alice_123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cannot unlink the only remaining identity/i);
    }

    // Identity was not removed
    const identities = await getUserIdentities(fakeDb, userA);
    expect(identities).toHaveLength(1);
  });

  it("5. successfully unlinks an identity when user has multiple identities", async () => {
    // First link Solana to Alice
    await linkIdentity(fakeDb, {
      userId: userA,
      provider: "solana",
      providerAccountId: "sol_alice_789",
    });

    const before = await getUserIdentities(fakeDb, userA);
    expect(before).toHaveLength(2);

    // Now unlink GitHub
    const result = await unlinkIdentity(fakeDb, {
      userId: userA,
      provider: "github",
      providerAccountId: "gh_alice_123",
    });

    expect(result.ok).toBe(true);
    const after = await getUserIdentities(fakeDb, userA);
    expect(after).toHaveLength(1);
    expect(after[0].provider).toBe("solana");
  });

  it("6. refuses unlinking an identity not belonging to user", async () => {
    // Alice has 2 identities
    await linkIdentity(fakeDb, {
      userId: userA,
      provider: "solana",
      providerAccountId: "sol_alice_789",
    });

    const result = await unlinkIdentity(fakeDb, {
      userId: userA,
      provider: "solana",
      providerAccountId: "sol_bob_456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/identity not found/i);
    }
  });
});
