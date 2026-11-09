import { db } from "@/lib/db";

export interface IdentityRecord {
  id: string;
  provider: string;
  providerAccountId: string;
  userId: string;
}

export interface AccountLinkDatabase {
  findIdentity(
    provider: string,
    providerAccountId: string
  ): Promise<IdentityRecord | null>;
  findUserIdentities(userId: string): Promise<IdentityRecord[]>;
  createIdentity(data: {
    provider: string;
    providerAccountId: string;
    userId: string;
  }): Promise<IdentityRecord>;
  deleteIdentity(
    provider: string,
    providerAccountId: string,
    userId: string
  ): Promise<boolean>;
}

export const prismaAccountLinkDb: AccountLinkDatabase = {
  async findIdentity(provider: string, providerAccountId: string) {
    const record = await db.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });
    return record
      ? {
          id: record.id,
          provider: record.provider,
          providerAccountId: record.providerAccountId,
          userId: record.userId,
        }
      : null;
  },

  async findUserIdentities(userId: string) {
    const list = await db.identity.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return list.map((record) => ({
      id: record.id,
      provider: record.provider,
      providerAccountId: record.providerAccountId,
      userId: record.userId,
    }));
  },

  async createIdentity(data: {
    provider: string;
    providerAccountId: string;
    userId: string;
  }) {
    const record = await db.identity.create({
      data: {
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        userId: data.userId,
      },
    });
    return {
      id: record.id,
      provider: record.provider,
      providerAccountId: record.providerAccountId,
      userId: record.userId,
    };
  },

  async deleteIdentity(
    provider: string,
    providerAccountId: string,
    userId: string
  ) {
    const deleted = await db.identity.deleteMany({
      where: {
        provider,
        providerAccountId,
        userId,
      },
    });
    return deleted.count > 0;
  },
};

export type LinkResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Links a new identity to a user account.
 * Rejects if identity is already linked to another user.
 */
export async function linkIdentity(
  database: AccountLinkDatabase,
  params: {
    userId: string;
    provider: string;
    providerAccountId: string;
  }
): Promise<LinkResult> {
  const existing = await database.findIdentity(
    params.provider,
    params.providerAccountId
  );

  if (existing) {
    if (existing.userId === params.userId) {
      return { ok: true, message: "Identity is already linked to your account." };
    }
    return {
      ok: false,
      error: `Identity already linked to another account. You must unlink it from that account first.`,
    };
  }

  await database.createIdentity({
    provider: params.provider,
    providerAccountId: params.providerAccountId,
    userId: params.userId,
  });

  return { ok: true };
}

/**
 * Unlinks an identity from a user account.
 * Rejects if the user only has one identity remaining (preventing orphaned accounts).
 */
export async function unlinkIdentity(
  database: AccountLinkDatabase,
  params: {
    userId: string;
    provider: string;
    providerAccountId: string;
  }
): Promise<LinkResult> {
  const userIdentities = await database.findUserIdentities(params.userId);

  if (userIdentities.length <= 1) {
    return {
      ok: false,
      error: "Cannot unlink the only remaining identity. Your account must have at least one sign-in method.",
    };
  }

  const belongsToUser = userIdentities.some(
    (i) =>
      i.provider === params.provider &&
      i.providerAccountId === params.providerAccountId
  );

  if (!belongsToUser) {
    return {
      ok: false,
      error: "Identity not found on this account.",
    };
  }

  const success = await database.deleteIdentity(
    params.provider,
    params.providerAccountId,
    params.userId
  );

  if (!success) {
    return {
      ok: false,
      error: "Failed to unlink identity from database.",
    };
  }

  return { ok: true };
}

/**
 * Retrieves all linked identities for a user account.
 */
export async function getUserIdentities(
  database: AccountLinkDatabase,
  userId: string
): Promise<IdentityRecord[]> {
  return database.findUserIdentities(userId);
}
