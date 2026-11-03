# SolanaPilot Refactor Handoff Snapshot

- **Date (UTC)**: 2026-11-03 12:10
- **Current Phase**: Phase 3 — Agent Engine
- **Last Completed Task**: T-036 (Stage: BUILD and FIX loop)
- **Next Eligible Task**: T-037 (Stage: TEST generation and REVIEW)
- **Branch**: `feat/refactor`
- **Total Test Suites**: 24 passed (264 tests)
- **Verification Status**: `npm run verify` passes cleanly (exit 0)

---

## 1. Progress Summary

| Phase | Tasks Completed | Status |
|---|---|---|
| Phase 0: Harness & Baseline | T-000, T-001, T-002, T-003, T-004 | 100% COMPLETE |
| Phase 1: Core Foundations | T-010, T-011, T-012, T-013, T-014, T-015, T-016, T-017 | 100% COMPLETE |
| Phase 2: Providers & AI Layer | T-020, T-021, T-022, T-023, T-024, T-025, T-026, T-027, T-028, T-029 | 100% COMPLETE |
| Phase 3: Agent Engine | T-030, T-031, T-032, T-033, T-034, T-035, T-036 | 70% COMPLETE (7/10) |
| Phase 4: Contracts | T-040 .. T-046 | Pending Phase 3 |
| Phase 5: Extension UI | T-050 .. T-054 | Pending Phase 4 |
| Phase 6: Web Explorer | T-060 .. T-069 | Pending Phase 5 |
| Phase 7: Docs & Release | T-070 .. T-073 | Final Phase |

---

## 2. Open Blockers

- **Active Blockers**: None.
- Note: Pre-existing uncommitted modifications found in `.gitignore` and `web-explorer/.gitignore` were stashed to `orphaned-2026-11-03` per Step 0 protocol.

---

## 3. Conventions Established

1. **Test Runner & Verification**:
   - `npm run verify` runs: `typecheck` (`tsc --noEmit`), `lint` (`eslint src --ext ts`), `check:boundaries`, `check:secrets`, and `test` (`vitest run`).
   - Vitest runs offline in <8s with 24 test files (264 tests), zero network and zero VS Code runtime mocks.

2. **Boundary Enforcement**:
   - `src/core`, `src/security`, `src/ai`, `src/agent` must never import `vscode`.
   - Enforced by ESLint `no-restricted-imports` and `scripts/check-boundaries.mjs`.

3. **Secret Hygiene**:
   - `scripts/check-secrets.mjs` scans tracked and staged files for 8 secret families (Gemini, Anthropic, OpenAI, GitHub, Bearer tokens, 64-byte keypairs, long base58 secrets, private keys).
   - Never prints secret contents; reports only file and line.

4. **Error Handling**:
   - `src/core/errors.ts`: Typed `SolanaPilotError` with exactly 15 failure categories.
   - `classify(unknown)` maps HTTP status codes (400, 401, 403, 429, 500, 503) and AbortError.
   - `userMessage` is safe to display to users and never contains raw cause text.

5. **Multi-Provider AI Layer**:
   - Normalized interfaces: `LlmClient`, `LlmRequest`, `LlmResult` in `src/ai/types.ts`.
   - `LlmGateway`: Timeout wrapper, retry backoff with jitter, fallback provider chain, pre-flight key checking.
   - Providers: `MockLlmClient` (offline deterministic), `GeminiClient` (`@google/genai`), `OpenAiCompatibleClient` (fetch), `AnthropicClient` (fetch), `OllamaClient` (fetch with loopback).
   - `generateStructured` (`src/ai/structured.ts`): Strips markdown fences/preambles, balanced JSON extraction, strict Zod validation, repair loop, and empty-content review flagging.

6. **Agent Loop & Tools**:
   - `ToolRegistry` (`src/agent/tools/`): Strict Zod inputs/outputs, side-effect declarations (`none`, `workspace-write`, `process`, `network`), size clamps (read $\le 200$ KB, list $\le 500$ entries, search $\le 50$ hits, write $\le 1$ MB), path guards (`resolveInWorkspace`), and allowlists (`run_check` allows only `anchor build`, `anchor test`, `cargo check`).
   - `injectionScreen` (`src/security/injectionScreen.ts`): Flags prompt injection patterns in tool outputs and wraps all tool observations in `<untrusted_tool_result>`.
   - `runAgentLoop` (`src/agent/loop.ts`): Perceive $\rightarrow$ Decide $\rightarrow$ Act $\rightarrow$ Observe loop with BudgetTracker integration, duplicate consecutive tool call detection, alternating oscillation detection ($A, B, A, B$), and guaranteed receipt return with 6 strict terminal states.
   - `PipelineStateMachine` (`src/agent/pipeline.ts`): Formal transition graph with bounded fix loop ($\le 3$) and full JSON serialization.
   - `SkillLoader` (`src/agent/skills/`): Progressive disclosure system reducing base prompt by $>80\%$ in tokens while maintaining immutable core security invariants.

7. **Pipeline Stages**:
   - `planStage` (`src/agent/stages/plan.ts`): Generates structured architecture plans (`programName`, `accounts`, `instructions`, `risks`, `needsHumanReview`).
   - `generateStage` (`src/agent/stages/generate.ts`): Generates Anchor program files with strict size limits (1MB per file, 5MB total payload) and enforces workspace path containment and overwrite confirmation guards.
   - `buildStage` (`src/agent/stages/build.ts`): Runs build check via `anchor build`, parses rustc/cargo/anchor compiler errors into a structured list, and extracts normalized error signatures.
   - `runBuildAndFixLoop` (`src/agent/stages/fix.ts`): Bounded fix loop (max 3 rounds) using surgical search-and-replace patches; adapts strategy prompt when error signature repeats; halts with `cycle_detected` receipt on 3rd repetition or `unrecoverable_tool_error` after 3 rounds.

---

## 4. Context for Next Tasks

- **T-037 (Stage: TEST generation and REVIEW)**:
  - Scope: `src/agent/stages/test.ts`, `review.ts`, tests
  - Needs: T-036
  - Generates Anchor TS tests covering happy + failure paths for each instruction. Runs `security-checklist` skill over generated Rust, returning findings `{severity, location, issue, suggestion}` where `high` severity blocks deploy until confirmed.
- **T-038 (Deploy runner refactor - devnet only)**:
  - Scope: `src/deploy/`, `src/terminalRunner.ts`
  - Needs: T-014
  - Devnet guard, balance check, pre-flight checks, execFile runner.
- **T-039 (Stage: REGISTER)**:
  - Scope: `src/agent/stages/register.ts`, `src/registryClient.ts`
  - Needs: T-038, T-016
