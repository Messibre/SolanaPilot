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

### T-042: Rule 7 Scope restriction on creating `docs/CONTRACT.md` (RESOLVED)
- **Status**: Resolved. Human authorized adding `docs/CONTRACT.md` to T-042 Scope.

### T-051: Rule 7 Scope restriction on `src/chat/panel.ts` and test files (RESOLVED)
- **Status**: Resolved. Human authorized adding `src/chat/panel.ts`, `src/chat/html.test.ts`, and `src/chat/contrast.test.ts` to T-051 Scope.

### T-045: Devnet airdrop rate-limited / RPC faucet closed (RESOLVED)
- **Status**: Resolved. Human funded wallet with 5 devnet SOL; program successfully deployed to devnet at `HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa` in slot 519298165. Deployment record saved in `docs/deployments.md`. Task completed.

### T-054: Rule 7 Scope restriction on `src/core/` for version parsing/decision logic (RESOLVED)
- **Status**: Resolved. Human authorized expanding T-054 Scope to include `src/core/prereqs.ts` and `src/core/prereqs.test.ts`.



