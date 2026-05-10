# 🚀 SolanaPilot

⚡ **AI-powered Solana development platform** — Extension + on-chain registry + web explorer.

> Transform ideas into deployable Solana programs in seconds.

## 🌟 The Complete Stack

### 1️⃣ VS Code Extension

Generate full-stack Solana programs with AI guidance:

- **Solana-aware AI chat** inside VS Code
- **Anchor smart contract generation** from natural language
- **One-click devnet deployment**
- **React frontend generation** from IDL

### 2️⃣ On-Chain Registry Program

Every generated program gets registered on Solana:

- **Deployed to devnet** with real transactions
- **Public program metadata** stored on-chain
- **Two core instructions:** `register_program`, `log_deployment`
- **PDAs for deterministic account derivation**

**Program ID (Devnet):** `SolanaPilot1111111111111111111111111111111`

### 3️⃣ Web Explorer

Browse all registered AI-generated programs:

- **Next.js web app** with Tailwind styling
- **Live on Vercel** at https://solanapilot-registry.vercel.app
- **Solana Explorer integration** for on-chain verification
- **Auto-refreshing stats** every 30 seconds

## ✨ What Makes This Unique

This project is both **a developer tool** AND **a Solana dApp**:

- ✅ **Generates Anchor programs** from chat
- ✅ **Deploys to devnet** with terminal integration
- ✅ **Registers on-chain** in a global registry
- ✅ **Queryable from anywhere** via web explorer
- ✅ **Fully open-source** and extensible

## 📋 Prerequisites

- **VS Code 1.84+**
- **Node.js 18+**
- **Gemini API key** from https://aistudio.google.com
- For deploy & generation flows:
  - Solana CLI 1.18+
  - Anchor CLI 0.30.0
  - Rust toolchain 1.70+

## 🛠️ Installation

### Option 1: Install Pre-Built Extension

```bash
code --install-extension solana-copilot-1.0.0.vsix
```

### Option 2: Development Mode

```bash
# Clone and install
npm install

# Compile TypeScript
npm run compile

# Bundle with esbuild
npm run esbuild

# Open in Extension Development Host
code --extensionDevelopmentPath=$(pwd)
```

## 🚀 Using SolanaPilot

### Step 1: Configure API Key

```
Cmd/Ctrl+Shift+P → SolanaPilot: Set Gemini API Key
```

### Step 2: Generate a Program

```
Cmd/Ctrl+Shift+P → SolanaPilot: Generate Smart Contract
```

Describe your program in chat, and AI generates a complete Anchor project.

### Step 3: Deploy to Devnet

```
Cmd/Ctrl+Shift+P → SolanaPilot: Deploy to Devnet
```

Program builds, deploys, and automatically registers in the on-chain registry.

### Step 4: View in Explorer

Visit https://solanapilot-registry.vercel.app to see your program listed globally.

### Step 5: Generate Frontend (Optional)

```
Cmd/Ctrl+Shift+P → SolanaPilot: Generate React Frontend
```

Creates a React app to interact with your deployed program.

## 📚 Architecture & Deployment

### Registry Program Setup (Already Deployed)

The registry is deployed and ready to use. For reference or custom deployments:

```bash
cd programs/registry
anchor build
anchor deploy --provider.cluster devnet
```

See [REGISTRY_DEPLOYMENT.md](REGISTRY_DEPLOYMENT.md) for complete instructions.

### Registry Program Structure

**IDL:** [`idl/solanapilot_registry.json`](idl/solanapilot_registry.json)

**Rust Program:** [`programs/registry/src/lib.rs`](programs/registry/src/lib.rs) — 98 lines

**Key Features:**

- Stores program metadata (name, description, instruction count, version)
- Uses PDAs (`[b"program", program_id]`) for deterministic account derivation
- Tracks deployment count for each program
- Fully on-chain searchable registry

### Web Explorer Setup

The explorer is live at https://solanapilot-registry.vercel.app

To run locally:

```bash
cd web-explorer
npm install
npm run dev
# Open http://localhost:3000
```

**Tech Stack:**

- Next.js 15 (App Router)
- React 18 (Client components)
- Tailwind CSS (Dark theme)
- @solana/web3.js & @coral-xyz/anchor

## 🔒 Security Features

- ✅ **SecretStorage** for API keys (never written to disk)
- ✅ **Workspace context redacted** before sending to AI
- ✅ **File writes restricted** to open workspace only
- ✅ **Explicit confirmations** for all code generation
- ✅ **Terminal commands require approval** before execution
- ✅ **No telemetry** or tracking

## 📖 File Structure

```
SolanaPilot/
├── src/
│   ├── chatPanel.ts           # Webview message handling
│   ├── webview/chat.html      # UI for chat interface
│   ├── programGenerator.ts    # AI-driven code generation
│   ├── registryClient.ts      # Solana registry integration (NEW)
│   └── commands/              # VS Code command implementations
├── programs/registry/         # Anchor smart contract
│   ├── src/lib.rs            # Program logic
│   ├── Cargo.toml            # Rust dependencies
│   └── tests/                # Integration tests
├── idl/
│   └── solanapilot_registry.json  # Program IDL
├── web-explorer/            # Next.js web app
│   ├── app/page.tsx          # Registry viewer UI
│   ├── package.json
│   └── tailwind.config.js
├── Anchor.toml              # Anchor configuration
└── package.json             # Extension dependencies
```

## 🤝 Contributing

SolanaPilot is open-source! To contribute:

1. Fork this repository
2. Create a feature branch
3. Make your improvements
4. Submit a pull request

Ideas for contributors:

- Add filtering/sorting to web explorer
- Implement program statistics dashboard
- Add support for mainnet-beta registry
- Create registry indexer service
- Add CLI tool for registry queries

## 📝 License

MIT — See LICENSE file

## 🙋 Support

- **Issues:** Open a GitHub issue for bugs or feature requests
- **Questions:** Discussions or email
- **Docs:** See REGISTRY_DEPLOYMENT.md for detailed setup

---

**Built with:** Solana | Anchor | Next.js | VS Code API | Claude AI
