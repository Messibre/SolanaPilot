# SolanaPilot Registry Deployment Guide

## Overview

The SolanaPilot registry is an Anchor program that stores metadata for generated programs. It supports registration, deployment counting, metadata updates, and controlled closure by the original creator.

## Prerequisites

- Rust stable toolchain
- Solana CLI
- Anchor CLI 0.30.0
- Node.js 18+

## Build

From repository root:

```bash
anchor build --program-name solanapilot_registry
```

## Deploy (manual)

```bash
solana config set --url devnet
anchor deploy --program-name solanapilot_registry
```

If deployment returns a new program address, update all config references to keep extension, IDL, and explorer aligned.

## Verify

```bash
solana program show <PROGRAM_ID> --url devnet
```

## Core instructions

### register_program

Registers a program entry under PDA seed `["program", program_id]` with validation for:

- program identifier constraints
- program name format and length
- description and version length bounds
- instruction count bounds

### log_deployment

Increments deployment count. Restricted to the original creator.

### update_program_info

Allows creator to update description and instruction count, and refreshes `last_updated`.

### close_program_entry

Closes the account and returns rent to creator.

## ProgramEntry account layout

- `program_id`: Pubkey
- `program_name`: String (max 50)
- `description`: String (max 200)
- `instruction_count`: u8
- `creator`: Pubkey
- `registered_at`: i64
- `last_updated`: i64
- `generator_version`: String (max 20)
- `deployment_count`: u64
- `bump`: u8

Space allocation uses `8 + ProgramEntry::INIT_SPACE`.

## CI/CD deployment

Repository CI deploys are managed through workflow configuration and may use either runner-native or Docker-based flows depending on the current branch state. Always confirm the active workflow before production demos.

## Troubleshooting

- Program ID mismatch: ensure deploy keypair aligns with declared ID.
- Insufficient balance: airdrop/fund deployer wallet before deploy.
- Registry fetch failures: verify RPC endpoint health and IDL address alignment.
