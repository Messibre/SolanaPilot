/**
 * Testing & verification skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const testingSkill: Skill = {
  id: "testing",
  name: "Anchor Testing & Verification",
  description: "Anchor TypeScript integration tests (Mocha/Chai), happy-path execution, expected error assertions, and devnet verification.",
  triggerKeywords: ["test", "testing", "mocha", "chai", "anchor test", "validator", "bankrun"],
  relevantStages: ["VALIDATE", "BUILD", "TEST", "FIX"],
  workflow: `1. Import * as anchor from "@coral-xyz/anchor" and { expect } from "chai"
2. Initialize program client with anchor.workspace.ProgramName
3. Test happy path: invoke instruction and assert account data changes
4. Test failure path: assert expected errors and constraints reject unauthorized callers`,
  expectedOutputSchema: "Mocha/Chai TypeScript test suites covering instructions, authorization checks, and error codes.",
  failureRules: [
    "Never write tests without assertions on final account states",
    "Never skip testing unauthorized signer rejections",
  ],
  securityBoundary: [
    "Tests must execute against local validator or devnet, never mainnet",
    "Assertions must verify specific custom #[error_code] outputs",
  ],
  content: `### Anchor Integration Testing
- Structure tests with describe and it blocks.
- Setup test accounts, keypairs, and airdrop SOL if testing on local validator or devnet.
- Assert expected error codes:
  try {
    await program.methods.unauthorizedAction().accounts({...}).rpc();
    expect.fail("Expected instruction to fail");
  } catch (err: any) {
    expect(err.error?.errorCode?.code).to.equal("NotAuthorized");
  }`,
};

