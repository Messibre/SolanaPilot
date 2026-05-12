import {
  AnchorProvider,
  Program,
  type Idl,
  type Wallet,
} from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import idl from "./idl.json";
import type { Program as RegistryProgram } from "./mock-data";

const PROGRAM_ID = new PublicKey("Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs");
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const CACHE_TTL_MS = 30_000;

const cache: {
  data: RegistryProgram[] | null;
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0,
};

function getRpcUrl() {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC_URL;
}

function createReadOnlyWallet(): Wallet {
  const keypair = Keypair.generate();

  return {
    publicKey: keypair.publicKey,
    signTransaction: async () => {
      throw new Error("Read-only wallet cannot sign transactions.");
    },
    signAllTransactions: async () => {
      throw new Error("Read-only wallet cannot sign transactions.");
    },
  } as Wallet;
}

function getConnection() {
  return new Connection(getRpcUrl(), "confirmed");
}

function getProvider() {
  const connection = getConnection();
  return new AnchorProvider(connection, createReadOnlyWallet(), {
    commitment: "confirmed",
  });
}

async function accountDiscriminator(accountName: string): Promise<Uint8Array> {
  const preimage = `account:${accountName}`;
  const encoded = new TextEncoder().encode(preimage);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(digest).slice(0, 8);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);

  if (value && typeof value === "object") {
    const maybeBn = value as {
      toNumber?: () => number;
      toString?: () => string;
    };

    if (typeof maybeBn.toNumber === "function") {
      return maybeBn.toNumber();
    }

    if (typeof maybeBn.toString === "function") {
      const parsed = Number(maybeBn.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return 0;
}

function toIsoFromUnixSeconds(value: unknown): string {
  const seconds = toNumber(value);
  return new Date(seconds * 1000).toISOString();
}

function mapError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("fetch")
  ) {
    return new Error(
      "Unable to reach Solana devnet. Check your internet connection.",
    );
  }

  if (
    lower.includes("could not find") ||
    lower.includes("account does not exist") ||
    lower.includes("program")
  ) {
    return new Error(
      "Registry program not found on devnet. The program may need redeployment.",
    );
  }

  if (
    lower.includes("decode") ||
    lower.includes("borsh") ||
    lower.includes("idl")
  ) {
    return new Error(
      "Data format error. The on-chain data might be corrupted.",
    );
  }

  return new Error(
    "Unable to reach Solana devnet. Check your internet connection.",
  );
}

export async function fetchRegistryEntries(): Promise<RegistryProgram[]> {
  const now = Date.now();
  if (cache.data && cache.expiresAt > now) {
    return cache.data;
  }

  try {
    const connection = getConnection();
    const program = new Program(idl as Idl, PROGRAM_ID, getProvider());
    const discriminator = await accountDiscriminator("ProgramEntry");

    const accounts = await connection.getProgramAccounts(program.programId, {
      filters: [{ memcmp: { offset: 0, bytes: bs58.encode(discriminator) } }],
      commitment: "confirmed",
    });

    const entries = accounts
      .map(({ pubkey, account }) => {
        const decoded = program.coder.accounts.decode(
          "ProgramEntry",
          account.data,
        ) as {
          programId: PublicKey;
          programName: string;
          description: string;
          instructionCount: number;
          deploymentCount: unknown;
          creator: PublicKey;
          registeredAt: unknown;
          generatorVersion: string;
          lastUpdated: unknown;
        };

        return {
          programId: decoded.programId.toBase58(),
          programName: decoded.programName,
          description: decoded.description,
          instructionCount: toNumber(decoded.instructionCount),
          deploymentCount: toNumber(decoded.deploymentCount),
          creator: decoded.creator.toBase58(),
          registeredAt: toIsoFromUnixSeconds(decoded.registeredAt),
          version: decoded.generatorVersion,
          registryPda: pubkey.toBase58(),
          category: "General",
          lastDeployed: toIsoFromUnixSeconds(decoded.lastUpdated),
        } satisfies RegistryProgram;
      })
      .sort(
        (a, b) =>
          new Date(b.registeredAt).getTime() -
          new Date(a.registeredAt).getTime(),
      );

    cache.data = entries;
    cache.expiresAt = now + CACHE_TTL_MS;

    return entries;
  } catch (error) {
    throw mapError(error);
  }
}
