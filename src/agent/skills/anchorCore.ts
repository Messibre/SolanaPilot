/**
 * Anchor Core skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const PROGRAM_GENERATION_PROMPT = `
Generate a complete, deployable Anchor smart contract.
Reference: https://solana.com/developers/templates for program patterns.

REQUIREMENTS:
- Use Anchor framework exclusively (not native Solana Rust)
- Return ONLY valid JSON in the specified schema
- The code must compile with: anchor build (Anchor 0.30+, Solana 1.18+)
- Use checked arithmetic (checked_add, checked_mul, checked_sub) for all math
- Include #[error_code] enum with at least 2 custom errors
- Add account validation constraints on ALL mutable accounts
- Comments should explain WHY constraints are needed, not just WHAT they do
- Maximum 3 instructions for clarity and instruction size budget (1232 byte limit)
- Include descriptive error codes for debugging
`;

export const anchorCoreSkill: Skill = {
  id: "anchor-core",
  name: "Anchor Core Development",
  description: "Core Anchor framework patterns (#[program], #[derive(Accounts)], #[account], space, constraints, error_code).",
  triggerKeywords: ["anchor", "program", "instruction", "derive(accounts)", "account", "declare_id", "idl"],
  relevantStages: ["PLAN", "GENERATE", "BUILD", "FIX"],
  workflow: `1. Define program module with #[program] mod my_program
2. Define instruction account contexts with #[derive(Accounts)]
3. Apply space, init, mut, signer, and has_one constraints
4. Implement instruction logic using checked arithmetic
5. Define #[error_code] enum with domain-specific errors`,
  expectedOutputSchema: "Complete Rust module using Anchor 0.30+ annotations, valid #[program], and #[derive(Accounts)] structs.",
  failureRules: [
    "Never use native solana_program entrypoint without Anchor",
    "Never emit unwrap() in program logic; use ? operator",
    "Never miss 8-byte discriminator in space calculation (space = 8 + field_sizes)",
  ],
  securityBoundary: [
    "All mutable accounts must have #[account(mut)]",
    "All signers must be Signer<'info>",
    "Never assume sequential instruction execution",
  ],
  content: `### Anchor Core Best Practices
- Structure programs with declare_id!, #[program] module, instruction handlers, #[derive(Accounts)] structs, and #[account] state structs.
- Calculate account space precisely: 8 bytes discriminator + struct field sizes.
- Use Anchor 0.30+ constraints: #[account(init, payer = user, space = 8 + size)], #[account(mut)], #[account(has_one = authority)].
- Handle errors via custom #[error_code] enum rather than generic errors.`,
};

