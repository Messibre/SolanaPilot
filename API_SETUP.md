# 🔑 SolanaPilot API Configuration Guide

This document explains all external APIs used by SolanaPilot, where to get them, and how to set them up.

## 📋 Table of Contents

1. [Gemini API (Required)](#gemini-api-required)
2. [Solana RPC Endpoints (Optional)](#solana-rpc-optional)
3. [How to Store Keys Securely](#how-to-store-keys-securely)
4. [Testing the APIs](#testing-the-apis)

---

## 🤖 Gemini API (Required)

### What It Is
Google's Gemini API. In the current implementation, SolanaPilot uses the `gemini-2.5-flash` model for:
- AI chat responses in the chat panel
- Code generation prompts
- Security analysis
- Code explanations

### Where to Get It
**Free tier available!**

1. Go to: https://aistudio.google.com
2. Sign in with your Google account (create one if needed)
3. Click **"Get API Key"** → **"Create new API key in new project"**
4. Copy the generated API key (starts with `AIza...`)
5. Save it securely (instructions below)

### Pricing
- **Free Tier**: 60 requests/minute, 1500 requests/day
- **Pay-as-you-go**: $0.075 per million input tokens, $0.30 per million output tokens
- For a hackathon (1-3 days): Free tier is sufficient

### Rate Limits
- 60 req/min = 1 request per second
- SolanaPilot enforces client-side rate limiting to avoid hitting this

---

## 🔗 Solana RPC (Optional)

### What It Is
Remote Procedure Call endpoint for reading/writing on-chain data.

Right now, Feature 2 deploys through the local Solana CLI and Anchor CLI, so an RPC API key is not required for generation or deploy.

You only need an RPC provider if you later add:
- frontend state reads
- custom network status panels
- direct RPC calls from the extension instead of CLI tooling

### Free RPC Endpoints

#### Option 1: Helius (Recommended)
- **URL**: https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
- **Get API Key**: https://www.helius.xyz
- **Free Tier**: 1M credits/month (≈ 100,000 RPC calls)

#### Option 2: Solana Public RPC
- **URL**: https://api.devnet.solana.com
- **Rate Limit**: No key needed, but 100 req/sec limit
- **Use**: Great for testing, but unreliable during periods of high network load

#### Option 3: QuickNode
- **URL**: https://your-app.solana-devnet.quiknode.pro/your-token/
- **Get Key**: https://www.quicknode.com
- **Free Tier**: 5GB/month

### Recommendation
- **For now**: Use public Solana RPC (no key needed)
- **Later**: Add Helius when you want reliable performance

---

## 💾 How to Store Keys Securely

### Option 1: VS Code SecretStorage (Built into SolanaPilot) ✅ RECOMMENDED

This is what SolanaPilot uses by default.

**How it works:**
1. User runs: `Solana Copilot: Set Gemini API Key`
2. Prompted to enter API key
3. VS Code stores it **encrypted** in the system keychain:
   - Windows: Windows Credential Manager
   - macOS: Keychain
   - Linux: Secret Service / KWallet

**Security**: 
- Keys are **never** stored in plaintext in files
- Keys are **never** logged or printed
- Only accessible within VS Code process

Stored secret key name:
```text
solanaPilot.geminiApiKey
```

### Option 2: Environment Variables (.env file)

**⚠️ WARNING**: Only for development. Never commit `.env` to git!

```bash
# .env (add to .gitignore)
GEMINI_API_KEY=AIza...
HELIUS_API_KEY=your_helius_key_here
SOLANA_RPC_URL=https://devnet.helius-rpc.com
```

Load in code:
```typescript
import dotenv from 'dotenv'
dotenv.config()
const geminiKey = process.env.GEMINI_API_KEY
```

### Option 3: GitHub Secrets (for CI/CD)

If building with GitHub Actions:

1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GEMINI_API_KEY`, Value: `AIza...`
4. Use in workflow:
```yaml
- name: Run tests
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

## 🧪 Testing the APIs

### Test 1: Verify Gemini API Key

**Quick test in VS Code:**

1. Open Command Palette: `Ctrl+Shift+P`
2. Run: `Solana Copilot: Set Gemini API Key`
3. Enter your API key
4. Open Chat: `Ctrl+Shift+S` (or Command Palette → `Solana Copilot: Open Chat`)
5. Ask: `Hello, who are you?`

**Expected**: SolanaPilot responds with introduction

**If fails**:
- ❌ "API key invalid" → Key is wrong, get new one from aistudio.google.com
- ❌ "Rate limit" → Wait a few minutes, you hit 60 req/min limit
- ❌ "Safety block" → Rephrase your question (Gemini safety filters triggered)

### Test 2: Verify Context Building

Test that workspace context is correctly gathered:

1. Open a Solana project folder in VS Code
2. Create a simple `lib.rs` or `Anchor.toml` file
3. Open SolanaPilot Chat: `Ctrl+Shift+S`
4. Ask: `What files do you see in my workspace?`

**Expected**: SolanaPilot lists your Rust files

### Test 3: Test Code Insertion

1. Create an empty `test.rs` file
2. Open it in editor
3. Open Chat: `Ctrl+Shift+S`
4. Ask: `Generate a simple Rust function`
5. Click the "📋 Insert" button on the code block

**Expected**: Code appears in your `test.rs` file at cursor position

### Test 4: Smart Contract Generator + Deploy

1. Open a folder in VS Code.
2. Run: `Solana Copilot: Generate Smart Contract`
3. Enter a description such as: `A voting program where users create polls and cast votes on-chain`
4. Enter a snake_case program name such as: `voting_program`
5. Wait for files to be written into the workspace.
6. Click `Deploy to Devnet` when prompted.

Expected:
- `Anchor.toml`, workspace `Cargo.toml`, program `Cargo.toml`, `lib.rs`, and a test file are created
- `lib.rs` opens automatically
- the integrated terminal runs `solana config set --url devnet`, `solana airdrop 2`, `anchor build`, and `anchor deploy`

Prerequisites for deploy:
- `solana` CLI installed
- `anchor` CLI installed
- a local Solana wallet configured for devnet

### Test 5: Terminal Tooling

**Test Solana CLI availability:**
```bash
solana --version
solana config get
solana balance
```

If any fail, install Solana CLI:
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

**Test Anchor CLI:**
```bash
anchor --version
anchor build  # in an Anchor project
```

If fails, install Anchor:
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest
```

---

## 🔒 Security Checklist

- ✅ API keys stored in VS Code SecretStorage (encrypted)
- ✅ API keys never logged to console
- ✅ API keys never committed to git
- ✅ `.env` file in `.gitignore`
- ✅ API keys not exposed in error messages to users
- ✅ All API calls use HTTPS only
- ✅ Workspace context limited to 8000 chars (no infinite context leaks)

---

## 📊 API Usage Monitoring

### Gemini Free Tier
- Go to: https://aistudio.google.com → Your API Key → Check usage
- Shows: Daily quota, current usage, reset time

### Helius (when integrated)
- Dashboard: https://dashboard.helius.xyz
- Shows: RPC calls used, bandwidth, errors

---

## 🚨 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid API key" | Key is wrong or expired | Get new key from aistudio.google.com |
| "Rate limit exceeded" | Hit 60 req/min limit | Wait 1 minute, SolanaPilot auto-throttles |
| "API key required" | Key not set | Run `Solana Copilot: Set Gemini API Key` |
| "Safety blocked" | Gemini safety filter triggered | Rephrase question, less aggressive language |
| "Network error" | No internet connection | Check connectivity |

---

## 📚 Next Steps

1. **Now**: Set your Gemini API key via VS Code
2. **Test**: Open chat and ask about Solana
3. **Later**: Add Helius RPC when implementing RPC-backed features
4. **Production**: Move keys to environment variables or GitHub Secrets

---

**Last updated**: May 9, 2026
**For help**: Run `Solana Copilot: Set Gemini API Key` in VS Code
