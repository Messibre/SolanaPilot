# taskslist.md — SolanaPilot Refactor

Status boxes: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (see `BLOCKERS.md`)

**Rules for picking work** (details in `checkup.md`):
- Take the **first** `[ ]` task whose `Needs:` tasks are all `[x]`. Never reorder.
- Only change the status box of the task you are working on.
- Stay inside the task's **Scope**. Everything in `Agent.md` applies to every task.
- `Lesson` = the lesson number in the AI Engineering roadmap that the task applies.

Common done-condition for every task (not repeated below): `npm run verify` passes, diff ⊆ Scope, docs updated if behavior changed, logged in `checkup.md`.

---

## Phase 0 — Harness and baseline

- [x] **T-000 · Branch and environment snapshot**
  - Scope: `docs/agent/env-snapshot.md`, `docs/agent/rejections.md`, `BLOCKERS.md`
  - Do: create/switch to branch `feat/refactor` from current HEAD. Record versions of `node`, `npm`, `git`, `rustc`, `solana`, `anchor` (version commands only). Create `docs/agent/rejections.md` and `BLOCKERS.md` with headers. 
  - Done when: `git branch --show-current` prints `feat/refactor`; snapshot file lists all versions (or "missing"); the two log files exist.
  - Lesson: 01

- [x] **T-001 · One `verify` command**
  - Needs: T-000
  - Scope: `package.json`, `package-lock.json`, `tsconfig.json`, `.eslintrc.json`, `vitest.config.ts`, `.prettierrc`, `.editorconfig`, `scripts/`, `src/**/*.test.ts` (one sample test only)
  - Do: add `vitest`, `prettier`. Scripts: `typecheck`, `lint`, `test` (vitest run), `check:boundaries` (placeholder that passes), `check:secrets` (placeholder that passes), and `verify` that runs all of them. Remove the broken `test` script that points to `out/test/runTest.js`. Add one trivial real test so the runner is proven (a test of a pure function, not `expect(true)`).
  - Done when: `npm run verify` exits 0 on a clean checkout; deleting the sample test's expected value makes it fail (red-green checked).
  - Lesson: 01

- [ ] **T-002 · Baseline report**
  - Needs: T-001
  - Scope: `docs/agent/baseline.md`
  - Do: run `npm run typecheck`, `npm run lint`, and the web-explorer's `npm run lint` and `npx tsc --noEmit` (no `build`/`dev`). Record every failure count and first 10 messages. Do not fix them here.
  - Done when: baseline file exists with commands and results for both packages.
  - Lesson: 01

- [ ] **T-003 · Secret hygiene**
  - Needs: T-001
  - Scope: `scripts/check-secrets.mjs`, `scripts/check-secrets.test.ts`, `.gitignore`, `web-explorer/.gitignore`, `package.json`
  - Do: real `check:secrets`: scans tracked + staged files for patterns (Gemini `AIza…`, `sk-…`, `sk-ant-…`, `ghp_…`, 64-number JSON arrays that look like keypairs, 80–90 char base58 strings assigned to `*key*`/`*secret*`, `Bearer …`, `-----BEGIN … PRIVATE KEY-----`). Allow `.env.example` placeholders. Ensure `.gitignore` covers `.env*` (except example), `*keypair*.json`, `id.json`, `target/`, `out/`, `*.vsix`, `.next/`, `coverage/`, `*.log`. Print only file and line, never the matched text.
  - Done when: tests prove it flags each pattern and ignores placeholders (red-green checked); `check:secrets` is part of `verify`; script output never contains the secret itself.
  - Lesson: 09

- [ ] **T-004 · Boundary lint**
  - Needs: T-001
  - Scope: `.eslintrc.json`, `scripts/check-boundaries.mjs`, `package.json`
  - Do: make `core/`, `security/`, `ai/`, `agent/` unable to import `vscode` (ESLint `no-restricted-imports` and/or the script). Add a failing fixture test that proves a violation is caught.
  - Done when: a deliberate import in a temp file fails `verify`, then is removed (red-green checked).
  - Lesson: 01

---

## Phase 1 — Core foundations (no `vscode` imports)

- [ ] **T-010 · Create layout skeleton**
  - Needs: T-004
  - Scope: new folders and `index.ts`/README-less empty modules only; `docs/adr/0001-layout.md`
  - Do: create the directories from `Agent.md` §6 with minimal exports. Write ADR 0001 (falsifiable: e.g. "reverse if more than 3 files need `vscode` inside `core/ai/agent/security`").
  - Done when: structure exists, compiles, ADR has a numeric reversal trigger.
  - Lesson: 10

- [ ] **T-011 · Typed errors and failure categories**
  - Needs: T-010
  - Scope: `src/core/errors.ts`, `src/core/errors.test.ts`
  - Do: error classes for every category in `Agent.md` §10 with `category`, `retryable`, `userMessage` (safe to show), and `cause` (never shown). A function `classify(unknown): SolanaPilotError` so nothing falls into an "unknown pile" without being `internal`.
  - Done when: tests cover every category, classification of plain `Error`, `AbortError`, HTTP status codes 400/401/403/429/500/503, and that `userMessage` never contains the cause text.
  - Lesson: 09

