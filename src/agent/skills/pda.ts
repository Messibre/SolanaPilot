/**
 * Program Derived Addresses (PDA) skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const pdaSkill: Skill = {
  id: "pda",
  name: "Program Derived Addresses (PDA)",
  description: "Deterministic PDA derivation, seed schemas, canonical bump validation, and client-side helpers.",
  triggerKeywords: ["pda", "seeds", "bump", "findprogramaddress", "program derived address", "canonical bump"],
  relevantStages: ["PLAN", "GENERATE"],
  workflow: `1. Select deterministic, collision-resistant seeds (e.g. [b"user-profile", user.key().as_ref()])
2. Declare Anchor PDA constraints: #[account(seeds = [...], bump)]
3. Pass bump parameter if storing or validating bump in state
4. In client TS, derive matching address with PublicKey.findProgramAddressSync([seeds], programId)`,
  expectedOutputSchema: "Anchor accounts struct with #[account(seeds = [...], bump)] and associated state structs.",
  failureRules: [
    "Never hardcode static seeds without distinguishing namespace or unique pubkey",
    "Never accept unvalidated arbitrary bump seeds from user arguments",
    "Never use variable-length user-controlled seeds without hashing or length limits",
  ],
  securityBoundary: [
    "Always validate that PDA addresses match canonical bumps",
    "Ensure PDA authority cannot be spoofed by external signatures",
  ],
  content: `### PDA Derivation & Constraints
- PDAs have no private keys and are owned by the program.
- In Anchor: #[account(init, payer = user, space = 8 + 64, seeds = [b"escrow", user.key().as_ref()], bump)]
- When accessing existing PDAs: #[account(mut, seeds = [b"escrow", user.key().as_ref()], bump = escrow.bump)]
- Store the canonical bump in the account during initialization to save compute on subsequent transactions.`,
};

