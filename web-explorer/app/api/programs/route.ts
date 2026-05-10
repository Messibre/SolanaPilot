import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";

const REGISTRY_PROGRAM_ID = new PublicKey(
  "Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs",
);

function resolveIdlPath(): string {
  const candidates = [
    path.join(process.cwd(), "..", "idl", "solanapilot_registry.json"),
    path.join(process.cwd(), "lib", "solanapilot_registry.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "IDL not found. Expected ../idl/solanapilot_registry.json (monorepo) or lib/solanapilot_registry.json.",
  );
}

function loadIdl(): Idl {
  const idlPath = resolveIdlPath();
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as Idl;
  idl.address = REGISTRY_PROGRAM_ID.toBase58();
  return idl;
}

function toInt(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (n && typeof n === "object" && "toNumber" in n) {
    const fn = (n as { toNumber: () => number }).toNumber;
    if (typeof fn === "function") return fn.call(n);
  }
  const s = String(n);
  const parsed = parseInt(s, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

type ProgramEntryAccount = {
  programId: PublicKey;
  programName: string;
  description: string;
  instructionCount: number;
  creator: PublicKey;
  registeredAt: unknown;
  lastUpdated: unknown;
  generatorVersion: string;
  deploymentCount: unknown;
};

export async function GET() {
  const rpc =
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://api.devnet.solana.com";

  try {
    const connection = new Connection(rpc, "confirmed");
    const wallet = new Wallet(Keypair.generate());
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const idl = loadIdl();
    const program = new Program(idl, provider);
    const rows = await program.account.programEntry.all();

    const programs = rows.map(({ publicKey, account }) => {
      const a = account as ProgramEntryAccount;
      return {
        publicKey: publicKey.toBase58(),
        programId: a.programId.toBase58(),
        programName: a.programName,
        description: a.description,
        instructionCount: a.instructionCount,
        creator: a.creator.toBase58(),
        registeredAt: toInt(a.registeredAt),
        lastUpdated: toInt(a.lastUpdated),
        generatorVersion: a.generatorVersion,
        deploymentCount: toInt(a.deploymentCount),
      };
    });

    programs.sort((x, y) => y.lastUpdated - x.lastUpdated);

    return NextResponse.json({ programs });
  } catch (e) {
    console.error("[registry-api]", e);
    const message = e instanceof Error ? e.message : "Failed to fetch registry";
    return NextResponse.json(
      { error: message, programs: [] as unknown[] },
      { status: 500 },
    );
  }
}