- [ ] **T-012 · Redaction**
  - Needs: T-011
  - Scope: `src/security/redact.ts`, `src/security/redact.test.ts`
  - Do: `redact(value: unknown): unknown` deep-redacts strings and object keys (api keys, tokens, bearer headers, keypair arrays, long base58 secrets, emails, URLs with credentials). Keep structure and enough shape to debug (e.g. `AIza…[redacted:gemini]`). Handle cycles.
  - Done when: tests for each secret family, nested objects, arrays, cyclic objects, **over-redaction** (public keys/program IDs are NOT redacted; ordinary words stay) and under-redaction (obfuscated variants like split across whitespace are documented as limits). Red-green checked.
  - Lesson: 09

- [ ] **T-013 · Structured logger and spans**
  - Needs: T-012
  - Scope: `src/core/logger.ts`, `src/core/logger.test.ts`
  - Do: event schema `{ts, level, component, phase, spanId, parentSpanId?, durationMs?, category?, message, data?}`; `startSpan/endSpan`; sink interface (VS Code Output channel and JSONL file sinks come later, here only memory + interface); redaction applied inside the logger before any sink; a `verifySpans()` that reports spans that never ended.
  - Done when: tests prove secrets never reach the sink, unfinished spans are reported, every error log carries a failure category.
  - Lesson: 09

- [ ] **T-014 · Path guard**
  - Needs: T-011
  - Scope: `src/security/pathGuard.ts`, `src/security/pathGuard.test.ts`
  - Do: `resolveInWorkspace(root, candidate, mode: 'read'|'write')` → absolute safe path or typed `tool_refused`. Deny list per `Agent.md` §10. Handle `..`, absolute paths, symlink escapes (injected `realpath`), Windows drive/case/`\`, null bytes, very long paths.
  - Done when: tests for each case on both POSIX-style and Windows-style inputs; red-green checked.
  - Lesson: 04

- [ ] **T-015 · URL guard (SSRF)**
  - Needs: T-011
  - Scope: `src/security/urlGuard.ts`, `src/security/urlGuard.test.ts`
  - Do: `assertSafeUrl(url, {allowedHosts, allowLoopback})` with injected DNS resolver; also `guardedFetch` wrapper that re-validates **every redirect hop** (manual redirect handling, max 3 hops). Block rules from `Agent.md` §10.
  - Done when: tests include `http://`, `file://`, `169.254.169.254`, `127.1`, `2130706433`, `0x7f000001`, `017700000001`, `[::1]`, `[::ffff:127.0.0.1]`, `user:pass@host`, a hostname resolving to a private IP, and a public URL that redirects to a private one. Red-green checked.
  - Lesson: 13

- [ ] **T-016 · Shared validation schemas**
  - Needs: T-011
  - Scope: `src/core/validation.ts`, `src/core/validation.test.ts`
  - Do: zod schemas + helpers: `programName` (snake_case, 3–32), `pubkey` (base58, decodes to 32 bytes), `userPrompt` (trimmed, 1–4000 chars, no null bytes), `relativeWorkspacePath`, `httpsUrl`, `providerId`, `modelName`. Export inferred types.
  - Done when: boundary tests (len-1, len, len+1), unicode, invalid base58, wrong byte length.
  - Lesson: 03

- [ ] **T-017 · Typed settings**
  - Needs: T-016
  - Scope: `src/core/config.ts`, `src/core/config.test.ts`
  - Do: zod schema for all settings (provider, model, fallbackOrder, timeouts, retries, budgets: maxSteps, maxTokens, maxWallClockSec; ollama baseUrl; custom endpoint + `isLocal`; autoContextRefresh; maxHistoryMessages) with defaults and a pure `loadConfig(raw)` that returns a typed config or a `config` error naming the bad key.
  - Done when: invalid values produce clear errors; defaults are tested.
  - Lesson: 02

---

## Phase 2 — Provider layer

- [ ] **T-020 · LLM client interface and gateway**
  - Needs: T-013, T-017
  - Scope: `src/ai/types.ts`, `src/ai/gateway.ts`, `src/ai/gateway.test.ts`
  - Do: `LlmClient { id; generate(req): Promise<LlmResult>; healthCheck(): Promise<void> }`, normalized request/response (messages, system, json mode flag, usage tokens). Gateway factory `createClient(config, secrets)`. Wrappers: timeout (`AbortController`), retry with backoff+jitter for retryable categories only, fallback chain (next provider on `provider_timeout`/`provider_rate_limited`/`provider_error`, never on `auth`/`config`), receipt of which provider answered. Missing key ⇒ `config` error **before** any network call.
  - Done when: fake-clock tests for timeout, 429→retry→success, 401 no retry, 400 no retry, fallback order, key never present in error text.
  - Lesson: 02

