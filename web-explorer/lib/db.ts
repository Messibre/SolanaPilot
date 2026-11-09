import { PrismaClient } from "@prisma/client";

/**
 * Global singleton pattern for PrismaClient in Next.js.
 * Prevents multiple client instances from being instantiated during hot-module replacement in development.
 */
const globalForPrisma = globalThis as unknown as {
  prismaClientInstance: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prismaClientInstance ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClientInstance = db;
}

export { PrismaClient };

