import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertUserAndIdentity,
  getUserProviderNames,
  shapeAuthSession,
  type AuthDatabase,
} from "../auth";

class FakeAuthDb implements AuthDatabase {
  users: Array<{ id: string; createdAt: Date; updatedAt: Date }> = [];
  identities: Array<{
    id: string;
    provider: string;
    providerAccountId: string;
    userId: string;
    createdAt: Date;
  }> = [];

  private idCounter = 1;

  async findIdentity(provider: string, providerAccountId: string) {
    const found = this.identities.find(
      (i) => i.provider === provider && i.providerAccountId === providerAccountId
    );
    return found ? { ...found } : null;
  }

  async createUser(): Promise<{ id: string }> {
    const user = {
      id: `usr_${this.idCounter++}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return { id: user.id };
  }

  async createIdentity(data: {
    provider: string;
    providerAccountId: string;
    userId: string;
  }): Promise<{ id: string; userId: string; provider: string; providerAccountId: string }> {
    const identity = {
      id: `ident_${this.idCounter++}`,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      userId: data.userId,
      createdAt: new Date(),
    };
    this.identities.push(identity);
    return { ...identity };
  }

  async getUserIdentities(userId: string): Promise<Array<{ provider: string }>> {
    return this.identities
      .filter((i) => i.userId === userId)
      .map((i) => ({ provider: i.provider }));
  }
}

describe("Auth.js GitHub sign-in logic (T-064)", () => {
  let fakeDb: FakeAuthDb;

  beforeEach(() => {
    fakeDb = new FakeAuthDb();
  });

  it("creates a new User and Identity on first sign-in", async () => {
    const result = await upsertUserAndIdentity(fakeDb, {
      provider: "github",
      providerAccountId: "gh-12345",
    });

    expect(result.isNew).toBe(true);
    expect(result.userId).toMatch(/^usr_/);
    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.identities).toHaveLength(1);
    expect(fakeDb.identities[0].provider).toBe("github");
    expect(fakeDb.identities[0].providerAccountId).toBe("gh-12345");
    expect(fakeDb.identities[0].userId).toBe(result.userId);
  });

  it("finds and returns existing User on subsequent sign-in without duplicating records", async () => {
    const first = await upsertUserAndIdentity(fakeDb, {
      provider: "github",
      providerAccountId: "gh-12345",
    });

    const second = await upsertUserAndIdentity(fakeDb, {
      provider: "github",
      providerAccountId: "gh-12345",
    });

    expect(second.isNew).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.identities).toHaveLength(1);
  });

  it("returns all linked provider names for a user", async () => {
    const userResult = await upsertUserAndIdentity(fakeDb, {
      provider: "github",
      providerAccountId: "gh-12345",
    });

    // Simulate linking a second provider (solana)
    await fakeDb.createIdentity({
      provider: "solana",
      providerAccountId: "solana-pubkey-abc",
      userId: userResult.userId,
    });

    const providers = await getUserProviderNames(fakeDb, userResult.userId);
    expect(providers).toEqual(["github", "solana"]);
  });

  it("returns empty array for user with no linked identities", async () => {
    const providers = await getUserProviderNames(fakeDb, "usr_nonexistent");
    expect(providers).toEqual([]);
  });

  it("shapes session to contain only userId and linked provider names", () => {
    const session = shapeAuthSession({
      userId: "usr_1",
      providers: ["github"],
      expires: "2099-01-01T00:00:00.000Z",
    });

    expect(session.userId).toBe("usr_1");
    expect(session.providers).toEqual(["github"]);
    expect(session.user.id).toBe("usr_1");
    expect(session.user.providers).toEqual(["github"]);
    // Should not carry leaked attributes like email/image if not desired
    expect((session as Record<string, unknown>).email).toBeUndefined();
    expect((session as Record<string, unknown>).image).toBeUndefined();
  });

  it("handles multi-provider linked sessions properly", () => {
    const session = shapeAuthSession({
      userId: "usr_42",
      providers: ["github", "solana"],
      expires: "2099-01-01T00:00:00.000Z",
    });

    expect(session.userId).toBe("usr_42");
    expect(session.providers).toEqual(["github", "solana"]);
    expect(session.user.providers).toContain("github");
    expect(session.user.providers).toContain("solana");
  });
});
