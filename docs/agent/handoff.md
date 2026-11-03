# SolanaPilot Refactor Handoff Snapshot

- **Date (UTC)**: 2026-11-03 09:07
- **Current Phase**: Phase 1 — Core foundations (no `vscode` imports)
- **Last Completed Task**: T-014 (Path guard)
- **Next Eligible Task**: T-015 (URL guard / SSRF)
- **Branch**: `feat/refactor`
- **Total Test Suites**: 6 passed (56 tests)
- **Verification Status**: `npm run verify` passes cleanly (exit 0)

---

## 1. Progress Summary

| Phase | Tasks Completed | Status |
|---|---|---|
| Phase 0: Harness & Baseline | T-000, T-001, T-002, T-003, T-004 | 100% COMPLETE |
| Phase 1: Core Foundations | T-010, T-011, T-012, T-013, T-014 | 50% COMPLETE (5/10) |
| Phase 2: Providers | T-020 .. T-029 | Ready after Phase 1 |
| Phase 3: Agent Engine | T-030 .. T-039 | Pending Phase 2 |
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
   - Vitest runs offline in <2s with zero network and zero VS Code runtime mocks.

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

5. **Security & Redaction**:
   - `src/security/redact.ts`: Deep-redacts strings, nested objects, and arrays.
   - WeakSet cycle detection prevents recursion overflows on self-referential structures.
   - Preserves Solana public keys / program IDs (32-44 base58 chars).

6. **Structured Logger**:
   - `src/core/logger.ts`: Emits `{ts, level, component, phase, spanId, parentSpanId, durationMs, category, message, data}`.
   - Automatic redaction applied on write before reaching any sink.
   - `verifySpans()` catches unfinished spans.

7. **Path Guard**:
   - `src/security/pathGuard.ts`: `resolveInWorkspace(root, candidate, mode, options)` ensures workspace containment, validates length, rejects null bytes, and blocks `.env*` (except `.env.example` read), `*keypair*.json`, `id.json`, `.git/`, `.ssh/`, and `node_modules/` writes.
   - Detects symlink escapes via injected `realpathSync`.

---

## 4. Context for Next Tasks

- **T-015 (URL guard)**: Implement SSRF protection (`assertSafeUrl`, `guardedFetch`) blocking loopback (except Ollama), private IPs, cloud metadata, and redirects.
- **T-016 (Shared validation schemas)**: Zod schemas for programName, pubkey, userPrompt, paths, URLs.
- **T-017 (Typed settings)**: Zod configuration schema.
