# 🧪 SolanaPilot Testing Guide

Complete guide to test every feature of SolanaPilot with step-by-step instructions.

## 📋 Prerequisites

Before testing, ensure:

```bash
# Check Node.js version (18+)
node --version

# Check npm is installed
npm --version

# Check VS Code version (1.84+)
code --version
```

---

## ✅ Setup (Do This First)

### 1. Install Extension Dependencies

```bash
cd g:\codes\dev3pack\SolanaPilot
npm install
npm run compile
```

### 2. Get Gemini API Key

1. Go to: https://aistudio.google.com
2. Sign in with Google
3. Click: **"Get API Key"** → **"Create new API key"**
4. Copy the key (starts with `AIza...`)
5. Keep it safe for Step 3

### 3. Load Extension in VS Code

1. Open `g:\codes\dev3pack\SolanaPilot` in VS Code
2. Press `F5` to open "Extension Development Host" (new VS Code window)
3. The extension is now loaded in debug mode

### 4. Configure API Key in Debug Window

1. In the debug VS Code window, press `Ctrl+Shift+P`
2. Search: `Solana Copilot: Set Gemini API Key`
3. Paste your Gemini API key (from step 2)
4. Press Enter
5. You should see: ✅ "Gemini API key saved for SolanaPilot."

---

## 🤖 Test Feature 1: AI Chat Panel

### Test 1.1: Open Chat Panel

**In debug VS Code window:**

1. Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)
2. **Expected**: A new panel opens on the right with "⚡ SolanaPilot" header

**Alternative:**

1. Press `Ctrl+Shift+P`
2. Search: `Solana Copilot: Open Chat`
3. Press Enter

### Test 1.2: Welcome Message

**Expected in chat panel:**

- "⚡ SolanaPilot Ready" welcome card centered
- "Ask me anything about Solana development"
- 3 quick chips: "🔑 Explain PDAs", "🛡️ Security tips", "⚓ Anchor basics"

### Test 1.3: Chat with AI

**Try each:**

1. **Simple greeting:**
   - Type: `Hello!`
   - Expected: SolanaPilot responds and introduces itself

2. **Solana question:**
   - Type: `What are PDAs?`
   - Expected: Detailed explanation of Program Derived Addresses

3. **Technical code question:**
   - Type: `How do I use the has_one constraint in Anchor?`
   - Expected: Code example with explanation

4. **Quick chips:**
   - Click: `🔑 Explain PDAs`
   - Expected: Input field fills with "Explain PDAs", then auto-sends

### Test 1.4: Code Insertion

1. Create a new file: `test.rs` in your workspace
2. Open it in editor
3. Open Chat: `Ctrl+Shift+S`
4. Ask: `Show me a simple Rust function that adds two numbers`
5. Wait for response with code block
6. Click: `📋 Insert` button on the code block
7. **Expected**: Code appears in your `test.rs` file at cursor position
8. Click: `Copy` button
9. **Expected**: Toast shows "✅ Copied to clipboard!"

### Test 1.5: Multi-turn Conversation

**Type these in sequence:**

1. `What is account rent in Solana?`
   - Expect: Explanation of rent exemption
2. `Can you give me an example?`
   - Expected: Response references previous answer
3. `Show me the Rust code`
   - Expected: Code block with `#[account(init, space=...)]`

**This tests**: Conversation history working

### Test 1.6: Error Handling

**Test API key error:**

1. Open Command Palette: `Ctrl+Shift+P`
2. Run: `Solana Copilot: Set Gemini API Key`
3. Enter: `wrong_key_12345`
4. Open Chat and ask a question
5. **Expected**: Error message appears with suggestion to check API key

**Test network error:**

1. Disconnect internet
2. Try to send a message
3. **Expected**: Error message "Failed to reach AI"

### Test 1.7: UI Elements

**Test each UI component:**

