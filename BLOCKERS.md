# BLOCKERS.md

Active and historical blockers encountered during task execution.

## Format
- **Task ID**: T-0xx
- **Attempt**: Number / Immediate
- **Tried**: What was attempted
- **Error / Ambiguity**: Exact redacted error message or ambiguity
- **Needed from Human**: Clear action or decision requested
- **Affected Tasks**: Later tasks blocked or impacted

---

## Log

### Note: Orphaned changes stashed on Step 0 (2026-11-03)
- **Context**: Prior uncommitted modifications found in `.gitignore` and `web-explorer/.gitignore` (including ignoring `checkup.md`, `taskslist.md`, `setup.md`, and `.vercel`).
- **Action**: Per Step 0 of Protocol, stashed to `orphaned-2026-11-03` to keep clean working tree on `feat/refactor`.

### T-040: Toolchain failure on `anchor build` baseline
- **Task ID**: T-040
- **Attempt**: 1
- **Tried**: Executed `anchor build` on the unchanged `programs/registry` program.
- **Error / Ambiguity**:
  ```
  error: failed to download `toml_datetime v1.1.1+spec-1.1.0`
  Caused by: feature `edition2024` is required
  The package requires the Cargo feature called `edition2024`, but that feature is not stabilized in this version of Cargo (1.75.0 (827d7a4d2 2024-02-16)).
  ```
  Additionally, `anchor-cli` version is currently `0.30.0` (T-041 requires `>= 0.31`).
- **Needed from Human**:
  - Upgrade Anchor CLI to `>= 0.31` using `avm` (`avm use 0.31.0` or newer) per `setup.md`.
  - Upgrade Solana CLI if needed (`agave-install` or `solana-install init 2.0+` supporting Cargo edition2024).
- **Affected Tasks**: T-041, T-042, T-043, T-044, T-045, T-046.

### T-041: Anchor CLI version is below requirement (RESOLVED)
- **Status**: Resolved. Human upgraded `anchor-cli` to 0.31.0 via `avm`. Task T-041 completed.

### T-050: Rule 7 Scope restriction on deleting `src/chatPanel.ts` (RESOLVED)
- **Status**: Resolved. Human added `src/extension.ts` to T-050 Scope in `taskslist.md`.

### T-042: Rule 7 Scope restriction on creating `docs/CONTRACT.md`
- **Task ID**: T-042
- **Attempt**: Immediate (Rule 7)
- **Tried**: Inspected T-042 requirements: "Do: ... Write the account/instruction table to docs/CONTRACT.md" and "Done when: ... docs/CONTRACT.md lists every instruction with who may call it and what it validates."
- **Error / Ambiguity**:
  - `docs/CONTRACT.md` is required by the task Do and Done When conditions.
  - However, the task Scope is declared strictly as `Scope: programs/registry/src/**`.
  - Creating or writing `docs/CONTRACT.md` violates Hard Rule 7 ("Never change files outside the task's Scope. If the task truly requires it, write a blocker").
- **Needed from Human**:
  - Add `docs/CONTRACT.md` to the Scope of T-042 in `taskslist.md` (e.g. `Scope: programs/registry/src/**, docs/CONTRACT.md`).
- **Affected Tasks**: T-042, T-043, T-044, T-045, T-046.

### T-051: Rule 7 Scope restriction on `src/chat/panel.ts` and test files
- **Task ID**: T-051
- **Attempt**: Immediate (Rule 7)
- **Tried**: Inspected T-051 requirements:
  - Do: move 1,300-line `chat.html` into `media/chat.css` + `media/chat.js` (no inline script/handlers), CSP with nonce, `localResourceRoots`. Delete `src/webview/`.
  - Done when: HTML builder test asserts nonce present, no inline handlers, no remote URLs; protocol tests still pass; contrast test for webview tokens in both themes.
- **Error / Ambiguity**:
  - `src/chat/panel.ts` currently reads `src/webview/chat.html` directly from disk and sets webview options without `localResourceRoots`. Deleting `src/webview/` requires updating `src/chat/panel.ts` to use `src/chat/html.ts` and configure `localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]`.
  - Writing the required tests ("HTML builder test", "contrast test for webview tokens in both themes") requires creating test files in `src/chat/` (e.g. `src/chat/html.test.ts`, `src/chat/contrast.test.ts`), as vitest is configured to scan `src/**/*.test.ts`.
  - However, the task Scope is declared strictly as `Scope: media/, src/chat/html.ts, src/webview/ (delete after)`.
  - Modifying `src/chat/panel.ts` or adding `src/chat/*.test.ts` violates Hard Rule 7 ("Never edit files outside the task's Scope").
- **Needed from Human**:
  - Update Scope of T-051 in `taskslist.md` to:
    `Scope: media/, src/chat/html.ts, src/chat/html.test.ts, src/chat/contrast.test.ts, src/chat/panel.ts, src/webview/ (delete after)` (or `Scope: media/, src/chat/, src/webview/ (delete after)`).
- **Affected Tasks**: T-051, T-052, T-053, T-054, T-070.
