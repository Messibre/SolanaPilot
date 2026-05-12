# SolanaPilot

SolanaPilot is an AI-assisted Solana development platform composed of:

- A VS Code extension for program generation and guided workflows
- An Anchor registry program for on-chain program metadata
- A Next.js explorer for viewing registered programs

## Setup

### Prerequisites

- VS Code 1.84+
- Node.js 18+
- Rust stable
- Solana CLI 1.17+ or 1.18+
- Anchor CLI 0.30.0
- A Gemini API key for AI-assisted workflows

### Install

```bash
npm install
npm run compile
```

### Run the extension

Open the workspace in VS Code and launch the Extension Development Host:

```bash
code --extensionDevelopmentPath=.
```

### Run the web explorer

```bash
cd web-explorer
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment Variables

The extension and explorer can use the following environment values:

- `GEMINI_API_KEY`: used by AI-assisted extension workflows
- `NEXT_PUBLIC_SOLANA_RPC_URL`: optional RPC endpoint for the web explorer

For local explorer development, create `web-explorer/.env.local`:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

If the RPC variable is omitted, the explorer falls back to the public Solana devnet endpoint.

## Core capabilities

- Generate Anchor programs from natural language prompts
- Run deployment workflows for Solana devnet
- Register generated programs in an on-chain registry
- Browse registry entries through a web explorer

## Repository components

- `src/`: VS Code extension source code
- `programs/registry/`: Anchor registry program
- `idl/`: registry IDL and client metadata
- `web-explorer/`: Next.js application for registry browsing
- `.github/workflows/`: CI/CD workflows

## Tech Stack & Architecture

SolanaPilot is organized as three cooperating layers:

- A VS Code extension that handles prompt-driven workflows, key storage, and deployment orchestration
- An Anchor-based Solana registry program that stores generated program metadata on-chain
- A Next.js App Router explorer that reads registry state and presents it with a fallback demo experience

The explorer uses React + TypeScript, `@coral-xyz/anchor`, and `@solana/web3.js` to read registry accounts from devnet. When live RPC access fails, it renders local mock data so the UI remains usable.

## VS Code commands

- `SolanaPilot: Open Chat`
- `SolanaPilot: Set Gemini API Key`
- `SolanaPilot: Generate Smart Contract`
- `SolanaPilot: Deploy to Devnet`
- `SolanaPilot: Generate Frontend`

## Registry program

Configured registry program ID:

- `Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs`

Build and deploy manually:

```bash
anchor build --program-name solanapilot_registry
anchor deploy --program-name solanapilot_registry
```

For full deployment details, see `REGISTRY_DEPLOYMENT.md` and `SETUP_DEPLOYMENT_ENV.md`.

## Deployment Guide for Vercel

The web explorer can be deployed to Vercel as a standard Next.js app:

1. Set the project root to `web-explorer`.
2. Add `NEXT_PUBLIC_SOLANA_RPC_URL` in Vercel project settings if you want to target a custom RPC endpoint.
3. Use the default build command from the app package, which is `npm run build`.
4. Confirm the app has read access to your chosen RPC endpoint from the Vercel runtime.

If you deploy the explorer separately, keep the root repository for the extension and registry workflow, and treat `web-explorer` as an independent Vercel app.

## Web explorer

Run locally:

```bash
cd web-explorer
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Demo Flow

1. Open the VS Code extension and generate or deploy a program.
2. Register the generated program in the on-chain registry.
3. Open the web explorer to view the registry list.
4. The explorer first tries to load live devnet registry data.
5. If devnet is unavailable, it falls back to demo data and keeps the browsing experience active.

## How It Works

- The extension coordinates generation and deployment tasks.
- The registry program stores program metadata on-chain.
- The web explorer fetches registry accounts from devnet, decodes them with the local IDL, and caches the result for a short period.
- If the live fetch fails, the explorer preserves the UI state and renders local demo data instead of breaking the page.

## Security notes

- API keys are stored in VS Code SecretStorage
- File writes are scoped to the active workspace
- Deployment commands run in explicit terminal flows

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests or validation notes
4. Open a pull request

## License

MIT
