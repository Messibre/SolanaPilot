/**
 * Demo fixtures — valid base58 addresses so Explorer links resolve to real accounts.
 * Set NEXT_PUBLIC_REGISTRY_LIVE=true to load from /api/programs instead.
 */

export interface ProgramEntry {
  publicKey: string;
  programId: string;
  programName: string;
  description: string;
  instructionCount: number;
  creator: string;
  registeredAt: number;
  lastUpdated: number;
  generatorVersion: string;
  deploymentCount: number;
}

const now = () => Math.floor(Date.now() / 1000);

export const MOCK_PROGRAMS: ProgramEntry[] = [
  {
    publicKey: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    programId: "Vote111111111111111111111111111111111111111",
    programName: "community_polls",
    description:
      "On-chain polls with weighted voting, deadline enforcement, and creator-controlled metadata.",
    instructionCount: 3,
    creator: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    registeredAt: now() - 86400 * 5,
    lastUpdated: now() - 3600 * 2,
    generatorVersion: "1.0.0",
    deploymentCount: 2,
  },
  {
    publicKey: "5ZWj7a1f8tWkjBESHKgrAHhqXwAZ1gZGhNrJhQiVQOwL",
    programId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bc87dYt2",
    programName: "nft_escrow_market",
    description:
      "Escrow NFT sales with two-step release, optional royalties hint, and buyer/seller PDAs.",
    instructionCount: 3,
    creator: "4Nd1mTFacAjAyFwBfXTeJnXLzdCjQbWojCgT3STt1i8",
    registeredAt: now() - 86400 * 12,
    lastUpdated: now() - 86400,
    generatorVersion: "1.0.0",
    deploymentCount: 4,
  },
  {
    publicKey: "CK8MGKFBH4wF2CCMHaK1N7rPNqjSL2DLnrBVRaYkqZf",
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    programName: "spl_stream_vault",
    description:
      "Time-locked SPL token streams for payroll and grants with cancel and withdraw milestones.",
    instructionCount: 2,
    creator: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    registeredAt: now() - 86400 * 2,
    lastUpdated: now() - 3600 * 6,
    generatorVersion: "1.0.0",
    deploymentCount: 1,
  },
  {
    publicKey: "4Tx3v6NjQJDksF8RvdZS4gWj27LdzPfY4rKb9QHGhmd2",
    programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    programName: "dao_proposal_hub",
    description:
      "Minimal DAO flow: create proposal, cast vote, execute after quorum — devnet-friendly defaults.",
    instructionCount: 3,
    creator: "5ZWj7a1f8tWkjBESHKgrAHhqXwAZ1gZGhNrJhQiVQOwL",
    registeredAt: now() - 86400 * 20,
    lastUpdated: now() - 86400 * 3,
    generatorVersion: "0.9.2",
    deploymentCount: 7,
  },
  {
    publicKey: "E5mf9YfVHxLK6PZy9qy9f5ZzyfnV7GJuGjaRzyJSL2WA",
    programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    programName: "micro_lend_pool",
    description:
      "Peer pool lending with deposit, borrow, repay, and liquidate hooks sized for hackathon demos.",
    instructionCount: 2,
    creator: "4Nd1mTFacAjAyFwBfXTeJnXLzdCjQbWojCgT3STt1i8",
    registeredAt: now() - 86400 * 8,
    lastUpdated: now() - 3600 * 12,
    generatorVersion: "1.0.0",
    deploymentCount: 3,
  },
];
