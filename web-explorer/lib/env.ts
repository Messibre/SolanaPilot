import { z } from "zod";

const FORBIDDEN_PUBLIC_PREFIX_SECRETS = [
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_AUTH_SECRET",
  "NEXT_PUBLIC_AUTH_GITHUB_SECRET",
];

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").url("DATABASE_URL must be a valid URL"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_GITHUB_ID: z.string().min(1, "AUTH_GITHUB_ID is required"),
  AUTH_GITHUB_SECRET: z.string().min(1, "AUTH_GITHUB_SECRET is required"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL").optional(),
  SOLANA_RPC_URL: z.string().url("SOLANA_RPC_URL must be a valid URL").default("https://api.devnet.solana.com"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url("NEXT_PUBLIC_SOLANA_RPC_URL must be a valid URL").default("https://api.devnet.solana.com"),
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(["devnet", "localnet", "testnet"]).default("devnet"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type AppEnv = ServerEnv & ClientEnv;

function formatZodIssues(error: z.ZodError, scope: "server" | "client"): Error {
  const missingKeys: string[] = [];
  const invalidKeys: string[] = [];

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "unknown";
    if (issue.code === z.ZodIssueCode.invalid_type && issue.received === "undefined") {
      missingKeys.push(key);
    } else {
      invalidKeys.push(key);
    }
  }

  const uniqueMissing = Array.from(new Set(missingKeys));
  const uniqueInvalid = Array.from(new Set(invalidKeys));

  if (uniqueMissing.length > 0) {
    return new Error(`Missing ${scope} environment variable(s): ${uniqueMissing.join(", ")}`);
  }

  return new Error(`Invalid ${scope} environment variable(s): ${uniqueInvalid.join(", ")}`);
}

export function validateServerEnv(rawEnv: Record<string, string | undefined> = process.env): ServerEnv {
  for (const forbiddenKey of FORBIDDEN_PUBLIC_PREFIX_SECRETS) {
    if (rawEnv[forbiddenKey]) {
      throw new Error(`Forbidden public secret detected: ${forbiddenKey}`);
    }
  }

  const result = serverEnvSchema.safeParse(rawEnv);
  if (!result.success) {
    throw formatZodIssues(result.error, "server");
  }

  return result.data;
}

export function validateClientEnv(rawEnv: Record<string, string | undefined> = process.env): ClientEnv {
  const result = clientEnvSchema.safeParse(rawEnv);
  if (!result.success) {
    throw formatZodIssues(result.error, "client");
  }

  return result.data;
}

export function getEnv(rawEnv: Record<string, string | undefined> = process.env): AppEnv {
  const server = validateServerEnv(rawEnv);
  const client = validateClientEnv(rawEnv);
  return { ...server, ...client };
}
