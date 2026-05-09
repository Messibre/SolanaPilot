# SolanaPilot

AI-powered VS Code extension for Solana development. The current shareable build focuses on four features:

- Solana-aware AI chat inside VS Code
- Anchor smart contract generation
- Devnet deployment flow
- React frontend generation from Anchor IDL

## What This Build Is Ready For

- Asking Solana and Anchor questions in chat
- Generating an Anchor project into the open workspace
- Deploying to Solana devnet through the integrated terminal
- Generating a React frontend after `anchor build` or deploy

## Security Guardrails

- Gemini API keys are stored in VS Code SecretStorage
- Workspace context is truncated and redacted before being sent to Gemini
- File writes are restricted to the open workspace
- Program generation and frontend generation require explicit confirmation before writing files
- Devnet deployment requires explicit confirmation before terminal commands run

## Prerequisites

- VS Code 1.84+
- Node.js 18+
- Gemini API key from https://aistudio.google.com
- For deploy and frontend flows:
  - Solana CLI
  - Anchor CLI
  - Rust toolchain

## Install

Install the packaged extension:

```bash
code --install-extension solana-copilot-1.0.0.vsix
```

Or run it locally in Extension Development Host:

```bash
npm install
npm run compile
npm run esbuild
```

## Basic Usage

1. Run `SolanaPilot: Set Gemini API Key`
2. Open a workspace folder
3. Use `SolanaPilot: Open Chat` for read-only guidance or Agent mode actions
4. Use `SolanaPilot: Generate Smart Contract` to scaffold an Anchor program
5. Use `SolanaPilot: Deploy to Devnet` to run the build and deploy flow
6. Use `SolanaPilot: Generate React Frontend` after an IDL exists

## Notes

- This tester build intentionally exposes the four implemented features only.
- Generated code should still be reviewed before real-world use.
- Devnet deployment uses the wallet currently configured in Solana CLI.

## License

MIT
