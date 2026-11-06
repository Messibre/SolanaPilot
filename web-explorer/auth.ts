import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifySiwsMessage, defaultNonceStore } from "@/lib/siws";

export interface AuthDatabase {
  findIdentity(
    provider: string,
    providerAccountId: string
  ): Promise<{ userId: string; provider: string; providerAccountId: string } | null>;
  createUser(): Promise<{ id: string }>;
  createIdentity(data: {
    provider: string;
    providerAccountId: string;
    userId: string;
  }): Promise<{ id: string; userId: string; provider: string; providerAccountId: string }>;
  getUserIdentities(userId: string): Promise<Array<{ provider: string }>>;
}

export const prismaAuthDb: AuthDatabase = {
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
          userId: record.userId,
          provider: record.provider,
          providerAccountId: record.providerAccountId,
        }
      : null;
  },

  async createUser(): Promise<{ id: string }> {
    const user = await db.user.create({
      data: {},
    });
    return { id: user.id };
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
      userId: record.userId,
      provider: record.provider,
      providerAccountId: record.providerAccountId,
    };
  },

  async getUserIdentities(userId: string) {
    const list = await db.identity.findMany({
      where: { userId },
      select: { provider: true },
    });
    return list;
  },
};

/**
 * Upserts User and Identity records for an authenticated provider account.
 * Reuses existing User if Identity already exists; otherwise creates a new User and links the Identity.
 */
export async function upsertUserAndIdentity(
  database: AuthDatabase,
  params: { provider: string; providerAccountId: string }
): Promise<{ userId: string; isNew: boolean }> {
  const existing = await database.findIdentity(params.provider, params.providerAccountId);
  if (existing) {
    return {
      userId: existing.userId,
      isNew: false,
    };
  }

  const newUser = await database.createUser();
  await database.createIdentity({
    provider: params.provider,
    providerAccountId: params.providerAccountId,
    userId: newUser.id,
  });

  return {
    userId: newUser.id,
    isNew: true,
  };
}

/**
 * Retrieves the names of all providers linked to a user.
 */
export async function getUserProviderNames(
  database: AuthDatabase,
  userId: string
): Promise<string[]> {
  const identities = await database.getUserIdentities(userId);
  return identities.map((i) => i.provider);
}

/**
 * Shapes the session object to carry only the user's ID and linked provider names.
 */
export function shapeAuthSession(params: {
  userId: string;
  providers: string[];
  expires: string;
}) {
  return {
    expires: params.expires,
    userId: params.userId,
    providers: params.providers,
    user: {
      id: params.userId,
      providers: params.providers,
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Credentials({
      id: "solana",
      name: "Solana",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.message || !credentials?.signature) {
          return null;
        }

        const message = String(credentials.message);
        const signature = String(credentials.signature);

        const host = req.headers.get("host") ?? "localhost:3000";
        const origin = req.headers.get("origin") ?? `http://${host}`;

        const verification = await verifySiwsMessage({
          message,
          signature,
          expectedDomain: host,
          expectedUri: origin,
          nonceStore: defaultNonceStore,
        });

        if (!verification.ok) {
          return null;
        }

        try {
          const result = await upsertUserAndIdentity(prismaAuthDb, {
            provider: "solana",
            providerAccountId: verification.data.address,
          });

          return {
            id: result.userId,
            name: verification.data.address,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      // Credentials provider authorize already handled validation and user upsert
      if (account?.provider === "solana") {
        return !!user?.id;
      }

      if (!account?.provider || !account.providerAccountId) {
        return false;
      }

      try {
        const result = await upsertUserAndIdentity(prismaAuthDb, {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        user.id = result.userId;
        return true;
      } catch {
        return false;
      }
    },

    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (token.sub) {
        try {
          token.providers = await getUserProviderNames(prismaAuthDb, token.sub);
        } catch {
          token.providers = token.providers ?? [];
        }
      }

      return token;
    },

    async session({ session, token }) {
      const userId = token.sub ?? "";
      const providers = Array.isArray(token.providers)
        ? (token.providers as string[])
        : [];

      const shaped = shapeAuthSession({
        userId,
        providers,
        expires: session.expires ? new Date(session.expires).toISOString() : new Date().toISOString(),
      });

      return {
        ...session,
        ...shaped,
      };
    },
  },
});
