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
