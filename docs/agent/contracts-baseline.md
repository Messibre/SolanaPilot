# Contracts Baseline Report

Captured: 2026-11-03 13:35 UTC
Task: T-040 · Contract baseline

---

## 1. Toolchain Environment

| Component | Version | Notes |
|---|---|---|
| `anchor-cli` | `0.30.0` | Below required `0.31` for T-041 |
| `solana-cli` | `1.18.26` (src:d9f20e95; feat:3241752014, client:SolanaLabs) | Uses internal SBF Rust/Cargo 1.75.0 |
| `rustc` | `1.95.0 (59807616e 2026-04-14)` | System host compiler |
| `cargo` | `1.95.0 (f2d3ce0bd 2026-03-21)` | System host package manager |

---

## 2. Anchor Build Execution

Command run on unchanged contract (`programs/registry`):
```powershell
anchor build
```

Exit Code: `1`

Output:
```
info: uninstalling toolchain solana
info: toolchain solana uninstalled
 Downloading crates ...
error: failed to download `toml_datetime v1.1.1+spec-1.1.0`

Caused by:
  unable to get packages from source

Caused by:
  failed to download replaced source registry `crates-io`

Caused by:
  failed to parse manifest at `C:\Users\hp\.cargo\registry\src\index.crates.io-6f17d22bba15001f\toml_datetime-1.1.1+spec-1.1.0\Cargo.toml`

Caused by:
  feature `edition2024` is required

  The package requires the Cargo feature called `edition2024`, but that feature is not stabilized in this version of Cargo (1.75.0 (827d7a4d2 2024-02-16)).
  Consider trying a more recent nightly release.
  See https://doc.rust-lang.org/nightly/cargo/reference/unstable.html#edition-2024 for more information about the status of this feature.
```

---

## 3. Analysis & Findings

1. **Toolchain Version Incompatibility**:
   - `solana-cli 1.18.26` uses the legacy SBF toolchain with Cargo 1.75.0.
   - Recent dependencies on crates.io downloaded into local cargo cache or resolved by build scripts use the new Rust `edition2024` feature, which requires Cargo >= 1.85+.
   - Additionally, `anchor-cli` is `0.30.0`, but T-041 explicitly mandates Anchor CLI >= 0.31.

2. **Impact**:
   - Documented as a toolchain blocker in `BLOCKERS.md` per T-040 instructions.
   - For T-041, the human operator must upgrade Anchor CLI to `>= 0.31` using `avm` (or Solana CLI toolchain) per `setup.md`.