- [ ] **T-021 · Mock provider (offline lane)**
  - Needs: T-020
  - Scope: `src/ai/providers/mock.ts`, `src/ai/providers/mock.test.ts`
  - Do: scriptable provider (queue of responses/errors/delays) used by all later agent tests.
  - Done when: tests show scripted sequence, error injection, and call recording.
  - Lesson: 02

- [ ] **T-022 · Gemini provider**
  - Needs: T-021
  - Scope: `src/ai/providers/gemini.ts`, `src/ai/providers/gemini.test.ts`, `package.json`, `package-lock.json`
  - Do: implement with `@google/genai` (verify its current API from the installed package types). Remove `@google/generative-ai` only after T-029. Default model is a setting, not a constant. Map SDK errors → typed errors. Tests with an injected fake transport.
  - Done when: error-mapping tests (401, 429, 503, timeout, empty response, safety block) pass.
  - Lesson: 02

- [ ] **T-023 · OpenAI-compatible provider (OpenAI, OpenRouter, custom)**
  - Needs: T-021, T-015
  - Scope: `src/ai/providers/openaiCompatible.ts`, `…test.ts`
  - Do: `fetch`-based chat completions client parameterized by `baseUrl`, headers, and preset (`openai`, `openrouter`, `custom`). All calls go through `guardedFetch`. `custom` requires https unless `isLocal` is explicitly true. Map statuses/errors to typed errors. Never put the key in URLs.
  - Done when: tests for all three presets' URL/header building, status mapping, SSRF refusal of a private custom URL when `isLocal` is false, and key redaction.
  - Lesson: 02, 13

- [ ] **T-024 · Anthropic provider**
  - Needs: T-021, T-015
  - Scope: `src/ai/providers/anthropic.ts`, `…test.ts`
  - Do: `fetch` client for the Messages API (verify current header names/versions in official docs before coding). Same guarantees as T-023.
  - Done when: same test matrix as T-023.
  - Lesson: 02

- [ ] **T-025 · Ollama provider (local)**
  - Needs: T-021, T-015
  - Scope: `src/ai/providers/ollama.ts`, `…test.ts`
  - Do: `fetch` client for Ollama's chat endpoint, default `http://127.0.0.1:11434`, loopback allowed **only here**. `listModels()` and `healthCheck()` (clear message if Ollama isn't running or the model isn't pulled). Longer default timeout (local models are slow). Warn in result metadata when model output isn't valid JSON so structured layer can adapt.
  - Done when: tests: not running (ECONNREFUSED) → `config`-style friendly error, model missing, timeout, non-loopback URL refused unless user flagged local.
  - Lesson: 02

- [ ] **T-026 · Structured output layer**
  - Needs: T-016, T-021
  - Scope: `src/ai/structured.ts`, `src/ai/structured.test.ts`
  - Do: `generateStructured(client, schema, request, {maxRepairs: 1})`. Pipeline: strip markdown fences and chatty pre/post text → extract JSON → `schema.strict().safeParse` → on failure send **one** repair prompt containing the validation error → on second failure return a typed `schema_violation` refusal. Every schema includes `needsHumanReview: boolean` and `uncertainty?: string`.
  - Done when: tests: preamble/postamble, truncated JSON, extra keys, number out of range, repair success, repair exhausted (exactly 2 provider calls, not more), schema-valid-but-empty content flagged as `needsHumanReview`.
  - Lesson: 03

