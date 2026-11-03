# checkup.md — The Loop and the Completion Log

Two parts:
1. **Protocol** (human-owned — you may not edit it)
2. **Completion Log** (you append to it, one row per finished task, with the commit hash)

---

# Part 1 — Protocol

You do one task at a time, forever, until a stop condition is hit. This file is how you stay on track over a very long run. **Re-read `Agent.md` and this Protocol at the start of every iteration** — don't rely on what you remember.

## Iteration steps

### Step 0 — Orient (every iteration)
1. Read `Agent.md` (all of it) and this Protocol.
2. `git branch --show-current` must be `feat/refactor`. If not, switch to it. If it doesn't exist, only T-000 may create it.
3. `git status --porcelain`:
   - **Empty:** good, continue.
   - **Not empty:** a previous iteration was cut off. Look at the *Current Task* block below (Part 2). If a task is marked in progress, **resume that task** at the step it reached. If nothing explains the changes, run `git diff --stat`, decide whether they belong to the in-progress task; if they do not, `git stash push -m "orphaned-<date>"` (never delete), and write a blocker note about the stash.
4. Read the last 5 rows of the Completion Log and the open items in `BLOCKERS.md`.

### Step 1 — Select
- Open `taskslist.md`. Pick the **first** `[ ]` task whose `Needs:` are all `[x]`.
- Nothing eligible? Go to *Stop conditions*.
- Change its box to `[~]`. Fill in the **Current Task** block (Part 2): task ID, start time, attempt number `1`.

### Step 2 — Inspect
- Read every file in the task's Scope and the files they import. Read relevant existing tests.
- Run `npm run verify` (and the web-explorer one if that package is in scope). Record the starting result. **If verify fails before you changed anything,** the tree is broken: fix that first as part of this task only if it's in Scope; otherwise write a blocker.
- **Exploration cap:** at most 25 tool calls (reads/searches/commands) before you must write the Plan. If you hit the cap, write the plan with what you know and note unknowns; if the unknowns affect correctness, block.

### Step 3 — Plan
Write into the **Current Task** block (max 10 lines):
- What you will change, file by file
- What tests you will write first
- Which `Agent.md` rules are most relevant here
- Risks or unknowns

Then check the plan against `Agent.md` §3 (hard rules) and §7 (dependencies). If the plan violates a rule, log it to `docs/agent/rejections.md` and change the plan. If something is ambiguous or needs a human, **block** (see below) instead of guessing.

### Step 4 — Edit
- Tests first for logic (write the failing test, see it fail, then implement).
- Smallest change that satisfies **Done when**. No drive-by refactors, no bonus features.
- Keep commits focused: everything you change belongs to this task.

### Step 5 — Test
- Run `npm run verify` (+ web-explorer verify / `anchor build` / `anchor test` if in scope or if the task text says so).
- Run every task-specific check in **Done when**, including red-green checks.
- Copy the key result lines (pass counts, exit codes) for the log. Don't paste secrets or large output.

### Step 6 — Review
Read your own `git diff` top to bottom. Tick all of these (write "ok" or the problem):
- [ ] `git diff --name-only` ⊆ Scope
- [ ] No new dependency outside the allowlist; lockfile changed only if a dependency changed
- [ ] No secrets, keys, or personal paths (`npm run check:secrets` ok)
- [ ] No `any`, no `@ts-ignore`, no `eslint-disable`, no `.skip/.only`, no `console.log`
- [ ] Every new validation/security test was red-green checked
- [ ] No test only asserts what it mocked
- [ ] Docs, env tables, CHANGELOG updated if behavior changed
- [ ] Root cause or reasoning for non-trivial choices is stated for the commit body

Fix any problem found, then re-run Step 5.

### Step 7 — Commit (work commit)
```
git add <explicit paths only>
git commit -m "type(scope): summary [T-0xx]" -m "<root cause / why / verification lines / red-green checked>"
git rev-parse --short HEAD     # this is the hash you will log
```
Never `git add .`. Never push. Never amend after this point.

### Step 8 — Log (log commit)
1. In Part 2's **Completion Log**, add a row:
   `| T-0xx | <short title> | <hash> | <date UTC> | <verify result> | <attempts> | <notes> |`
