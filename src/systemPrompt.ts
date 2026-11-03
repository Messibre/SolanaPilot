/**
 * @deprecated Monolithic system prompt split into modular skills in src/agent/skills/ and src/ai/prompts/base.ts.
 * Forwarding exports provided for backward compatibility until legacy generators are retired in T-035/T-037.
 */

export { BASE_SYSTEM_PROMPT as SOLANA_SYSTEM_PROMPT } from "./ai/prompts/base";
export { PROGRAM_GENERATION_PROMPT } from "./agent/skills/anchorCore";
export { FRONTEND_PROMPT } from "./agent/skills/frontendWallet";
