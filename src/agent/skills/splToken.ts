/**
 * SPL Token skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const splTokenSkill: Skill = {
  id: "spl-token",
  name: "SPL Token Integration",
  description: "Fungible and non-fungible token mints, Associated Token Accounts (ATA), transfers, and CPI bindings.",
  triggerKeywords: ["spl-token", "spl token", "mint", "token account", "ata", "associated token account", "transfer_checked", "token program"],
  relevantStages: ["PLAN", "GENERATE"],
  workflow: `1. Import anchor_spl::token::{Token, TokenAccount, Mint, Transfer, transfer}
2. Define Associated Token Accounts in #[derive(Accounts)]
3. Use #[account(init, payer = user, associated_token::mint = mint, associated_token::authority = user)]
4. Execute token transfers via CPI with token::transfer or token::transfer_checked`,
  expectedOutputSchema: "Anchor instructions and account structs managing SPL token transfers, mints, and vault ATAs.",
  failureRules: [
    "Never create unassociated token accounts without valid owner specification",
    "Never transfer tokens without checking mint decimals and authority",
    "Never omit token program account validation",
  ],
  securityBoundary: [
    "Always verify token account mint matches the expected asset mint",
    "Always verify authority over the source token account",
  ],
  content: `### SPL Token Best Practices
- Use anchor_spl::token or anchor_spl::associated_token modules.
- Derive ATAs deterministically: #[account(associated_token::mint = mint, associated_token::authority = authority)]
- For token CPI transfers:
  let cpi_accounts = Transfer {
      from: ctx.accounts.from.to_account_info(),
      to: ctx.accounts.to.to_account_info(),
      authority: ctx.accounts.authority.to_account_info(),
  };
  let cpi_program = ctx.accounts.token_program.to_account_info();
  token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;`,
};