- [ ] **T-027 · Wire providers into the extension (VS Code adapters)**
  - Needs: T-022, T-023, T-024, T-025, T-026
  - Scope: `src/vscodeAdapters/`, `src/extension.ts`, `src/secretStorage.ts`, `package.json` (commands + settings contributions)
  - Do: per-provider keys in `SecretStorage`; commands `SolanaPilot: Set API Key`, `Select Provider and Model`, `Test Connection`; status bar item shows `provider · model`; settings for fallback order, timeouts, Ollama URL, custom endpoint. Validation on key input is per provider (don't require `AIza` for non-Gemini).
  - Done when: `verify` passes; adapter code has no business logic (it only calls core/ai); manual-run notes in the commit body list what a human should click to test.
  - Lesson: 02

- [ ] **T-028 · Budget module replaces the 50/hr limiter**
  - Needs: T-017
  - Scope: `src/agent/budget.ts`, `src/agent/budget.test.ts`, `src/rateLimiter.ts` (delete after migration)
  - Do: budgets for steps, tokens, wall-clock, and optional calls-per-hour; checked independently of anything the model says. Provides `remaining()` and typed `budget_exhausted`.
  - Done when: tests: each budget trips alone; tokens counted from provider usage, with a conservative estimate fallback if a provider returns none.
  - Lesson: 05

- [ ] **T-029 · Retire the old `aiClient.ts`**
  - Needs: T-027, T-028
  - Scope: `src/aiClient.ts`, `src/programGenerator.ts`, `src/chatPanel.ts` (call-site changes only), `package.json`
  - Do: route all existing AI calls through the gateway; remove `@google/generative-ai`; delete `aiClient.ts` and `rateLimiter.ts`.
  - Done when: no imports of removed modules; `verify` passes; old behavior still reachable through the new gateway.
  - Lesson: 02

---

## Phase 3 — Agent engine (no `vscode` imports)

- [ ] **T-030 · Tool registry**
  - Needs: T-014, T-016, T-021
  - Scope: `src/agent/tools/`
  - Do: registry where each tool declares `name`, `description`, zod `input`, `output`, `sideEffects: 'none'|'workspace-write'|'process'|'network'`. Tools: `read_file`, `list_dir`, `search_text` (read-only), `write_file` (staged, path-guarded), `run_check` (fixed allowlist of commands with argument arrays: anchor build, anchor test, cargo check), `fetch_docs` (https, domain allowlist: `solana.com`, `anchor-lang.com`, `docs.rs`, `github.com` raw docs only). Clamp sizes (read ≤ 200 KB, list ≤ 500 entries, search ≤ 50 hits). Invalid args ⇒ typed refusal that lists valid alternatives.
  - Done when: each tool has tests for oversized args, traversal, unknown params, and proof that read-only tools cannot mutate (side-effect test using a fake fs that throws on write).
  - Lesson: 04

- [ ] **T-031 · Injection screen**
  - Needs: T-030
  - Scope: `src/security/injectionScreen.ts`, `…test.ts`, `src/agent/tools/wrap.ts`
  - Do: detect common injection patterns in tool output (ignore/override instructions, "system prompt", role impersonation, instructions to run commands/exfiltrate); wrap every tool result in a delimited "untrusted data" envelope; flagged results carry a warning flag the loop logs.
  - Done when: positive and negative fixtures (normal Rust/TS docs must not be flagged), red-green checked.
  - Lesson: 04

- [ ] **T-032 · Agent loop orchestrator**
  - Needs: T-028, T-030, T-031, T-026
  - Scope: `src/agent/loop.ts`, `src/agent/receipts.ts`, `src/agent/loop.test.ts`
  - Do: Perceive → Decide → Act → Observe loop. Hard limits from budget module. **Duplicate-call detection** (same tool + same normalized args on consecutive steps) and **oscillation detection** (A,B,A,B). Tool crashes become structured observations, not exceptions. Exactly one terminal state: `success | budget_exhausted | cycle_detected | unrecoverable_tool_error | refused | cancelled`. Always returns a receipt: steps, tool names, durations, tokens, final status, reason.
  - Done when: scripted-provider tests for each terminal state; no code path exits without a receipt (test with fault injection); the model saying "done" without meeting a success condition does not end the loop.
  - Lesson: 05

- [ ] **T-033 · Pipeline state graph**
  - Needs: T-032
  - Scope: `src/agent/pipeline.ts`, `src/agent/pipeline.test.ts`, `docs/AGENT_PIPELINE.md`
  - Do: explicit transition table: `PLAN → GENERATE → VALIDATE → WRITE → BUILD → (FIX ⟲ max 3) → TEST → REVIEW → AWAIT_DEPLOY_CONFIRM → DEPLOY → REGISTER → DONE`, with `FAILED` and `CANCELLED` reachable from any state. Illegal transition throws a typed error. Pipeline state is serializable so a run can be resumed or displayed.
  - Done when: tests enumerate all legal transitions and assert every other pair is rejected; every state has a declared way to reach a terminal state; doc includes the diagram (mermaid).
  - Lesson: 08

- [ ] **T-034 · Skills (progressive disclosure)**
  - Needs: T-010
  - Scope: `src/agent/skills/`, `src/ai/prompts/base.ts`, `src/systemPrompt.ts` (to be split, then removed), `docs/adr/0002-skills.md`
  - Do: split the 300-line monolithic prompt into a short base prompt + skill files (`anchor-core`, `pda`, `spl-token`, `token-2022`, `cpi`, `security-checklist`, `frontend-wallet`, `testing`). Each skill file: trigger keywords, workflow, expected output schema, failure rules, security boundary. Loader presents one-line summaries first; full text injected only when triggered by the request or by a stage.
  - Done when: tests show (a) a token request loads `spl-token` and not `pda`-only content, (b) base prompt token estimate is at least 60% smaller than the old prompt, (c) skills can't override safety rules in the base. ADR has a numeric reversal trigger.
  - Lesson: 10

- [ ] **T-035 · Stage: PLAN and GENERATE**
  - Needs: T-033, T-034
  - Scope: `src/agent/stages/plan.ts`, `generate.ts`, tests
  - Do: PLAN returns a structured plan (program name, accounts, instructions, risks, needsHumanReview). GENERATE returns the files (strict schema; paths guarded; size caps; no overwriting existing files without confirmation flag). Reuse the validations from the old `programGenerator.ts`.
  - Done when: tests with scripted provider for good output, malformed output, path-traversal file names, oversized files.
  - Lesson: 03, 08

- [ ] **T-036 · Stage: BUILD and FIX loop**
  - Needs: T-035, T-030
  - Scope: `src/agent/stages/build.ts`, `fix.ts`, tests
  - Do: run build via `run_check`; parse compiler errors into a compact structured list; FIX asks the model for a **patch** (structured: file, search, replace) — not a full rewrite; apply; rebuild. Max 3 fix rounds; same error signature twice ⇒ change strategy prompt; third ⇒ stop with receipt.
  - Done when: tests with scripted failing/passing builds including a stuck-on-same-error case that stops at the cap.
  - Lesson: 05

- [ ] **T-037 · Stage: TEST generation and REVIEW**
  - Needs: T-036
  - Scope: `src/agent/stages/test.ts`, `review.ts`, tests
  - Do: TEST generates Anchor TS tests covering happy + failure paths for each instruction. REVIEW runs the `security-checklist` skill over generated Rust, returns findings `{severity, location, issue, suggestion}`; `high` severity blocks DEPLOY until the user confirms.
  - Done when: tests with fixture programs containing a known issue (missing signer check, unchecked math) show it is reported; clean fixture reports none.
  - Lesson: 03, 04

- [ ] **T-038 · Deploy runner refactor (devnet only)**
  - Needs: T-014
  - Scope: `src/deploy/`, `src/terminalRunner.ts` (migrate then delete)
  - Do: replace shell-string commands with `execFile`/`spawn` args arrays; preserve the Windows handling; add devnet guard (`solana config get` must show devnet/localhost), balance check, airdrop with bounded retry, structured result `{ok, step, programId?, signature?, error?}`, streaming output through the redacting logger. Mainnet URLs refused in code.
  - Done when: tests with a fake process runner: devnet ok, mainnet refused, airdrop fail path, build fail path, Windows path with spaces.
  - Lesson: 04, 14

- [ ] **T-039 · Stage: DEPLOY, REGISTER, wiring, and resume**
  - Needs: T-037, T-038
  - Scope: `src/agent/stages/deploy.ts`, `register.ts`, `src/registry/`, `src/programGenerator.ts` (migrate then delete), `src/frontendGenerator.ts` (adapt to gateway + structured output)
  - Do: DEPLOY waits at `AWAIT_DEPLOY_CONFIRM` (an injected `confirm()` callback); REGISTER uses the registry client with validated inputs. The existing frontend generator becomes a pipeline stage that uses structured output.
  - Done when: end-to-end pipeline test with scripted provider and fake runner reaches `DONE` and also reaches `FAILED` cleanly at each stage when that stage is made to fail.
  - Lesson: 05, 08

---

## Phase 4 — Contracts

- [ ] **T-040 · Contract baseline**
  - Needs: T-000
  - Scope: `docs/agent/contracts-baseline.md`
  - Do: run `anchor build` on the unchanged program and record result and warnings. If it fails because of the toolchain, write a blocker with the exact error.
  - Done when: baseline recorded.
  - Lesson: 14

- [ ] **T-041 · Anchor upgrade**
  - Needs: T-040
  - Scope: `programs/registry/Cargo.toml`, `programs/registry/Cargo.lock`, `Anchor.toml`, `package.json`, `package-lock.json`, `programs/registry/src/**`
  - Do: `anchor --version` must be **0.31 or newer**; if it is older, write a blocker (the human upgrades with `avm`, see `setup.md`) — do **not** install it yourself. Align Rust crate versions, the TS client package (check npm for the right name for this Anchor version), and fix breaking changes. Keep behavior identical in this task.
  - Done when: `anchor build` succeeds with the new version; IDL regenerated; the explorer's IDL copy is untouched until T-046.
  - Lesson: 14

- [ ] **T-042 · Harden the registry program**
  - Needs: T-041
  - Scope: `programs/registry/src/**`
  - Do: apply `Agent.md` §12 — checked math, named errors for every `require!`, `InitSpace` or one source of truth for sizes, length constants, signer/`has_one` on every mutation, safe close, documented seeds, events for state changes. **No new features.** Write the account/instruction table to `docs/CONTRACT.md`.
  - Done when: `anchor build` succeeds; the diff contains no new instruction; `docs/CONTRACT.md` lists every instruction with who may call it and what it validates.
  - Lesson: 04

- [ ] **T-043 · Anchor tests**
  - Needs: T-042
  - Scope: `tests/`, `package.json`, `Anchor.toml`
  - Do: tests for each instruction: happy path; wrong signer; string length max and max+1; duplicate registration; update by non-authority; close refunds rent to authority; closing twice fails.
  - Done when: `anchor test` passes; at least one test per error code in the program; red-green check on two of them.
  - Lesson: 04

- [ ] **T-044 · New program ID**
  - Needs: T-043
  - Scope: `programs/registry/src/lib.rs` (`declare_id!`), `Anchor.toml`, `idl/`, `src/registry/`, `docs/`, `README.md`, `REGISTRY_DEPLOYMENT.md`
  - Do: generate a new keypair **into the git-ignored** `target/deploy/` path (use the Anchor/Solana tooling; never print it), read only the public key, update every occurrence of the old ID `Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs` (grep the whole repo, excluding `web-explorer` which is T-046).
  - Done when: `grep -r` for the old ID returns nothing outside `web-explorer/`; `anchor build` passes; `check:secrets` passes; the keypair file is untracked and ignored.
  - Lesson: 01

- [ ] **T-045 · Devnet deployment**
  - Needs: T-044
  - Scope: `docs/deployments.md`
  - Do: follow `Agent.md` §12: confirm devnet, balance/airdrop, `anchor build`, `anchor test`, `anchor deploy`, then `solana program show <id>`. Record program ID, slot, signature, date.
  - Done when: `solana program show` output confirms the program is deployed at the new ID; record saved. If devnet airdrop is rate-limited after 3 bounded retries, write a blocker with the wallet's **public** address.
  - Lesson: 14

- [ ] **T-046 · Update consumers of the program**
  - Needs: T-045
  - Scope: `idl/`, `web-explorer/lib/idl.json`, `web-explorer/lib/solana.ts`, `.github/workflows/deploy-registry.yml`, `ci/`
  - Do: copy the fresh IDL, update the program ID everywhere in the explorer and CI. CI must reference secrets by name only.
  - Done when: grep for the old ID returns nothing anywhere in the repo; `web-explorer` typechecks.
  - Lesson: 14

---

## Phase 5 — Extension chat panel and packaging

- [ ] **T-050 · Split `chatPanel.ts`**
  - Needs: T-039
  - Scope: `src/chat/`, `src/chatPanel.ts` (delete after), `src/sidebarProvider.ts`
  - Do: separate lifecycle (`ChatPanel`), message protocol (zod discriminated union), handlers (one file per message type), history store (bounded by `maxHistoryMessages`), and context builder use. No file > 300 lines. Behavior identical.
  - Done when: old file gone; protocol parse tests (valid, unknown type, extra keys, oversized text); `verify` passes.
  - Lesson: 08

- [ ] **T-051 · Webview rebuild (secure + themed)**
  - Needs: T-050, T-034
  - Scope: `media/`, `src/chat/html.ts`, `src/webview/` (delete after)
  - Do: move the 1,300-line `chat.html` into `media/chat.css` + `media/chat.js` (no inline script/handlers), CSP with nonce, `localResourceRoots`. Apply the design tokens from `Agent.md` §14 on top of `--vscode-*` variables so it follows dark/light. UI: provider/model selector, a **pipeline progress view** (stage list with state, current step, budget meter), plan preview with approve/cancel, build/fix log, review findings, receipt summary, friendly error with its category. Accessible: labels, focus-visible, keyboard send, `aria-live` for progress.
  - Done when: HTML builder test asserts nonce present, no inline handlers, no remote URLs; protocol tests still pass; contrast test for webview tokens in both themes.
  - Lesson: 04, 09

- [ ] **T-052 · Telemetry sinks and commands**
  - Needs: T-051, T-013
  - Scope: `src/vscodeAdapters/`, `package.json`
  - Do: Output-channel sink and a local JSONL file sink in extension storage (redacted, size-capped with rotation); `SolanaPilot: Show Logs`, `Export Run Receipt`. **No remote telemetry.**
  - Done when: test proves rotation and that a fake secret in a logged object never lands in the file.
  - Lesson: 09

- [ ] **T-053 · Manifest, commands and metadata**
  - Needs: T-052
  - Scope: `package.json`, `.vscodeignore`, `CHANGELOG.md`, `README.md` (Marketplace section only)
  - Do: name `solanapilot`, displayName `SolanaPilot`, consistent command IDs `solanaPilot.*` (config namespace already uses it), remove redundant `onCommand` activation events and the eager startup activation unless justified, set a **placeholder** publisher `solanapilot-dev` (note in `setup.md` it must be replaced), repository/bugs URLs left as `https://github.com/Messibre/SolanaPilot`, fix keybindings that clash with VS Code defaults (`Ctrl+Shift+S` is Save As, `Ctrl+Shift+G` is Source Control) — pick non-conflicting chords, add categories/keywords, mark breaking renames in CHANGELOG.
  - Done when: `npx @vscode/vsce ls` (or `package --no-dependencies` dry listing) shows no source maps, tests, `web-explorer/`, `target/`, or secrets in the package.
  - Lesson: 14

- [ ] **T-054 · Prerequisite checks and first-run**
  - Needs: T-053
  - Scope: `src/vscodeAdapters/`, `src/extension.ts`
  - Do: show missing-tool notices once per session (not every activation); "first run" flow that checks provider config and offers Ollama if no key is set. Detect `solana`/`anchor` versions and warn if Anchor < 0.31.
  - Done when: unit tests for the version parsing/decision logic in `core/`.
  - Lesson: 02

---

## Phase 6 — Web explorer

- [ ] **T-060 · Explorer cleanup and env validation**
  - Needs: T-046
  - Scope: `web-explorer/package.json`, `web-explorer/package-lock.json`, `web-explorer/lib/env.ts`, `web-explorer/lib/env.test.ts`, `web-explorer/.env.example`, `web-explorer/README.md`
  - Do: rename package to `solanapilot-explorer`; add `verify` script (typecheck, lint, test); add vitest; zod env schema (server vs public vars, fails fast with a clear message listing missing names only); remove unused `components/ui/*` and dependencies **after proving non-use by grep** (list them in the commit body). Make mock data an explicit, visibly-labeled demo mode instead of a silent fallback.
  - Done when: `web-explorer: npm run verify` passes; env tests cover missing/invalid; UI shows a "demo data" banner whenever mock data is used.
  - Lesson: 14

- [ ] **T-061 · Design tokens and theming**
  - Needs: T-060
  - Scope: `web-explorer/styles/tokens.css`, `web-explorer/app/globals.css`, `web-explorer/app/layout.tsx`, `web-explorer/components/theme-provider.tsx`, `web-explorer/components/theme-toggle.tsx`, `web-explorer/lib/contrast.test.ts`, `docs/DESIGN.md`
  - Do: implement the `Agent.md` §14 token table as CSS variables for dark, light and system; no-flash theme init; fonts via `next/font`; spacing/radius/type scale variables; remove duplicate `styles/globals.css`. `docs/DESIGN.md` documents tokens and the do/don't list.
  - Done when: contrast test computes ratios for every text/background pair in both themes and asserts AA; toggle persists; no hardcoded hex colors remain in components (grep check recorded in commit body).
  - Lesson: 01

- [ ] **T-062 · Restyle registry UI**
  - Needs: T-061
  - Scope: `web-explorer/components/registry/**`, `web-explorer/app/page.tsx`, `web-explorer/app/programs/page.tsx`, `web-explorer/app/activity/page.tsx`, `web-explorer/app/not-found.tsx`, `web-explorer/app/error.tsx`
  - Do: apply the design system: generous whitespace; programs shown as a dense, readable table/list with mono addresses and copy buttons rather than a grid of identical cards; header with theme toggle and sign-in slot; honest empty/error/loading states; accent only on buttons/icons/focus; copy written for developers. Follow the "Do NOT" list.
  - Done when: every component has all states from `Agent.md` §14; keyboard navigation works (documented in commit); `npm run verify` passes; no gradient text/glow/glass present (grep for `blur(`, `bg-gradient`, `text-transparent` returns nothing).
  - Lesson: 01

- [ ] **T-063 · Database schema**
  - Needs: T-060
  - Scope: `web-explorer/prisma/schema.prisma`, `web-explorer/lib/db.ts`, `web-explorer/.env.example`, `web-explorer/package.json`
  - Do: Prisma + Postgres. Models: `User`, `Identity` (provider `github|solana`, providerAccountId unique per provider, userId), `WalletNonce` (nonce, expiresAt, usedAt, unique). Singleton client. Migrations committed. Do not run against any remote DB; migration generation only needs `DATABASE_URL` from the human's `.env.local` (if missing → blocker).
  - Done when: `prisma validate` and `prisma generate` succeed; schema has the unique indexes above.
  - Lesson: 11

- [ ] **T-064 · Auth.js with GitHub**
  - Needs: T-063
  - Scope: `web-explorer/auth.ts`, `web-explorer/app/api/auth/[...nextauth]/route.ts`, `web-explorer/lib/env.ts`
  - Do: Auth.js v5, JWT sessions, GitHub provider (env `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`). On sign-in, upsert `User` + `Identity`. Session carries only `userId` and linked provider names.
  - Done when: unit tests of the sign-in callback logic with a fake DB; ADR `0003-auth-strategy.md` with numeric reversal trigger.
  - Lesson: 11

- [ ] **T-065 · Sign-In With Solana**
  - Needs: T-064
  - Scope: `web-explorer/lib/siws/`, `web-explorer/app/api/auth/nonce/route.ts`, Credentials provider addition in `web-explorer/auth.ts`, `web-explorer/components/auth/`
  - Do: `GET /api/auth/nonce` issues a random single-use nonce (5-minute expiry, stored). Client builds the sign-in message (domain, URI, nonce, issuedAt, expirationTime, statement), wallet signs; server verifies domain/URI match, nonce unused and unexpired, ed25519 signature (`tweetnacl`), then marks nonce used **atomically**. Wallet connect UI via wallet-standard/adapter (Phantom, Solflare, Backpack). Rate-limit the routes.
  - Done when: tests: valid; replayed nonce; expired; wrong domain; wrong signature; malformed base58; tampered message; concurrent double-use (exactly one succeeds). Red-green checked.
  - Lesson: 04, 11

- [ ] **T-066 · Account linking**
  - Needs: T-065
  - Scope: `web-explorer/lib/accounts/`, `web-explorer/app/api/account/**`, `web-explorer/app/profile/**`
  - Do: a signed-in user can link the other provider (wallet↔GitHub) after re-proving ownership; unlinking is refused if it would leave zero identities; an identity already linked to another user is refused with a clear error.
  - Done when: tests for each rule using a fake DB.
  - Lesson: 11

- [ ] **T-067 · Route protection and security headers**
  - Needs: T-066
  - Scope: `web-explorer/middleware.ts`, `web-explorer/next.config.mjs`, `web-explorer/lib/http/`
  - Do: protect `/profile` and `/api/account/*`; security headers (CSP with nonce where feasible, `frame-ancestors 'none'`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`); shared `apiHandler` wrapper that zod-validates input and returns uniform errors with correct status codes (400/401/403/404/429/500); in-memory rate limiter interface (swappable).
  - Done when: tests: unauthenticated → 401/redirect, malformed body → 400 (never 200), oversized body → 413, rate limit → 429.
  - Lesson: 14

- [ ] **T-068 · Explorer data layer**
  - Needs: T-046, T-067
  - Scope: `web-explorer/lib/solana.ts`, `web-explorer/app/api/programs/route.ts`, `web-explorer/lib/registry/**`
  - Do: move chain reads behind a server route so the RPC key stays server-side (`SOLANA_RPC_URL`; `NEXT_PUBLIC_SOLANA_RPC_URL` only as optional public fallback); zod query params with clamps (page size ≤ 50, bounded offset); cache with TTL; `/profile` lists programs whose authority equals the user's linked wallet.
  - Done when: tests for clamping, bad pubkeys, cache expiry (fake clock), and the "my programs" filter.
  - Lesson: 04

- [ ] **T-069 · Health, readiness and smoke script**
  - Needs: T-068
  - Scope: `web-explorer/app/api/health/route.ts`, `web-explorer/app/api/ready/route.ts`, `web-explorer/scripts/smoke.mjs`, `docs/release/rollback.md`
  - Do: `/api/health` (process up) and `/api/ready` (env valid, DB reachable, RPC reachable; 503 otherwise). `smoke.mjs` hits a running server (URL argument) and checks: health 200, ready status, malformed POST to an API route → 4xx **not 200**, oversized body rejected, cold-start latency recorded. `rollback.md` states **numeric** rollback triggers (e.g. "error rate > 2% over 5 min", "ready failing > 3 consecutive checks").
  - Done when: the script runs against a locally started `next start` (agent may start it with `next build` + `next start` for this task only, then stop it) and exits 0; deliberately failing a check makes it exit non-zero.
  - Lesson: 14

---

## Phase 7 — Docs, release prep, final audit

- [ ] **T-070 · Docs rewrite**
  - Needs: T-069, T-054
  - Scope: `README.md`, `docs/ARCHITECTURE.md`, `docs/PROVIDERS.md`, `docs/SECURITY.md`, `docs/AGENT_PIPELINE.md`, `REGISTRY_DEPLOYMENT.md`, `web-explorer/README.md`, `CHANGELOG.md`
  - Do: README for hackathon builders (what it does, 5-minute quick start, provider options incl. Ollama, safety notes, link to docs). Architecture with mermaid diagrams. Providers doc (how to add one). Security doc (threat model: prompt injection, SSRF, secret leakage, malicious generated code, auth abuse). Fix the dangling `SETUP_DEPLOYMENT_ENV.md` reference. CHANGELOG `2.0.0` with all breaking changes.
  - Done when: every command and env var in docs exists in the repo (agent verifies by grep, list in commit body); no dead links.
  - Lesson: 10

- [ ] **T-071 · ADR set**
  - Needs: T-070
  - Scope: `docs/adr/`
  - Do: ensure ADRs exist for layout, skills, auth strategy, provider adapter (why no SDKs for 3 providers), pipeline as explicit state graph (why no agent framework), logging approach. Each has Context, Decision, Alternatives, Consequences, and a **numeric** "Reverse this decision if".
  - Done when: a check script (`scripts/check-adrs.mjs`, added to `verify`) fails on any ADR lacking a numeric reversal trigger.
  - Lesson: 10

- [ ] **T-072 · Package the extension**
  - Needs: T-071
  - Scope: `docs/release/vsix-report.md`
  - Do: `npx @vscode/vsce package --no-dependencies` (esbuild bundles) → `.vsix` in the repo root (git-ignored). Record file size, file list, and confirm: no secrets, no `.map`, no tests, no `web-explorer`, icon present. **Do not publish.**
  - Done when: report saved; `.vsix` exists and is ignored by git; package size noted.
  - Lesson: 14

- [ ] **T-073 · Production-readiness audit**
  - Needs: T-072
  - Scope: `docs/READINESS.md`
  - Do: table of the 14 areas → the file/test/ADR that proves each, or an honest "gap" with a proposed task. Run full `verify` on root and `web-explorer`, `anchor test`, secrets scan. Summarize `docs/agent/rejections.md` patterns and every item in `BLOCKERS.md`.
  - Done when: audit file complete; all gaps are listed, none hidden.
  - Lesson: all

---

### Task proposals from the agent

(Append new proposals here as `- P-001: …`. Do not start them; the human decides.)
