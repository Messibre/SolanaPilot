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

### T-045: Devnet airdrop rate-limited / RPC faucet closed (410)
- **Task ID**: T-045
- **Attempt**: 3
- **Signatures**:
  1. `solana airdrop 2` -> `Error: airdrop request failed. This can happen when the rate limit is reached.`
  2. `solana airdrop 1 --url devnet` -> `Error: airdrop request failed. This can happen when the rate limit is reached.`
  3. Direct RPC `requestAirdrop` -> `HTTP 410: "The RPC faucet is closed on this cluster. Request test SOL at https://faucet.solana.com"`
- **Root cause / What learned**:
  The Solana Foundation has permanently closed the RPC faucet endpoint on `api.devnet.solana.com` with HTTP 410, redirecting all devnet airdrops to the web faucet at `https://faucet.solana.com`. That site is gated by Cloudflare Turnstile anti-bot verification, which automated agents are strictly forbidden to bypass by core policy.
  Current deployer balance is `0.49700312 SOL`, which is below the ~2.0 SOL required to deploy the ~255 KB compiled program binary (`target/deploy/solanapilot_registry.so`). Per task specification: *"If devnet airdrop is rate-limited after 3 bounded retries, write a blocker with the wallet's public address."*
- **Needed from Human**:
  - Please open https://faucet.solana.com in your browser and fund the deployer wallet on devnet with ~2.5 SOL:
    - Deployer Public Key: `9K7gwEsQvuRAu7J5Rd6jo2VmhTPhtc8MZAv3D9fZWjG9`
  - In `taskslist.md`, change `- [!] **T-045` back to `- [ ] **T-045`.
- **Affected Tasks**: T-046 (Update consumers of the program), and all downstream Phase 6 and Phase 7 tasks.

### T-054: Rule 7 Scope restriction on `src/core/` for version parsing/decision logic (RESOLVED)
- **Status**: Resolved. Human authorized expanding T-054 Scope to include `src/core/prereqs.ts` and `src/core/prereqs.test.ts`.



