# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-05-10

### Added

- VS Code extension commands for chat, generation, deployment, and frontend scaffolding
- Solana-aware AI workflow for Anchor program creation
- On-chain registry program for generated program metadata
- Next.js web explorer for browsing registry entries

### Changed

- CI/CD workflow iterated for improved deployment reliability on devnet
- Registry integration synchronized across extension, Anchor config, and explorer

### Security

- API key handling via VS Code SecretStorage
- Input validation and creator authorization checks in registry program
