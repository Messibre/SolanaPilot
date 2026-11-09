# SolanaPilot Registry Deployment Guide

## Overview

The SolanaPilot registry is an Anchor 0.31 smart contract on Solana Devnet that indexes metadata for AI-generated programs. It records program identity, human-readable descriptions, instruction counts, deployment metrics, and provides creator-controlled updates and rent-reclamation closing.

---

## Live Devnet Deployment

The canonical SolanaPilot Registry is deployed and active on Solana Devnet:

| Property | Value |
|---|---|
| **Program ID** | `HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa` |
| **Authority** | `DiKXHizs3T4DDfM4zYYDeW4coq27RP3cntv5VeZRJBe7` |
| **ProgramData PDA** | `9K7gwEsQvuRAu7J5Rd6jo2VmhTPhtc8MZAv3D9fZWjG9` |
| **Network** | Solana Devnet (`https://api.devnet.solana.com`) |
| **Verified Slot** | `519298165` |
| **Transaction Records** | See `docs/deployments.md` |

---

## Prerequisites

- Node.js 20+
- Rust stable toolchain (`rustc --version`)
- Solana CLI (`solana --version`, minimum 1.18+)
- Anchor CLI (`anchor --version`, version 0.31.1)

---

## Build Instructions

From the repository root:

```bash
anchor build --program-name solanapilot_registry
```

This compiles the contract and updates the IDL file located at `idl/solanapilot_registry.json`.

---

## Manual Deployment to Devnet

1. **Verify Network Guard**:
   Ensure your Solana CLI is configured exclusively for devnet:
   ```bash
   solana config get
   # URL must contain devnet (e.g. https://api.devnet.solana.com)
   ```

2. **Check Balance**:
   Ensure deployer keypair has sufficient SOL:
   ```bash
   solana balance
   # Airdrop if balance < 2 SOL:
   solana airdrop 2
   ```

3. **Deploy Program**:
   ```bash
   anchor deploy --program-name solanapilot_registry
   ```

4. **Verify On-Chain**:
   ```bash
   solana program show HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa --url devnet
   ```

---

## Contract Instructions

### `register_program`
Registers a newly built program into the on-chain registry.
- **PDA Seeds**: `[b"program", program_id.as_ref()]`
- **Guards**: Input validation for name ($\le 50$ chars), description ($\le 200$ chars), version ($\le 20$ chars), instruction count $> 0$.
- **Signers**: `creator` (payer), PDA initialized.

### `log_deployment`
Increments the `deployment_count` metric for an existing program entry.
- **Guards**: Restricted to original `creator` (`has_one = creator`).

### `update_program_info`
Allows creator to update description, instruction count, and bumps `last_updated` timestamp.
- **Guards**: Restricted to original `creator` (`has_one = creator`).

### `close_program_entry`
Closes the PDA account and returns all rent lamports to the creator.
- **Guards**: Signer must match `creator` (`has_one = creator, close = creator`).

---

## Account Storage & Sizing

The `ProgramEntry` account layout uses Anchor `InitSpace`:

```rust
#[account]
#[derive(InitSpace)]
pub struct ProgramEntry {
    pub program_id: Pubkey,         // 32 bytes
    #[max_len(50)]
    pub program_name: String,       // 4 + 50 bytes
    #[max_len(200)]
    pub description: String,        // 4 + 200 bytes
    pub instruction_count: u8,      // 1 byte
    pub creator: Pubkey,            // 32 bytes
    pub registered_at: i64,         // 8 bytes
    pub last_updated: i64,          // 8 bytes
    #[max_len(20)]
    pub generator_version: String,  // 4 + 20 bytes
    pub deployment_count: u64,      // 8 bytes
    pub bump: u8,                   // 1 byte
}
```

Total account space: `8 + ProgramEntry::INIT_SPACE` (370 bytes total).

---

## Troubleshooting

- **Program ID Mismatch**: Check that `declare_id!` in `programs/registry/src/lib.rs` and `Anchor.toml` match `solana address -k target/deploy/solanapilot_registry-keypair.json`.
- **Dangling References**: For environment setup details, see `setup.md` Section 4.
- **Devnet Deployment Log**: All deployment transaction signatures are recorded in `docs/deployments.md`.
