/**
 * Unit tests for TEST generation and REVIEW pipeline stages.
 * Tests test coverage validation, path guarding, security checklist audit on fixtures, and deploy blocking.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { MockLlmClient } from "../../ai/providers/mock";
import { testStage } from "./test";
import { reviewStage, runStaticSecurityHeuristics } from "./review";
import { SchemaViolationError } from "../../core/errors";

const MOCK_WORKSPACE = process.platform === "win32" ? "C:\\mock\\workspace" : "/mock/workspace";

// --- Fixtures for Security Review ---

const FIXTURE_MISSING_SIGNER = `
use anchor_lang::prelude::*;
declare_id!("Vault11111111111111111111111111111111111111");

#[program]
pub mod vault {
    use super::*;
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.balance = vault.balance.checked_sub(amount).unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, VaultState>,
    /// CHECK: Missing signer verification!
    pub authority: AccountInfo<'info>,
}
`;

const FIXTURE_UNCHECKED_MATH = `
use anchor_lang::prelude::*;
declare_id!("Vault11111111111111111111111111111111111111");

#[program]
pub mod vault {
    use super::*;
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        // Unchecked addition without checked_add
        vault.balance = vault.balance + amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, VaultState>,
    pub user: Signer<'info>,
}
`;

const FIXTURE_CLEAN = `
use anchor_lang::prelude::*;
declare_id!("Vault11111111111111111111111111111111111111");

#[program]
pub mod vault {
    use super::*;
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.balance = vault.balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, VaultState>,
    pub user: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow")]
    Overflow,
}
`;

describe("Stage: TEST generation", () => {
  it("generates valid integration tests with happy and failure path coverage", async () => {
    const validTestResponse = {
      testFiles: [
        {
          path: "tests/my_vault.ts",
          content: "import * as anchor from '@coral-xyz/anchor';\nimport { expect } from 'chai';\n\ndescribe('my_vault', () => {});",
        },
      ],
      coverage: [
        {
          instructionName: "deposit",
          hasHappyPath: true,
          hasFailurePath: true,
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(validTestResponse));

    const result = await testStage({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      programName: "my_vault",
      programCode: FIXTURE_CLEAN,
      instructions: ["deposit"],
      fileExists: () => false,
    });

    expect(result.testFiles.length).toBe(1);
    expect(result.testFiles[0].path).toBe("tests/my_vault.ts");
    expect(result.coverage[0].hasHappyPath).toBe(true);
    expect(result.coverage[0].hasFailurePath).toBe(true);
    expect(result.needsHumanReview).toBe(false);
  });

  it("flags needsHumanReview when an instruction lacks failure path coverage", async () => {
    const incompleteCoverageResponse = {
      testFiles: [
        {
          path: "tests/my_vault.ts",
          content: "describe('my_vault', () => {});",
        },
      ],
      coverage: [
        {
          instructionName: "deposit",
          hasHappyPath: true,
          hasFailurePath: false, // Missing failure path!
        },
      ],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(incompleteCoverageResponse));

    const result = await testStage({
      client,
      workspaceRoot: MOCK_WORKSPACE,
      programName: "my_vault",
      programCode: FIXTURE_CLEAN,
      instructions: ["deposit"],
      fileExists: () => false,
    });

    expect(result.needsHumanReview).toBe(true);
    expect(result.uncertainty).toContain("Missing failure path test coverage");
  });

  it("rejects path traversal in test files", async () => {
    const traversalResponse = {
      testFiles: [
        {
          path: "../outside/test.ts",
          content: "// malicious",
        },
      ],
      coverage: [{ instructionName: "deposit", hasHappyPath: true, hasFailurePath: true }],
      needsHumanReview: false,
    };

    const client = new MockLlmClient()
      .enqueueResponse(JSON.stringify(traversalResponse))
      .enqueueResponse(JSON.stringify(traversalResponse));

    await expect(
      testStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        programName: "my_vault",
        programCode: FIXTURE_CLEAN,
        fileExists: () => false,
      })
    ).rejects.toThrow(SchemaViolationError);
  });

  it("refuses to overwrite existing test file when allowOverwrite is false", async () => {
    const testResponse = {
      testFiles: [
        {
          path: "tests/my_vault.ts",
          content: "// new test code",
        },
      ],
      coverage: [{ instructionName: "deposit", hasHappyPath: true, hasFailurePath: true }],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(testResponse));

    const existingPath = path.resolve(MOCK_WORKSPACE, "tests/my_vault.ts");
    const fileExistsFn = (p: string) => path.resolve(p) === existingPath;

    await expect(
      testStage({
        client,
        workspaceRoot: MOCK_WORKSPACE,
        programName: "my_vault",
        programCode: FIXTURE_CLEAN,
        fileExists: fileExistsFn,
        allowOverwrite: false,
      })
    ).rejects.toThrow(/Refusing to overwrite existing file without confirmation/);
  });
});

describe("Stage: REVIEW (Security Checklist Audit)", () => {
  it("detects missing signer check in fixture and blocks deploy", async () => {
    const modelAuditResponse = {
      summary: "Critical security issue found: missing signer validation on authority",
      findings: [
        {
          severity: "high",
          location: "Withdraw.authority",
          issue: "Authority is unverified AccountInfo instead of Signer",
          suggestion: "Use Signer<'info> for authority",
        },
      ],
      needsHumanReview: true,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(modelAuditResponse));

    const result = await reviewStage({
      client,
      programName: "vault",
      programCode: FIXTURE_MISSING_SIGNER,
    });

    expect(result.findings.length).toBeGreaterThan(0);
    const signerFinding = result.findings.find(
      (f) => f.issue.toLowerCase().includes("signer") && f.severity === "high"
    );
    expect(signerFinding).toBeDefined();
    expect(result.blocksDeploy).toBe(true);
    expect(result.needsHumanReview).toBe(true);
  });

  it("detects unchecked arithmetic in fixture and blocks deploy", async () => {
    const modelAuditResponse = {
      summary: "Integer overflow risk in deposit handler",
      findings: [
        {
          severity: "high",
          location: "vault::deposit",
          issue: "Naked addition vault.balance + amount is subject to integer overflow",
          suggestion: "Use checked_add",
        },
      ],
      needsHumanReview: true,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(modelAuditResponse));

    const result = await reviewStage({
      client,
      programName: "vault",
      programCode: FIXTURE_UNCHECKED_MATH,
    });

    expect(result.findings.length).toBeGreaterThan(0);
    const mathFinding = result.findings.find(
      (f) => f.issue.toLowerCase().includes("arithmetic") || f.issue.toLowerCase().includes("overflow")
    );
    expect(mathFinding).toBeDefined();
    expect(mathFinding?.severity).toBe("high");
    expect(result.blocksDeploy).toBe(true);
  });

  it("reports no issues and allows deploy for clean fixture", async () => {
    const cleanAuditResponse = {
      summary: "Code complies with 10-point Solana security checklist. No vulnerabilities found.",
      findings: [],
      needsHumanReview: false,
    };

    const client = new MockLlmClient().enqueueResponse(JSON.stringify(cleanAuditResponse));

    const result = await reviewStage({
      client,
      programName: "vault",
      programCode: FIXTURE_CLEAN,
    });

    expect(result.findings.length).toBe(0);
    expect(result.blocksDeploy).toBe(false);
    expect(result.needsHumanReview).toBe(false);
    expect(result.summary).toContain("complies with 10-point Solana security checklist");
  });

  it("static heuristics detect missing signer and unchecked math independently", () => {
    const signerFindings = runStaticSecurityHeuristics(FIXTURE_MISSING_SIGNER);
    expect(signerFindings.length).toBe(1);
    expect(signerFindings[0].severity).toBe("high");
    expect(signerFindings[0].issue).toContain("Signer<'info>");

    const mathFindings = runStaticSecurityHeuristics(FIXTURE_UNCHECKED_MATH);
    expect(mathFindings.length).toBe(1);
    expect(mathFindings[0].severity).toBe("high");
    expect(mathFindings[0].issue).toContain("arithmetic");
    expect(mathFindings[0].suggestion).toContain("checked_add");

    const cleanFindings = runStaticSecurityHeuristics(FIXTURE_CLEAN);
    expect(cleanFindings.length).toBe(0);
  });
});
