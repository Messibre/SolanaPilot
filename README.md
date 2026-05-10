# SolanaPilot

SolanaPilot is an AI-assisted Solana development platform composed of:

- A VS Code extension for program generation and guided workflows
- An Anchor registry program for on-chain program metadata
- A Next.js explorer for viewing registered programs

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

## Prerequisites

- VS Code 1.84+
- Node.js 18+
- Rust toolchain (stable)
- Solana CLI 1.17+ or 1.18+
- Anchor CLI 0.30.0
- Gemini API key (for AI-assisted workflows)

## Local development

```bash
npm install
npm run compile
```

Launch in Extension Development Host:

```bash
code --extensionDevelopmentPath=.
```

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

## Web explorer

Run locally:

```bash
cd web-explorer
npm install
npm run dev
```

Then open `http://localhost:3000`.

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
