/**
 * Security checklist skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const securityChecklistSkill: Skill = {
  id: "security-checklist",
  name: "Security Checklist & Audit",
  description: "Comprehensive 10-point Solana security audit checklist: signer checks, owner checks, overflow, reinit, and rent drains.",
  triggerKeywords: ["security", "audit", "review", "vulnerability", "signer check", "owner check", "arithmetic overflow", "reentrancy"],
  relevantStages: ["PLAN", "VALIDATE", "REVIEW"],
  workflow: `1. Verify every mutable account has #[account(mut)]
2. Verify every authority has Signer<'info>
3. Verify checked arithmetic for all mathematical calculations
4. Verify PDA seeds and canonical bump constraints
5. Verify admin controls with has_one or custom constraints
6. Verify account closures use close=target to prevent rent drains
7. Verify program IDs in all CPI calls`,
  expectedOutputSchema: "Structured security audit report with findings: {severity, location, issue, suggestion}.",
  failureRules: [
    "Never approve code containing naked unwrap() or unchecked arithmetic",
    "Never approve code with missing signer checks on administrative instructions",
  ],
  securityBoundary: [
    "High-severity findings must block deployment until explicit user confirmation",
    "Enforce strict ownership and signer validation on all on-chain mutations",
  ],
  content: `### 10-Point Solana Security Checklist
1. Signer Verification: Is every authority account a Signer<'info>?
2. Owner Validation: Does the program own accounts it modifies?
3. Integer Overflow: Are all operations performed with checked_add/sub/mul?
4. PDA Seeds Collision: Are seeds unique and properly scoped?
5. Reinitialization Protection: Are accounts guarded with init to prevent overwriting?
6. Arbitrary CPI: Are program IDs validated before invoke?
7. Account Reloading: Are accounts reloaded after CPI if modified?
8. Rent Exemption: Is account size calculated accurately?
9. Duplicate Mutable Accounts: Can the same account be passed twice to bypass logic?
10. Proper Error Codes: Are errors defined in #[error_code] with clear descriptions?`,
};

