import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";
import { db } from "@/lib/db";

export interface SiwsMessageData {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version?: string;
  chainId?: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export interface NonceStore {
  createNonce(ttlMs?: number): Promise<{ nonce: string; expiresAt: Date }>;
  consumeNonce(
    nonce: string,
    now?: Date
  ): Promise<"ok" | "not_found" | "already_used" | "expired">;
}

/**
 * In-memory atomic NonceStore implementation for tests and offline dev.
 */
export class InMemoryNonceStore implements NonceStore {
  private nonces = new Map<
    string,
    { expiresAt: Date; usedAt: Date | null }
  >();
  private lock = Promise.resolve();

  async createNonce(ttlMs = 5 * 60 * 1000): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + ttlMs);
    this.nonces.set(nonce, { expiresAt, usedAt: null });
    return { nonce, expiresAt };
  }

  async consumeNonce(
    nonce: string,
    now = new Date()
  ): Promise<"ok" | "not_found" | "already_used" | "expired"> {
    // Atomic synchronization to guarantee single-winner on concurrent use
    return new Promise((resolve) => {
      this.lock = this.lock.then(async () => {
        const record = this.nonces.get(nonce);
        if (!record) {
          resolve("not_found");
          return;
        }
        if (record.usedAt !== null) {
          resolve("already_used");
          return;
        }
        if (record.expiresAt.getTime() <= now.getTime()) {
          resolve("expired");
          return;
        }

        // Atomically mark used
        record.usedAt = now;
        resolve("ok");
      });
    });
  }
}

/**
 * Production NonceStore using Prisma and atomic PostgreSQL UPDATE query.
 */
export class PrismaNonceStore implements NonceStore {
  async createNonce(ttlMs = 5 * 60 * 1000): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + ttlMs);

    await db.walletNonce.create({
      data: {
        nonce,
        expiresAt,
      },
    });

    return { nonce, expiresAt };
  }

  async consumeNonce(
    nonce: string,
    now = new Date()
  ): Promise<"ok" | "not_found" | "already_used" | "expired"> {
    // Check if nonce exists first
    const record = await db.walletNonce.findUnique({
      where: { nonce },
    });

    if (!record) {
      return "not_found";
    }

    if (record.usedAt !== null) {
      return "already_used";
    }

    if (record.expiresAt.getTime() <= now.getTime()) {
      return "expired";
    }

    // Atomic update where usedAt is null and expiresAt > now
    const updated = await db.walletNonce.updateMany({
      where: {
        nonce,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    if (updated.count === 1) {
      return "ok";
    }

    return "already_used";
  }
}

export const defaultNonceStore = new PrismaNonceStore();

/**
 * Formats a SIWS message following the Sign-In with Solana standard structure.
 */
export function formatSiwsMessage(data: SiwsMessageData): string {
  const lines: string[] = [
    `${data.domain} wants you to sign in with your Solana account:`,
    data.address,
    "",
  ];

  if (data.statement) {
    lines.push(data.statement, "");
  }

  lines.push(`URI: ${data.uri}`);
  lines.push(`Version: ${data.version ?? "1"}`);
  if (data.chainId) {
    lines.push(`Chain ID: ${data.chainId}`);
  }
  lines.push(`Nonce: ${data.nonce}`);
  lines.push(`Issued At: ${data.issuedAt}`);
  if (data.expirationTime) {
    lines.push(`Expiration Time: ${data.expirationTime}`);
  }

  return lines.join("\n");
}

/**
 * Parses raw text into a SiwsMessageData object.
 */
export function parseSiwsMessage(text: string): SiwsMessageData | null {
  const lines = text.split("\n");
  if (lines.length < 5) {
    return null;
  }

  const headerMatch = lines[0].match(/^(.*) wants you to sign in with your Solana account:$/);
  if (!headerMatch) {
    return null;
  }

  const domain = headerMatch[1].trim();
  const address = lines[1].trim();

  let statement: string | undefined;
  let uri = "";
  let version = "1";
  let chainId: string | undefined;
  let nonce = "";
  let issuedAt = "";
  let expirationTime: string | undefined;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("URI: ")) {
      uri = line.substring(5).trim();
    } else if (line.startsWith("Version: ")) {
      version = line.substring(9).trim();
    } else if (line.startsWith("Chain ID: ")) {
      chainId = line.substring(10).trim();
    } else if (line.startsWith("Nonce: ")) {
      nonce = line.substring(7).trim();
    } else if (line.startsWith("Issued At: ")) {
      issuedAt = line.substring(11).trim();
    } else if (line.startsWith("Expiration Time: ")) {
      expirationTime = line.substring(17).trim();
    } else if (!statement && !line.includes(": ")) {
      statement = line;
    }
  }

  if (!domain || !address || !uri || !nonce || !issuedAt) {
    return null;
  }

  return {
    domain,
    address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  };
}

