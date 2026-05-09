# ⚡ SolanaPilot — AI Copilot for Solana Development

> Built for Dev3pack Global Hackathon 2026.

AI-powered VS Code extension that generates Solana smart contracts from natural language, deploys them to devnet, and scaffolds React frontends from Anchor IDLs.

## ✨ Features

- **🧠 Solana-Aware AI Chat** — Ask about Anchor, PDAs, Sealevel, security, and SPL patterns.
- **⚡ Smart Contract Generator** — Describe a program, generate Anchor files, then review before writing.
- **🚀 One-Click Devnet Deploy** — Automated build and deploy flow with terminal feedback.
- **⚛️ Frontend Scaffolding** — Generate a React dApp frontend for your Anchor program.
- **🛡️ Security Guardrails** — API key storage, workspace limits, path checks, and confirmation prompts.

## 🎥 Demo Video

Add your 3-minute demo video link here before marketplace submission.

## 📸 Screenshots

Add screenshots of the chat, generator, deploy flow, and frontend scaffold here.

## 📦 Installation

1. Install from the VS Code Marketplace.
2. Get a free Gemini API key: https://aistudio.google.com
3. Run: **SolanaPilot: Set Gemini API Key**
4. Start building with **SolanaPilot: Open Chat** or **SolanaPilot: Generate Smart Contract**

## ⚙️ Prerequisites

- Node.js 18+
- Rust + Solana CLI + Anchor for deploy workflows
- Gemini API key for AI features

## 📚 Usage

- Open the command palette and search for `SolanaPilot` commands.
- Use Ask mode for read-only guidance.
- Switch to Agent mode to generate, preview, and write files.
- Deploy to devnet from the chat or command palette.

## 🛡️ Security & Privacy

- API keys are stored in VS Code SecretStorage.
- Workspace context is truncated before being sent to the AI.
- The extension only sends data to the configured Gemini API.
- Generated programs deploy to devnet by default.

## 🙏 Credits

Built by SolanaPilot contributors using Gemini 2.5 Flash for Dev3pack Global Hackathon 2026.

## 📄 License

MIT
