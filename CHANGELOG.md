# Changelog

All notable changes to the SolanaPilot platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-11-09

### Changed (Breaking Changes)
- **Extension Namespace**: Standardized all VS Code commands under the `solanaPilot.*` namespace (legacy `solanaCopilot.*` commands retained as deprecated aliases):
  - `solanaPilot.openChat`
  - `solanaPilot.generateProgram`
  - `solanaPilot.deployToDevnet`
  - `solanaPilot.generateFrontend`
  - `solanaPilot.setApiKey`
  - `solanaPilot.selectProviderAndModel`
  - `solanaPilot.testConnection`
  - `solanaPilot.showLogs`
  - `solanaPilot.exportReceipt`
- **Keybindings**: Migrated shortcut chords to prevent OS and editor conflicts:
  - `solanaPilot.openChat`: Changed from `Ctrl+Shift+S` to `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS) to avoid hijacking "Save As".
  - `solanaPilot.generateProgram`: Changed from `Ctrl+Shift+G` to `Ctrl+Alt+G` (`Cmd+Alt+G` on macOS) to avoid hijacking Git Source Control view.
- **Anchor Upgrade**: Upgraded smart contract workspace and clients to **Anchor 0.31.1** and `solana-program 2.2.1`.
- **New Canonical Program ID**: Deployed hardened registry program to Solana Devnet at `HsgU4dZEKDmWbSufhdA6zJrdz6RJDaSzrN5VQToCDpXa` (verified in slot `519298165`).
- **Web Explorer Stack**: Migrated explorer to Next.js 16 (App Router) and Auth.js v5 (NextAuth v5 beta 32), replacing legacy custom session handling.
- **Boundary Decoupling**: Extension core logic (`core/`, `security/`, `ai/`, `agent/`) completely purged of `vscode` imports; VS Code APIs restricted strictly to `vscodeAdapters/` and `chat/`.

### Added
- **Multi-Provider AI Gateway**:
  - Native Node.js `fetch` adapters (zero external SDKs) for **Anthropic** (Claude 3.5 Sonnet/Haiku), **OpenAI-Compatible** (OpenAI, OpenRouter, Groq), and **Ollama** (offline local models).
  - Official `@google/genai` SDK integration for **Google Gemini** (Gemini 2.5 Flash/Pro).
  - Scripted `MockProvider` for deterministic offline testing.
- **8-Stage Autonomous Agent Pipeline**:
  - Explicit finite state graph: `PLAN → GENERATE → VALIDATE → WRITE → BUILD → TEST → REVIEW → DEPLOY → REGISTER`.
  - Self-healing compiler loop: feeds `anchor build` diagnostic errors to the model for up to 3 bounded surgical patches.
  - Run budget and token accounting with cycle detection.
  - JSON execution receipts with auditable stage history and token usage.
- **Web Explorer Capabilities**:
  - **Sign-In With Solana (SIWS)**: Cryptographic wallet sign-in with Phantom, Solflare, and Backpack using ed25519 signature checks (`tweetnacl`).
  - **Account Linking**: Dual-identity linking associating GitHub and Solana wallets with a single user account at `/profile`.
  - **Database Persistence**: PostgreSQL schema using Prisma 6.19 (`User`, `Identity`, `WalletNonce` models).
  - **Data Layer Caching**: Server-side devnet RPC caching with query parameter clamping ($1 \le \text{pageSize} \le 50$) and "my programs" filter.
  - **Observability Probes**: `/api/health` (process liveness) and `/api/ready` (deep dependency check).
  - **Integration Smoke Suite**: `scripts/smoke.mjs` verifying 200, 503, 400, and 413 responses.
- **Security Foundations**:
  - `pathGuard`: Workspace sandbox preventing directory traversal and denying access to `.env*`, `.git/`, and `*keypair*.json`.
  - `urlGuard`: SSRF defense blocking private IPs, link-local, and cloud metadata (169.254.169.254).
  - `injectionScreen`: Pre-screen for prompt injection and system override signatures.
  - `devnetGuard`: Verifies `solana config get` points to devnet or localhost before any on-chain transaction.
  - Automated secret hygiene scanner (`npm run check:secrets`).

---

## [1.0.0] - 2026-05-10

### Added
- Initial VS Code extension commands for chat, program generation, and frontend scaffolding.
- AI workflow for Anchor program creation using Gemini API.
- On-chain registry program for program metadata storage on Solana devnet.
- Next.js web explorer for browsing registry entries.
