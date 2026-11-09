# SolanaPilot

> **Autonomous, multi-provider AI toolkit for Solana hackathon builders.**  
> Turn ideas into tested, audited, devnet-deployed Anchor programs and browse them in an on-chain registry explorer.

---

## What is SolanaPilot?

SolanaPilot is an AI-assisted development suite that automates the entire Solana engineering lifecycle for hackathons. Instead of copying snippets from web search into an editor, SolanaPilot acts as an autonomous pairing partner:

1. **Plan & Architecture**: Synthesizes instructions, accounts, and PDA seeds from natural language.
2. **Generate**: Writes production-grade Anchor 0.31 Rust code and TypeScript tests.
3. **Build & Auto-Fix**: Compiles with `anchor build`, automatically parsing compiler errors and applying surgical patches (up to 3 repair cycles).
4. **Test & Security Review**: Executes `anchor test` and evaluates code against a static smart contract security checklist.
5. **Devnet Deploy & Register**: Deploys to Solana Devnet and records program metadata in the decentralized SolanaPilot Registry.
6. **Web Explorer**: Browse, search, and verify programs on devnet with Sign-In With Solana (SIWS) wallet authentication.

---

## 5-Minute Quick Start

### 1. Prerequisites

- **Node.js**: `v20.x` or later (`node --version`)
- **Rust**: Stable toolchain (`rustc --version`)
- **Solana CLI**: `v1.18.x` or later (`solana --version`)
- **Anchor CLI**: `v0.31.1` (`anchor --version`)

### 2. Install & Compile

Clone the repository and install dependencies:

```bash
git clone https://github.com/solanapilot/solanapilot.git
cd solanapilot
npm install
npm run compile
```

Launch the extension in the VS Code Extension Development Host:

```bash
code --extensionDevelopmentPath=.
```

### 3. Configure Your AI Provider

Press `F1` or `Ctrl+Shift+P` in VS Code:
1. Run `SolanaPilot: Select Provider and Model`.
   - Choose **Google Gemini**, **Anthropic**, **OpenAI-Compatible**, or **Ollama** (offline local models).
2. Run `SolanaPilot: Set API Key` to store your key in VS Code `SecretStorage`.
   - *Using Ollama?* No API key required! Pull `deepseek-r1:14b` or `llama3.1` and run completely free.
3. Run `SolanaPilot: Test Connection` to confirm connectivity.

### 4. Open Chat and Build

Press `Ctrl+Alt+S` (`Cmd+Alt+S` on macOS) to open the SolanaPilot Chat Panel:

```text
Build a crowdfunding program with a target goal, funding deadline, 
contributor tracking, and automated refunds if the goal is not met.
```

SolanaPilot initiates the autonomous 8-stage pipeline:
`PLAN → GENERATE → VALIDATE → WRITE → BUILD → TEST → REVIEW → DEPLOY → REGISTER`

### 5. Launch the Web Explorer

Browse your registered program on devnet:

```bash
cd web-explorer
npm install
npm run dev
```

Visit `http://localhost:3000` to inspect programs, view PDA data, or sign in with your Phantom, Solflare, or Backpack wallet.

---

## AI Providers

SolanaPilot features a vendor-neutral AI Gateway built with native `fetch` (no heavy third-party SDKs):

| Provider | Recommended Model | Best For |
|---|---|---|
| **Google Gemini** | `gemini-2.5-flash` / `gemini-2.5-pro` | High context window & rapid code generation |
| **Anthropic** | `claude-3-5-sonnet-20241022` | Complex Solana systems & precision Anchor macros |
| **OpenAI-Compatible** | `gpt-4o-mini` / OpenRouter / Groq | Flexible hosted inference & low latency |
| **Ollama** | `deepseek-r1:14b` / `llama3.1` | **100% Free, Private, & Offline** hackathon development |

For setup instructions and a guide on adding custom providers, see [docs/PROVIDERS.md](docs/PROVIDERS.md).

---

## Architecture & Subsystems

The repository is organized into three decoupled layers:

```
src/                      # VS Code Extension (TypeScript)
  core/                   # Pure business logic (errors, config, logger, validation)
  security/               # Defense-in-depth guards (pathGuard, urlGuard, injectionScreen)
  ai/                     # Multi-provider gateway and structured JSON repair
  agent/                  # 8-stage ReAct loop, tool registry, token budget, receipts
  deploy/                 # Devnet-guarded execution runner
  registry/               # Anchor 0.31 client for on-chain registration
  chat/                   # Webview chat panel and message protocol
  vscodeAdapters/         # Isolated bridge to VS Code APIs
programs/registry/        # Anchor 0.31 registry contract (on-chain metadata)
web-explorer/             # Next.js 16 Web Explorer (SIWS, Auth.js v5, Prisma)
```

For full sequence diagrams and architectural specifications, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Security & Guardrails

SolanaPilot treats all external content, prompts, and model completions as untrusted:

- **Path Guard (`pathGuard.ts`)**: All filesystem operations are locked to the workspace sandbox. Attempts to access `..`, `.git/`, `.env*`, `*keypair*.json`, or `id.json` are rejected.
- **SSRF Prevention (`urlGuard.ts`)**: Outbound requests enforce strict HTTPS and block private networks, link-local IPs, loopback addresses (except Ollama), and cloud metadata (`169.254.169.254`).
- **Secret Hygiene**: Keys reside exclusively in VS Code `SecretStorage` or server environment variables. All log sinks apply automated redaction (`redact.ts`), and git commits are screened with `npm run check:secrets`.
- **Devnet Guard (`runner.ts`)**: Transaction runners verify `solana config get` points to `devnet` or `localhost`. Mainnet execution is strictly blocked.
- **Web Security**: Sign-In With Solana validates ed25519 signatures, uses atomic single-use nonces in PostgreSQL, enforces 100 KB payload limits, and sets strict CSP security headers.

For the threat model and risk breakdown, see [docs/SECURITY.md](docs/SECURITY.md).

---

## Documentation Index

- [Architecture & Mermaid Diagrams](docs/ARCHITECTURE.md)
- [Multi-Provider Configuration & Setup](docs/PROVIDERS.md)
- [Security Model & Countermeasures](docs/SECURITY.md)
- [Agent Pipeline State Graph](docs/AGENT_PIPELINE.md)
- [Registry Contract & Devnet Deployment](REGISTRY_DEPLOYMENT.md)
- [Web Explorer Documentation](web-explorer/README.md)
- [Rollback & Operational Runbook](docs/release/rollback.md)
- [Changelog & Breaking Changes](CHANGELOG.md)

---

## License

MIT