2. In `taskslist.md`, change that task's box from `[~]` to `[x]`.
3. Clear the **Current Task** block.
4. Commit only those two files: `git add checkup.md taskslist.md && git commit -m "chore(log): T-0xx done"`
   (The hash can't be inside its own commit, which is why the log lives in a second small commit.)

### Step 9 — Checkpoints
- **Every 5 completed tasks:** run the *full audit*: `npm run verify` (root), `npm run verify` (`web-explorer`), `npm run check:secrets`, and `git log --stat -n 12` to confirm no unexpected files appear. Add a row `AUDIT` to the log with the result. Fix failures before continuing (that fix is its own commit tagged `fix(audit)`).
- **Every 10 completed tasks:** overwrite `docs/agent/handoff.md` with: current phase, last task, open blockers, any conventions you established, anything a fresh session must know. Commit as `docs(agent): handoff snapshot`. Then **re-read `Agent.md` start to finish** and continue.

### Step 10 — Loop
Go to Step 0.

---

## Failure handling (this is what keeps the run from spinning)

**Attempts.** An attempt = one full pass of Edit → Test → Review that ended in failure. Maximum **3 attempts per task**. Track the count in the Current Task block.

**Failure signature.** After each failed attempt write a one-line signature: the first error message with paths, numbers and hashes removed (e.g. `TS2345 argument of type X not assignable`).

- **Same signature twice in a row** → you are repeating yourself. Before attempt 3 you must change the approach: re-read the relevant docs/types/source, and write one sentence on *why the previous approach failed*.
- **Never** run the same failing command with the same inputs a third time without a change in between.
- **Never** "fix" by disabling checks, deleting tests, loosening types, or catching and ignoring the error.

**After attempt 3 fails → BLOCK:**
1. Restore the working tree **for the task's Scope only**: `git restore --staged --worktree -- <scope paths>` and remove only new untracked files you created in that Scope (`git clean -f -- <those files>`). Do not use `reset --hard`.
2. Append to `BLOCKERS.md`: task ID, the three attempts and their signatures, what you believe the cause is, what the human should check or decide, which later tasks depend on this one.
3. Change the task box to `[!]`.
4. Add a log row with status `BLOCKED` (no commit hash; put `—`). Commit `BLOCKERS.md`, `taskslist.md`, `checkup.md` as `chore(log): T-0xx blocked`.
5. Continue with the next eligible task. Tasks that depend on a blocked task are not eligible and must be skipped, not worked around.

**Immediate block** (don't spend attempts) when:
- the task needs a secret/account/service you don't have,
- the task needs a tool that isn't installed,
- the task text is ambiguous in a way that changes behavior,
- following the task would break a hard rule in `Agent.md`,
- the change would affect who can do what in the contract or move funds beyond what the task states.

## Stop conditions

Stop the run, write a final status message at the top of `docs/agent/handoff.md`, and wait for the human when **any** is true:
1. Every task is `[x]` or `[!]`, or the remaining `[ ]` tasks all depend on blocked tasks.
2. **Three tasks in a row** ended `[!]` (something systemic is wrong).
3. `npm run verify` fails on a clean tree and you cannot fix it within Scope after 3 attempts.
4. You were about to violate a hard rule and there is no compliant way forward.
5. You discover a committed secret (write a blocker with the file and line only; never print it).
6. The human's message says stop.

When you stop, do not delete anything, do not "tidy up", and leave the tree clean and committed.

## Status vocabulary in the Log
`DONE` · `BLOCKED` · `AUDIT` · `HANDOFF`

---

# Part 2 — State and Log (you edit this part)

## Current Task

*(empty — fill at Step 1, clear at Step 8)*

```
Task:
Started (UTC):
Attempt: 
Plan:
  -
Failure signatures so far:
  -
```

## Completion Log

| Task | Title | Commit hash | Date (UTC) | Verify result | Attempts | Status / Notes |
|---|---|---|---|---|---|---|
| T-000 | Branch and environment snapshot | 270d085 | 2026-11-03 08:05 | N/A (baseline) | 1 | DONE: feat/refactor created, toolchain versions recorded |
| T-001 | One verify command | 7673a07 | 2026-11-03 08:21 | verify PASS (5 scripts, 1 test) | 1 | DONE: vitest, prettier, verify command added and red-green checked |
| T-002 | Baseline report | 53a5a1d | 2026-11-03 08:27 | root: verify PASS, 5 warnings; web-explorer: lint 1 err, tsc 3 err | 1 | DONE: baseline captured in docs/agent/baseline.md |
| T-003 | Secret hygiene | 70997bf | 2026-11-03 08:34 | verify PASS (12 tests) | 1 | DONE: check-secrets scanner + tests + gitignores |
| T-004 | Boundary lint | 0fd8b56 | 2026-11-03 08:38 | verify PASS (12 tests) | 1 | DONE: boundary lint in ESLint and check-boundaries.mjs |
| AUDIT | Full checkpoint (tasks 0-4) | 0fd8b56 | 2026-11-03 08:40 | root: verify PASS, secrets PASS, log-stat verified; web: verify pending T-060 | 1 | PASS |
| T-010 | Create layout skeleton | 6b69d87 | 2026-11-03 08:44 | verify PASS (12 tests) | 1 | DONE: layout skeleton and ADR 0001 created |
| T-011 | Typed errors and failure categories | 8f7e43d | 2026-11-03 08:48 | verify PASS (21 tests) | 1 | DONE: 15 error categories + classify function |
| T-012 | Redaction | c776d9a | 2026-11-03 08:54 | verify PASS (36 tests) | 1 | DONE: deep redaction with cycle detection |
| T-013 | Structured logger and spans | 3dc6437 | 2026-11-03 08:59 | verify PASS (41 tests) | 1 | DONE: structured logger, span tracking, and redact-on-write |
| T-014 | Path guard | 487bc06 | 2026-11-03 09:05 | verify PASS (56 tests) | 1 | DONE: workspace path containment, deny list, symlinks |
| T-014-HANDOFF | Handoff snapshot (tasks 0-14) | cadd7ab | 2026-11-03 09:07 | docs/agent/handoff.md updated | 1 | HANDOFF |
| T-015 | URL guard (SSRF) | df30465 | 2026-11-03 09:14 | verify PASS (69 tests) | 1 | DONE: SSRF protection, numeric/hex/octal/IPv6-mapped IP checks, guardedFetch redirects |
| AUDIT | Full checkpoint (tasks 10-15) | df30465 | 2026-11-03 09:15 | root: verify PASS (69 tests), secrets PASS, log-stat verified | 1 | PASS |
| T-016 | Shared validation schemas | 987b26e | 2026-11-03 09:22 | verify PASS (91 tests) | 1 | DONE: zod schemas, boundary checks, base58 32-byte pubkey, prompt, path, url |
| T-017 | Typed settings | f6b02b2 | 2026-11-03 09:26 | verify PASS (99 tests) | 1 | DONE: zod config schema, defaults, loadConfig with typed ConfigError naming bad key |
| T-020 | LLM client interface and gateway | 46bbf12 | 2026-11-03 09:35 | verify PASS (107 tests) | 1 | DONE: LlmClient, LlmGateway, timeout, retry backoff, fallback chain, pre-flight key check |
| T-021 | Mock provider (offline lane) | ea2869a | 2026-11-03 09:39 | verify PASS (112 tests) | 1 | DONE: MockLlmClient with FIFO response queue, error injection, delay, call recording |
| T-022 | Gemini provider | 599e08b | 2026-11-03 09:50 | verify PASS (119 tests) | 1 | DONE: GeminiClient with @google/genai, mapped 401/429/503/timeout/empty/safety |
| T-023 | OpenAI-compatible provider | 9dc0397 | 2026-11-03 09:54 | verify PASS (130 tests) | 1 | DONE: OpenAiCompatibleClient, presets (openai, openrouter, custom), guardedFetch SSRF, key redaction |
| T-024 | Anthropic provider | 7c38dd9 | 2026-11-03 10:03 | verify PASS (142 tests) | 1 | DONE: AnthropicClient, Messages API, guardedFetch SSRF, refusal handling, error mapping, key redaction |
| AUDIT | Full checkpoint (tasks 16-24) | 7c38dd9 | 2026-11-03 10:05 | root: verify PASS (142 tests), secrets PASS, log-stat verified | 1 | PASS |
| T-025 | Ollama provider (local) | df84361 | 2026-11-03 10:10 | verify PASS (153 tests) | 1 | DONE: OllamaClient, loopback enforcement, listModels, healthCheck, 120s timeout, jsonMode warnings |
| T-026 | Structured output layer | fb82ed2 | 2026-11-03 10:15 | verify PASS (160 tests) | 1 | DONE: generateStructured, fence stripping, balanced JSON extraction, strict Zod validation, repair loop, empty content flag |
| T-026-HANDOFF | Handoff snapshot (tasks 0-26) | 2ad3ec2 | 2026-11-03 10:16 | docs/agent/handoff.md updated | 1 | HANDOFF |
| T-027 | Wire providers into extension | c63972e | 2026-11-03 10:23 | verify PASS (160 tests), esbuild PASS | 1 | DONE: SecretStorage per provider, commands (selectProviderAndModel, testConnection, setApiKey), status bar item, thin extension.ts |
| T-028 | Budget module | 9e14c88 | 2026-11-03 10:27 | verify PASS (166 tests) | 1 | DONE: BudgetTracker for steps, tokens, wallClock, callsPerHour, conservative estimation fallback |
| T-029 | Retire old aiClient.ts | 2d0fdca | 2026-11-03 10:38 | verify PASS (166 tests), esbuild PASS | 1 | DONE: removed @google/generative-ai, deleted rateLimiter.ts, routed legacy calls through LlmGateway |
| AUDIT | Full checkpoint (tasks 25-29) | 2d0fdca | 2026-11-03 10:41 | root: verify PASS (166 tests), secrets PASS, log-stat verified | 1 | PASS |
| T-030 | Tool registry | 1d9a124 | 2026-11-03 10:51 | verify PASS (200 tests) | 1 | DONE: tool registry, read_file, list_dir, search_text, write_file, run_check, fetch_docs, side-effect proof |
| T-031 | Injection screen | 3b094a9 | 2026-11-03 10:57 | verify PASS (219 tests) | 1 | DONE: injection screen, negative/positive fixtures, untrusted tool envelope |
