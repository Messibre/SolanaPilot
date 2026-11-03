/**
 * Token-2022 (Token Extensions) skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const token2022Skill: Skill = {
  id: "token-2022",
  name: "Token-2022 (Token Extensions)",
  description: "Modern Solana token extensions: transfer fees, interest-bearing tokens, mint close authorities, and metadata pointers.",
  triggerKeywords: ["token-2022", "token extensions", "transfer fee", "interest-bearing", "mint close authority", "metadata pointer"],
  relevantStages: ["PLAN", "GENERATE"],
  workflow: `1. Import anchor_spl::token_interface::{Token2022, TokenAccount, Mint}
2. Configure token extension types (transfer fee, metadata, close authority)
3. Use Interface<'info, TokenInterface> to support both standard Token and Token-2022 where appropriate
4. Handle transfer fee calculations via transfer_checked`,
  expectedOutputSchema: "Anchor programs utilizing anchor_spl::token_interface and Token-2022 extension types.",
  failureRules: [
    "Never call legacy spl-token instructions on mints requiring Token-2022 extensions",
    "Never ignore fee calculation overhead in balance checks when transfer fees are active",
  ],
  securityBoundary: [
    "Validate extension pointers and authority controls",
    "Ensure programs do not accept counterfeit mint accounts without extension verification",
  ],
  content: `### Token-2022 Extensions Architecture
- Use spl-token-2022 or anchor_spl::token_interface.
- Extensions allow custom transfer logic (e.g. transfer fees, interest rates, soulbound non-transferable tokens).
- Use transfer_checked to pass expected decimals and avoid truncation.`,
};

