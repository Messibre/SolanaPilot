# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed (Breaking Changes)
- Package renamed from `solana-copilot` to `solanapilot`.
- Standardized extension command IDs under `solanaPilot.*` namespace:
  - `solanaPilot.openChat`
  - `solanaPilot.generateProgram`
  - `solanaPilot.deployToDevnet`
  - `solanaPilot.generateFrontend`
  - `solanaPilot.setApiKey`
  - `solanaPilot.selectProviderAndModel`
  - `solanaPilot.testConnection`
  - `solanaPilot.showLogs`
  - `solanaPilot.exportReceipt`
  (Legacy `solanaCopilot.*` commands remain available as deprecated compatibility aliases).
- Keybindings changed to non-conflicting chords:
  - `solanaPilot.openChat`: `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS), replacing `Ctrl+Shift+S` (which conflicted with Save As).
  - `solanaPilot.generateProgram`: `Ctrl+Alt+G` (`Cmd+Alt+G` on macOS), replacing `Ctrl+Shift+G` (which conflicted with Source Control).
- Extension manifest: removed eager startup activation and redundant `onCommand` activation entries.
- Publisher configured to placeholder `solanapilot-dev`.

### Added
- Packaging `.vscodeignore` overhaul excluding all test files, source maps, web-explorer, target binaries, keys, and workspace documentation from published VSIX.
- Output channel sink and size-capped rotating JSONL file sink with defensive secret redaction.

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