- [ ] Header shows: "⚡ SolanaPilot" title + "devnet" badge (green dot)
- [ ] Messages appear on left (assistant) and right (user)
- [ ] Messages show timestamps (HH:MM format)
- [ ] Code blocks have dark background with purple left border
- [ ] Buttons are purple (#9945FF) and clickable
- [ ] Loading state shows animated dots + "SolanaPilot is thinking..."
- [ ] Textarea auto-expands as you type (max 4 rows)
- [ ] Send button disabled while loading
- [ ] Markdown formatting works (**bold**, `code`, lists)

---

## 🔮 Test Feature 2: Generate Smart Contract (When Implemented)

### Setup

```bash
# Install Rust (if not done)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest && avm use latest
```

### Test 2.1: Generate Program

```
(When ready)
1. New workspace folder
2. Command Palette → "Solana Copilot: Generate Smart Contract"
3. Input: "voting program with polls and votes"
4. Expected: Files created in workspace (lib.rs, Cargo.toml, etc.)
```

---

## 🚀 Test Feature 3: Deploy to Devnet (When Implemented)

### Prerequisites

```bash
solana config set --url devnet
solana config get  # shows devnet cluster
solana airdrop 5   # fund your devnet wallet with 5 SOL
solana balance     # should show ~5 SOL
```

### Test 3.1: Deploy

```
(When ready)
1. Open your generated Anchor program
2. Command Palette → "Solana Copilot: Deploy to Devnet"
3. Terminal opens and runs: solana config set, airdrop, anchor build, anchor deploy
4. Expected: Program ID appears, Explorer link shown
```

---

## 📱 Test Feature 4: Generate Frontend (When Implemented)

```
(When ready)
1. After deploying program
2. Command Palette → "Solana Copilot: Generate Frontend"
3. React app created in workspace
4. Browser opens at localhost:5173
5. Can connect wallet and call instructions
```

---

## 🐛 Debugging Tips

### View Extension Logs

1. In debug VS Code: Press `Ctrl+Shift+P` → Search: `Output`
2. Dropdown: Select "⚡ SolanaPilot" channel
3. All logs appear there (not in console)

### Check API Key Saved

1. VS Code Settings: `Ctrl+,`
2. Search: `solanaPilot`
3. Your API key is stored in VS Code SecretStorage (not visible, which is correct!)

### Clear API Key

1. Command Palette: `Ctrl+Shift+P`
2. Search: `Developer: Clear Extension Storage`
3. Re-set API key: `Solana Copilot: Set Gemini API Key`

### Test in Different Files

Open different file types (`.rs`, `.ts`, `.json`) and test context:

1. Open: `example.rs`
2. Chat and ask: `What file am I editing?`
3. Expected: Chat mentions `example.rs`

---

## ✔️ Manual Test Checklist

### Before Each Test Session

- [ ] Extension loads without errors (check Output panel)
- [ ] API key set correctly
- [ ] Internet connection working
- [ ] Workspace folder open

### Chat Panel Tests

- [ ] Chat opens with `Ctrl+Shift+S`
- [ ] Welcome message displays
- [ ] Can type in input area
- [ ] Send button works
- [ ] AI responds within 5 seconds
- [ ] Code blocks render correctly
- [ ] Insert button works
- [ ] Copy button works
- [ ] Multi-turn conversation works
- [ ] Error messages are clear

### Context Tests

- [ ] Active file shown in chat context
- [ ] Workspace files detected
- [ ] File truncation works (no crashes on huge files)

### UI Tests

- [ ] Dark theme looks professional
- [ ] Solana purple (#9945FF) used consistently
- [ ] Responsive on different panel sizes
- [ ] Scrolling works smoothly
- [ ] No layout breaks

---

## 📊 Performance Tests

### Chat Response Time

Ask a simple question, measure response time:

```
Question: "What is Solana?"
Expected: < 3 seconds
```

If > 5 seconds:

- Check internet speed
- Check Gemini API status (aistudio.google.com)
- Might be rate-limited (wait a minute)

### File Context Loading

Open a large Rust file (1000+ lines):

```
1. Open file in editor
2. Open chat
3. Ask about workspace
4. Expected: < 1 second context built
```

### Memory Usage

Keep chat open for 30 messages:

```
Expected: < 100MB memory used
If > 200MB: Memory leak, file a bug
```

---

## 📝 Test Report Template

Use this when reporting issues:

```
**Environment:**
- VS Code version: (from Code → About)
- OS: Windows/Mac/Linux
- Node version: (node --version)
- Extension loaded: Yes/No

**Test:**
- Feature: (Chat/Generate/Deploy/Frontend)
- Action: (what you did)
- Expected: (what should happen)
- Actual: (what happened)

**Logs:**
(paste relevant Output panel logs)

**Screenshots:**
(if applicable)
```

---

## 🎯 Success Criteria

SolanaPilot is ready when:

✅ Chat opens and responds to messages  
✅ Code insertion works  
✅ Multi-turn conversation maintains context  
✅ No errors in Output panel  
✅ Markdown rendering looks good  
✅ Loading states clear and visible  
✅ Error messages are helpful  
✅ Performance < 5s per request

---

**Last updated**: May 9, 2026
**Questions?** Check API_SETUP.md for API configuration
