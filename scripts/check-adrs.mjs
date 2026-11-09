#!/usr/bin/env node

/**
 * ADR Validator Script
 *
 * Scans docs/adr/*.md and ensures each ADR:
 * 1. Has a recognized title (# ADR NNNN: ...)
 * 2. Contains Context, Decision, Alternatives Considered, Consequences
 * 3. Contains a 'Reverse This Decision If' section
 * 4. Contains at least one explicit NUMERIC reversal trigger (e.g. digits / percentages / thresholds)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adrDir = path.resolve(__dirname, "../docs/adr");

if (!fs.existsSync(adrDir)) {
  console.error(`ADR directory not found: ${adrDir}`);
  process.exit(1);
}

const adrFiles = fs
  .readdirSync(adrDir)
  .filter((f) => f.endsWith(".md"))
  .sort();

if (adrFiles.length === 0) {
  console.error("No ADR files found in docs/adr");
  process.exit(1);
}

const errors = [];
let verifiedCount = 0;

for (const file of adrFiles) {
  const filePath = path.join(adrDir, file);
  const content = fs.readFileSync(filePath, "utf8");

  // Check title
  if (!/^#\s+ADR\s+\d+:/im.test(content)) {
    errors.push(`${file}: Missing valid title format (expected '# ADR NNNN: ...')`);
  }

  // Check Context
  if (!/^##\s+Context/im.test(content)) {
    errors.push(`${file}: Missing '## Context' section`);
  }

  // Check Decision
  if (!/^##\s+Decision/im.test(content)) {
    errors.push(`${file}: Missing '## Decision' section`);
  }

  // Check Alternatives
  if (!/^##\s+Alternatives/im.test(content)) {
    errors.push(`${file}: Missing '## Alternatives Considered' section`);
  }

  // Check Consequences
  if (!/^##\s+Consequences/im.test(content)) {
    errors.push(`${file}: Missing '## Consequences' section`);
  }

  // Check Reversal section
  const reverseMatch = content.match(/##\s+Reverse\s+[Tt]his\s+[Dd]ecision\s+[Ii]f([\s\S]*)$/i);
  if (!reverseMatch) {
    errors.push(`${file}: Missing '## Reverse This Decision If' section`);
  } else {
    const reverseSection = reverseMatch[1];
    // Check for numeric condition in reversal section (\d+)
    const hasNumericTrigger = /\d+/.test(reverseSection);
    if (!hasNumericTrigger) {
      errors.push(
        `${file}: 'Reverse This Decision If' section lacks an explicit numeric reversal trigger (must contain numbers/metrics)`
      );
    }
  }

  if (errors.length === 0) {
    verifiedCount++;
  }
}

if (errors.length > 0) {
  console.error(`\nADR Verification Failed with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`ADR check: OK (${adrFiles.length} ADRs verified with numeric reversal triggers)`);
process.exit(0);

