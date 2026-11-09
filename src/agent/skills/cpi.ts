/**
 * Cross-Program Invocations (CPI) skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const cpiSkill: Skill = {
  id: "cpi",
  name: "Cross-Program Invocations (CPI)",
  description: "Cross-Program Invocations, CpiContext, PDA signing with invoke_signed, and program address validation.",
  triggerKeywords: ["cpi", "cross-program invocation", "invoke", "invoke_signed", "cpi_context", "system_program::transfer"],
  relevantStages: ["GENERATE", "BUILD", "FIX"],
  workflow: `1. Identify target external program and required accounts
2. Wrap external instruction context using Anchor CpiContext::new or CpiContext::new_with_signer
3. For PDA signers, prepare outer seed slices: &[&[seed1, seed2, &[bump]]]
4. Invoke external instruction and propagate Result<()>`,
  expectedOutputSchema: "Anchor CPI handler functions using CpiContext and seed signer arrays.",
  failureRules: [
    "Never pass unchecked AccountInfo as program ID; always use Program<'info, T>",
    "Never leak PDA bump seeds or construct mismatched seed slices",
  ],
  securityBoundary: [
    "Strictly validate target program ID matches expected on-chain address",
    "Only authorize PDA seeds intended for the specific CPI recipient",
  ],
  content: `### Cross-Program Invocations (CPI)
- Anchor provides typed CPI helpers:
  CpiContext::new(target_program, accounts_struct)
  CpiContext::new_with_signer(target_program, accounts_struct, signer_seeds)
- For PDA signing:
  let seeds = &[b"escrow".as_ref(), user.key.as_ref(), &[bump]];
  let signer_seeds = &[&seeds[..]];
  token::transfer(CpiContext::new_with_signer(program, cpi_accounts, signer_seeds), amount)?;`,
};

