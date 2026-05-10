# SolanaPilot Product Context

Version: 1.0
Last updated: 2026-05-10

## 1. Product Summary

SolanaPilot is a developer platform for Solana that combines:

- a VS Code extension for AI-assisted program generation
- an Anchor on-chain registry for metadata indexing
- a web explorer for browsing registered programs

Primary goal: reduce time from idea to deployable Solana program.

## 2. Audience

- Developers learning Solana and Anchor
- Hackathon participants shipping quickly
- Teams prototyping devnet-first workflows

## 3. Core Components

### VS Code Extension

Responsibilities:

- AI chat and code generation workflows
- Workspace file writing for generated artifacts
- Deployment command orchestration through terminal flows
- Optional frontend generation from IDL

Key commands:

- Open Chat
- Set Gemini API Key
- Generate Smart Contract
- Deploy to Devnet
- Generate Frontend

### Registry Program (Anchor)

Responsibilities:

- store metadata for generated programs
- enforce creator authorization on mutation operations
- provide deterministic PDA-based account derivation

Core instructions:

- `register_program`
- `log_deployment`
- `update_program_info`
- `close_program_entry`

### Web Explorer (Next.js)

Responsibilities:

- render registry entries from API/live source
- provide status, metadata, and explorer links
- support local/dev and hosted deployment

## 4. System Flow

1. User describes desired program in extension chat.
2. Extension generates Anchor-compatible files in workspace.
3. Program is built and deployed to devnet.
4. Metadata is registered on-chain through registry program.
5. Explorer surfaces registry entries for discovery.

## 5. Technology Stack

- TypeScript (extension and web application)
- Rust + Anchor (on-chain program)
- Solana web3.js and Anchor clients
- Next.js App Router for explorer UI
- GitHub Actions for CI/CD automation

## 6. Security and Reliability Principles

- API credentials stored in VS Code SecretStorage
- On-chain operations guarded by account validation and signer checks
- Deterministic account derivation with PDA seeds
- CI workflows should fail fast on deploy/build errors
- Program IDs must remain synchronized across code and config

## 7. Operational Notes

- Devnet is the default environment
- CLI version compatibility matters (Solana/Anchor/Rust)
- Deployment workflows may be runner-native or Docker-based depending on branch strategy

## 8. Known Risk Areas

- Program ID/keypair mismatch during deploy
- Insufficient deployer SOL on devnet
- Network instability for external binary downloads in CI
- Drift between IDL address and runtime program address

## 9. Recommended Maintenance Practices

- Keep docs and workflow assumptions synchronized
- Pin critical tool versions where practical
- Validate CI changes incrementally
- Add regression checks for deploy address consistency

## 10. Success Criteria

A successful release demonstrates:

- clean extension compile
- successful registry build/deploy
- verifiable program on Solana explorer
- explorer able to fetch and render registry entries
