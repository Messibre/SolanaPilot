# ADR 0006: Defensive Structured Logging with Proactive Secret Redaction

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: SolanaPilot Core Team

## Context

Developing Solana programs requires managing sensitive cryptographic material: Solana base58 private keypairs, mnemonic seed phrases, AI API keys, and OAuth tokens. Standard developer practices often use unredacted `console.log` statements for debugging. In an AI extension that inspects compiler outputs, executes shell processes, and exports run receipts, unredacted logging poses an unacceptable risk of accidental credential exfiltration into shared outputs, issue reports, or git history.

## Decision

We implement a centralized, defensive structured logging architecture (`src/core/logger.ts` and `src/security/redact.ts`):
1. **No `console.log`**: Standard `console.log` is prohibited across extension source code and flagged during review.
2. **Proactive Redaction on Write**: All logged text passes through `redact(text)` before serialization. The redaction engine scrubs Solana base58 private keys, seed phrases, JWT tokens, GitHub personal access tokens, and API keys.
3. **Structured Event Format**: Every log entry records timestamp, log level (`DEBUG`, `INFO`, `WARN`, `ERROR`), category, event name, and redacted attributes.
4. **Pluggable Dual Sinks**:
   - `OutputChannelSink`: Streams human-readable logs to VS Code's output channel.
   - `FileLogSink`: Appends structured JSONL events to a size-capped rotating log file (capped at 5 MB).

## Alternatives Considered

1. **Standard `console.log` / OutputChannel Writes**:
   - *Rejected*: Inevitably leads to credential leakage when developers log raw objects or error messages containing authorization headers or keypairs.
2. **Heavy Logging Frameworks (Winston / Pino / Bunyan)**:
   - *Rejected*: Introduce unnecessary dependencies, worker thread overhead, and native module compilation complexities into the VS Code extension bundle.

## Consequences

- **Zero Credential Exposure**: Private keys and API tokens are masked even if accidentally passed into log invocations.
- **Auditable Structured Diagnostics**: JSONL output enables automated parsing and triage of pipeline failures.
- **Zero External Dependencies**: Pure TypeScript implementation conforming to the minimal dependency policy.

## Reverse This Decision If

Reverse this decision if redaction regex evaluation overhead exceeds **5.0 ms per event** on average across 1,000 log events, or if false-positive redactions corrupt **> 1.0% of valid program source code or public addresses** in diagnostic outputs.

