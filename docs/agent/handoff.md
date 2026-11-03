# SolanaPilot Refactor Handoff Snapshot

- **Date (UTC)**: 2026-11-03 10:16
- **Current Phase**: Phase 2 — Multi-provider AI toolkit
- **Last Completed Task**: T-026 (Structured output layer)
- **Next Eligible Task**: T-027 (Wire providers into the extension)
- **Branch**: `feat/refactor`
- **Total Test Suites**: 16 passed (160 tests)
- **Verification Status**: `npm run verify` passes cleanly (exit 0)

---

## 1. Progress Summary

| Phase | Tasks Completed | Status |
|---|---|---|
| Phase 0: Harness & Baseline | T-000, T-001, T-002, T-003, T-004 | 100% COMPLETE |
| Phase 1: Core Foundations | T-010, T-011, T-012, T-013, T-014, T-015, T-016, T-017 | 100% COMPLETE |
| Phase 2: Providers & AI Layer | T-020, T-021, T-022, T-023, T-024, T-025, T-026 | 70% COMPLETE (7/10) |
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
   - Vitest runs offline in <3s with 16 test files (160 tests), zero network and zero VS Code runtime mocks.

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

8. **URL Guard & SSRF Protection**:
   - `src/security/urlGuard.ts`: `assertSafeUrl` and `guardedFetch` block non-https, private/loopback/link-local ranges, cloud metadata addresses, hex/octal/decimal/IPv6-mapped encodings, and URL credentials.
   - Loopback allowed only for Ollama and local custom endpoints via `allowLoopback`. Redirect hops are re-validated.

9. **Shared Validation & Settings**:
   - `src/core/validation.ts`: Zod schemas for program names, 32-byte pubkeys, user prompts, paths, URLs, model names.
   - `src/core/config.ts`: Pure `loadConfig` validating configuration with typed `ConfigError`.

10. **Multi-Provider AI Layer**:
    - Normalized interfaces: `LlmClient`, `LlmRequest`, `LlmResult` in `src/ai/types.ts`.
    - `LlmGateway`: Timeout wrapper, retry backoff with jitter, fallback provider chain, pre-flight key checking.
    - `MockLlmClient` (`src/ai/providers/mock.ts`): Offline deterministic testing with FIFO response queue and error injection.
    - `GeminiClient` (`src/ai/providers/gemini.ts`): Using `@google/genai` with mapped errors and structured responses.
    - `OpenAiCompatibleClient` (`src/ai/providers/openaiCompatible.ts`): Fetch-based supporting `openai`, `openrouter`, and `custom` presets with SSRF enforcement.
    - `AnthropicClient` (`src/ai/providers/anthropic.ts`): Fetch-based Messages API with `x-api-key`, `anthropic-version: 2023-06-01`, and error mappings.
    - `OllamaClient` (`src/ai/providers/ollama.ts`): Fetch-based chat endpoint with loopback permission, 120s timeout, `listModels()`, `healthCheck()`, and JSON validity warnings.
    - `generateStructured` (`src/ai/structured.ts`): Strips markdown fences/preambles, balanced JSON extraction, strict Zod validation, 1-attempt repair loop, and empty-content review flagging.

---

## 4. Context for Next Tasks

- **T-027 (Wire providers into the extension)**:
  - Scope: `src/vscodeAdapters/`, `src/extension.ts`, `src/secretStorage.ts`, `package.json`
  - Needs: T-022, T-023, T-024, T-025, T-026
  - Wire providers into VS Code SecretStorage and extension configuration commands.
- **T-028 (Budget module)**:
  - Scope: `src/agent/budget.ts`, `src/agent/budget.test.ts`, `src/rateLimiter.ts`
  - Replaces 50/hr limiter with steps, tokens, wall-clock, and calls-per-hour budgets.
- **T-029 (Retire old aiClient.ts)**:
  - Scope: `src/aiClient.ts`, `src/programGenerator.ts`, `src/chatPanel.ts`
