# ⚡ SolanaPilot

An AI-powered Solana blockchain development copilot for VS Code.

## Features

### 🤖 Feature 1: AI Chat Panel (Implemented)

- **Solana-aware chat** right in VS Code
- Built-in workspace context awareness
- Multi-turn conversation history
- Code insertion directly to your editor
- Explains PDAs, Anchor constraints, security best practices

### 🔮 Feature 2: Generate Smart Contracts (Coming Soon)

- Generate complete, deployable Anchor programs from plain English
- Automatic file creation and workspace integration

### 🚀 Feature 3: Deploy to Devnet (Coming Soon)

- One-click deployment to Solana Devnet
- Automated build + deploy pipeline
- View deployed program on Solana Explorer

### 📱 Feature 4: Generate Frontend (Coming Soon)

- Auto-generate React dApp frontends
- Connect to your deployed Solana programs
- Wallet integration included

### 🛠️ Additional Features (Coming Soon)

- Explain Code: Understand Solana-specific code patterns
- Fix Code: AI-powered bug fixes
- Security Check: Scan for vulnerabilities
- PDA Generator: Quick PDA code generation

## Quick Start

### Prerequisites

1. **Gemini API Key** (free at https://aistudio.google.com)
2. **Node.js** 18+
3. **VS Code** 1.84.0+

### Installation

1. Install the extension from the VS Code Marketplace (search "SolanaPilot")
2. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Run: `Solana Copilot: Set Gemini API Key`
4. Paste your Gemini API key

### Usage

**Open the Chat Panel:**

- Press: `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)
- Or: Command Palette → `Solana Copilot: Open Chat`

**Chat with SolanaPilot:**

- Ask questions about Solana development
- Request explanations of PDAs, Anchor macros, security patterns
- Get help debugging smart contract code
- Try the quick chips: "🔑 Explain PDAs", "🛡️ Security tips", "⚓ Anchor basics"

**Insert Code:**

- Click "📋 Insert" on any code block in the chat
- Code is inserted at your cursor position

## Architecture

```
src/
├── extension.ts           # Entry point, command registration
├── chatPanel.ts           # WebviewPanel management
├── contextBuilder.ts      # Workspace context gathering
├── aiClient.ts            # Gemini API calls
├── secretStorage.ts       # API key management
├── systemPrompt.ts        # System prompts & templates
└── webview/
    ├── chat.html          # Chat UI
    └── chat.js            # Webview logic (embedded)
```

## Configuration

Open VS Code Settings and search for "SolanaPilot":

- `solanaPilot.autoContextRefresh`: Auto-refresh workspace context on each message (default: true)
- `solanaPilot.maxHistoryMessages`: Number of conversation turns to keep (default: 10)

## Development

### Build from Source

```bash
npm install
npm run compile
```

### Package Extension

```bash
npm run vscode:prepublish
npx vsce package
```

## Supported Solana Topics

- **Account Model**: PDAs, account types, rent exemption, lamports
- **Anchor Framework**: Macros, constraints, error codes, account types
- **Security**: Signer validation, arithmetic overflow, account confusion
- **SPL Tokens**: Mint accounts, token accounts, ATAs
- **CPI**: Cross-program invocations, signer seeds
- **Devnet**: Airdrop, testing, deployment

## Known Limitations

- Devnet-focused (mainnet support coming soon)
- Requires internet connection (Gemini API calls)
- Context limited to 8000 characters per message
- Conversation history limited to 10 turns

## Troubleshooting

### "API key required" message

- Run Command Palette → `Solana Copilot: Set Gemini API Key`
- Ensure you have a free Gemini API key from https://aistudio.google.com

### Chat panel won't open

- Check that the extension is properly activated
- Reload VS Code: Command Palette → `Developer: Reload Window`

### AI not responding

- Check your internet connection
- Verify Gemini API key is valid
- Check VS Code output panel for errors

## License

MIT

## Support

For issues, feature requests, or contributions:

- GitHub: [SolanaPilot](https://github.com/solana-copilot/solana-copilot)
- Discord: [Solana Developers](https://discord.gg/solana)

---

Built for the Solana community with ⚡ at Dev3pack Global Hackathon 2026
