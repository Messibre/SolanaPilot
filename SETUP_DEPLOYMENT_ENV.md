# SolanaPilot Deployment Environment Setup

This guide explains how to prepare a local machine and CI environment for building and deploying the SolanaPilot registry program.

## 1. Required Toolchain

- Node.js 18+
- Rust stable (with cargo)
- Solana CLI (1.17+ or 1.18+)
- Anchor CLI 0.30.0

## 2. Local Setup

### 2.1 Install Rust

Windows (winget):

```powershell
winget install Rustlang.Rust.MSVC
```

macOS/Linux:

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
```

Verify:

```bash
rustc --version
cargo --version
```

### 2.2 Install Solana CLI

Use official installer:

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
```

Verify:

```bash
solana --version
```

### 2.3 Install Anchor CLI

Recommended with AVM:

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.0
avm use 0.30.0
anchor --version
```

## 3. Solana Wallet Setup

```bash
solana config set --url devnet
solana-keygen new -o ~/.config/solana/id.json
solana address
solana airdrop 2
```

## 4. Build and Deploy Registry Program

From repository root:

```bash
anchor build --program-name solanapilot_registry
anchor deploy --program-name solanapilot_registry
```

Verify:

```bash
solana program show <PROGRAM_ID> --url devnet
```

## 5. CI/CD Secrets for GitHub Actions

If CI workflow expects secret keypairs, add these repository secrets:

- `DEPLOYER_KEYPAIR`: base64-encoded `~/.config/solana/id.json`
- `PROGRAM_KEYPAIR`: base64-encoded `target/deploy/solanapilot_registry-keypair.json`

Generate values:

Linux/macOS:

```bash
base64 -w0 ~/.config/solana/id.json
base64 -w0 target/deploy/solanapilot_registry-keypair.json
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME/.config/solana/id.json"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("target/deploy/solanapilot_registry-keypair.json"))
```

## 6. Common Issues

### `solana: command not found`

- Ensure Solana install directory is on PATH
- Restart shell/terminal after installation

### `anchor: command not found`

- Ensure AVM binary path is on PATH
- Re-run `avm use 0.30.0`

### Program ID mismatch on deploy

- Confirm `declare_id!` in the program matches deploy keypair public key
- Confirm `Anchor.toml` and IDL addresses are synchronized

### Insufficient funds on devnet

- Retry `solana airdrop 2`
- Confirm current wallet with `solana address`

## 7. Post-Deployment Sync Checklist

After successful deploy, verify these are aligned:

- Program ID in `programs/registry/src/lib.rs`
- Program ID in `Anchor.toml`
- Program ID in extension client config
- Program ID in explorer/API config and IDL files