export interface VerifySiwsParams {
  message: string;
  signature: string;
  expectedDomain: string;
  expectedUri: string;
  nonceStore?: NonceStore;
  now?: Date;
}

export type VerifySiwsResult =
  | { ok: true; data: SiwsMessageData }
  | { ok: false; error: string };

/**
 * Verifies a SIWS message, its ed25519 signature, domain/URI constraints,
 * and atomically consumes the single-use nonce.
 */
export async function verifySiwsMessage(
  params: VerifySiwsParams
): Promise<VerifySiwsResult> {
  const now = params.now ?? new Date();
  const store = params.nonceStore ?? defaultNonceStore;

  const parsed = parseSiwsMessage(params.message);
  if (!parsed) {
    return { ok: false, error: "Invalid SIWS message format" };
  }

  // 1. Domain verification
  if (parsed.domain !== params.expectedDomain) {
    return { ok: false, error: `SIWS domain mismatch: expected ${params.expectedDomain}, got ${parsed.domain}` };
  }

  // 2. URI verification
  if (parsed.uri !== params.expectedUri) {
    return { ok: false, error: `SIWS URI mismatch: expected ${params.expectedUri}, got ${parsed.uri}` };
  }

  // 3. Expiration verification
  if (parsed.expirationTime) {
    const expDate = new Date(parsed.expirationTime);
    if (isNaN(expDate.getTime()) || expDate.getTime() <= now.getTime()) {
      return { ok: false, error: "SIWS message has expired" };
    }
  }

  // 4. Decode and validate Base58 Public Key and Signature
  let pubkeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;

  try {
    pubkeyBytes = bs58.decode(parsed.address);
    if (pubkeyBytes.length !== 32) {
      return { ok: false, error: "Invalid base58 public key length (must be 32 bytes)" };
    }
  } catch {
    return { ok: false, error: "Malformed base58 address" };
  }

  try {
    signatureBytes = bs58.decode(params.signature);
    if (signatureBytes.length !== 64) {
      return { ok: false, error: "Invalid base58 signature length (must be 64 bytes)" };
    }
  } catch {
    return { ok: false, error: "Malformed base58 signature" };
  }

  // 5. Verify cryptographic ed25519 signature
  const messageBytes = new TextEncoder().encode(params.message);
  const isValidSig = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
  if (!isValidSig) {
    return { ok: false, error: "Invalid signature for SIWS message" };
  }

  // 6. Atomically consume the single-use nonce
  const nonceStatus = await store.consumeNonce(parsed.nonce, now);
  if (nonceStatus === "already_used") {
    return { ok: false, error: "Nonce has already been used (replayed nonce)" };
  }
  if (nonceStatus === "expired") {
    return { ok: false, error: "Nonce has expired" };
  }
  if (nonceStatus === "not_found") {
    return { ok: false, error: "Nonce not found or invalid" };
  }

  return { ok: true, data: parsed };
}

