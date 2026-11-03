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

### T-041: Anchor CLI version is below requirement
- **Task ID**: T-041
- **Attempt**: 1
- **Tried**: Checked `anchor --version` per task policy: "anchor --version must be 0.31 or newer; if it is older, write a blocker (the human upgrades with avm, see setup.md) — do not install it yourself."
- **Error / Ambiguity**: Current system version is `anchor-cli 0.30.0`. Version 0.31 or newer is required.
- **Needed from Human**:
  - Run `avm install 0.31.0` and `avm use 0.31.0` (or newer) as specified in `setup.md`.
- **Affected Tasks**: T-041, T-042, T-043, T-044, T-045, T-046.

### T-050: Rule 7 Scope restriction on deleting `src/chatPanel.ts`
- **Task ID**: T-050
- **Attempt**: 1
- **Tried**: Planned `src/chat/` modularization and deletion of `src/chatPanel.ts` per "old file gone".
- **Error / Ambiguity**:
  - `src/extension.ts` line 14 imports `ChatPanel` from `./chatPanel`.
  - Deleting `src/chatPanel.ts` causes `tsc --noEmit` and `npm run verify` to fail (`Cannot find module './chatPanel'`) unless `src/extension.ts` is updated to `import { ChatPanel } from "./chat"`.
  - However, `src/extension.ts` is not included in the Scope for T-050 (`Scope: src/chat/, src/chatPanel.ts (delete after), src/sidebarProvider.ts`).
  - Editing `src/extension.ts` is strictly prohibited by Hard Rule 7 ("Never change files outside the task's Scope. If the task truly requires it, write a blocker").
- **Needed from Human**:
  - Add `src/extension.ts` to the Scope of T-050 (or confirm permission to update the single import line in `src/extension.ts`).
- **Affected Tasks**: T-050, T-051, T-052, T-053, T-054.
