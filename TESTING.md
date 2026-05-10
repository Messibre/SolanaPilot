# 🧪 SolanaPilot Testing Guide

Comprehensive testing for the complete SolanaPilot platform including on-chain registry.

## 🔧 Prerequisites

### Minimum (Chat & Generation)

- **VS Code 1.84+**
- **Node.js 18+**
- **Gemini API key** from https://aistudio.google.com

### Full Stack (Including Deployment & Registry)

- **Rust 1.70+**
- **Solana CLI 1.18+**
- **Anchor CLI 0.30.0+**
- **Solana devnet wallet with SOL** (get free airdrop)

See `SETUP_DEPLOYMENT_ENV.md` for installation instructions.

## 📦 Install the Extension

```bash
code --install-extension solana-copilot-1.0.0.vsix
```

Restart VS Code if needed.

## ⚙️ One-Time Setup

1. Open VS Code
2. Open an empty test folder
3. `Ctrl+Shift+P` → `SolanaPilot: Set Gemini API Key`
4. Paste your Gemini API key
5. Verify wallet is set up:
   ```powershell
   solana config get
   solana balance
   ```

## 📋 Test 1: AI Chat Interface

**What this tests:** Basic chat functionality, AI response quality

1. `Ctrl+Shift+S` or run `SolanaPilot: Open Chat`
2. Verify chat panel opens without errors
3. **Ask Mode Test:**
   ```
   Q: "What are PDAs in Solana?"
   Expected: Clear explanation of Program Derived Addresses
   ```
4. **Switch to Agent Mode:**
   - Click "Agent Mode" button
   - Ask: "Generate a voting program"
   - Verify button state changes visually
5. **Clear History:**
   - Click "Clear Chat" button
   - Verify chat resets
6. **Expected Result:** ✅ All buttons respond, AI answers are accurate

## 🔨 Test 2: Smart Contract Generation

**What this tests:** AI program generation, file I/O

1. Create a new empty folder for test program
2. Open it in VS Code
3. In chat, ask:
   ```
   "Create a simple counter Anchor program with:
   - An initialize instruction
   - An increment instruction
   - A decrement instruction
   - Store count in a counter account"
   ```
4. Review the generated code in chat
5. Click "Write Files" when prompted
6. **Verify:**
   - [ ] `Cargo.toml` created
   - [ ] `src/lib.rs` created with 3 instructions
   - [ ] File syntax is valid Rust
   - [ ] Anchor imports are correct
7. Run: `anchor build`
8. **Expected Result:** ✅ Program compiles without errors

## 🚀 Test 3: Devnet Deployment

**What this tests:** Terminal integration, Solana deployment

Prerequisites:

- [ ] Registry program deployed (see REGISTRY_DEPLOYMENT.md)
- [ ] All program IDs updated
- [ ] Wallet has devnet SOL balance

Steps:

1. Ensure generated counter program is open
2. `Ctrl+Shift+P` → `SolanaPilot: Deploy to Devnet`
3. Watch terminal as it:
   - [ ] Runs `anchor build`
   - [ ] Checks wallet balance
   - [ ] Runs `anchor deploy`
   - [ ] Shows "Program ID: ..."
4. **Capture the Program ID** from output
5. **Verify on Solana Explorer:**
   ```powershell
   solana program info <PROGRAM_ID> --url devnet
   ```
6. **Expected Result:** ✅ Program visible on devnet explorer

## 📍 Test 4: Registry Registration Flow (NEW)

**What this tests:** On-chain registry integration

Prerequisites:

- [ ] Completed Test 3 (program deployed)
- [ ] Registry program ID is correct in codebase

Steps:

1. After deployment completes in Test 3
2. Extension should show prompt:
   ```
   "Register this program in SolanaPilot Registry?"
   [Yes] [No]
   ```
3. Click "Yes"
4. Watch for success message
5. **Check Extension Console** (View → Output → SolanaPilot):
   - Should NOT show registration errors
   - Should show "Program registered successfully"
6. **Verify on-chain:**
   ```powershell
   # Replace with your registry program ID
   solana account <REGISTRY_PDA> --url devnet
   ```
7. **Expected Result:** ✅ Program metadata stored on-chain

## 🌐 Test 5: Web Explorer

**What this tests:** Next.js web UI, blockchain data fetching

### Local Testing

```powershell
cd web-explorer
npm install
npm run dev
# Open http://localhost:3000
```

**Verification:**

- [ ] Page loads without errors
- [ ] Dark theme displays correctly
- [ ] "Programs Registered" shows count
- [ ] Program cards display:
  - [ ] Program name
  - [ ] Description
  - [ ] Instruction count
  - [ ] Creator address (shortened)
  - [ ] Timestamp
  - [ ] Generator version
  - [ ] Deployment count
- [ ] "🔍 View on Explorer" button links to Solana Explorer
- [ ] "📋 View Entry" button links to registry entry
- [ ] Auto-refresh works (no manual reload needed)
- [ ] Responsive on mobile view

### Live Testing (After Vercel Deployment)

```
Visit: https://solanapilot-registry.vercel.app
```

- [ ] Same verifications as local testing
- [ ] Page loads from global CDN
- [ ] Solana Explorer links work worldwide

**Expected Result:** ✅ All programs visible with correct metadata

## 🔄 Test 6: Multiple Programs (End-to-End)

**What this tests:** Full workflow with multiple registrations

1. Repeat Tests 2-4 with **different programs:**
   - Program 1: Counter (already done)
   - Program 2: Token Mint Program
   - Program 3: Voting Program
2. After each deployment, confirm registration
3. **Check Explorer:**
   - Verify count shows 3 (or however many)
   - Each program has unique metadata
   - No duplicates

**Expected Result:** ✅ Multiple programs coexist correctly

## 🛡️ Test 7: Error Handling

**Test 7a: Insufficient Balance**

- Set wallet to address with 0 SOL
- Try to deploy
- **Expected:** Clear error message about insufficient funds
- **Expected:** User can airdrop more SOL and retry

**Test 7b: Network Issues**

- In web-explorer, disconnect internet
- Refresh page
- **Expected:** "Failed to load registry" message or graceful fallback
- **Expected:** Auto-refresh doesn't spam network requests

**Test 7c: Invalid API Key**

- Set Gemini API key to invalid value
- Try to generate program
- **Expected:** Clear error about invalid API key
- **Expected:** Prompt to set correct key

## 📊 Performance Benchmarks

After deployment, measure:

| Metric                      | Target  | Tool              |
| --------------------------- | ------- | ----------------- |
| Chat response time          | < 10s   | Extension console |
| Explorer load time (local)  | < 3s    | Browser DevTools  |
| Explorer load time (Vercel) | < 5s    | Browser DevTools  |
| Program card render         | < 100ms | Lighthouse        |
| Auto-refresh latency        | < 1s    | Visual inspection |

## ✅ Checklist: Ready for Production

- [ ] All 7 tests pass
- [ ] No console errors in extension or explorer
- [ ] All program IDs updated correctly
- [ ] Solana Explorer links verified working
- [ ] Web explorer deployed to Vercel
- [ ] README updated with actual program ID
- [ ] GitHub repo tagged with v1.0.0
- [ ] Demo video recorded and shared
- [ ] Hackathon submission completed (if applicable)

7. Expect SolanaPilot to refuse direct workspace changes and suggest Agent mode instead.
8. Ask for code with a fenced code block, then use `Copy` and `Insert`.
9. Expect the code to copy or insert into the active editor.

## Test 2: Generate Smart Contract

1. Open a new empty workspace folder.
2. Run `SolanaPilot: Generate Smart Contract`.
3. Enter a description such as `a voting program with polls and votes`.
4. Enter a snake_case program name.
5. Review the file list in the confirmation prompt.
6. Click `Yes, Write Files`.
7. Expect the files to be created and the generated `lib.rs` to open.

Guardrail check:

1. Repeat the flow.
2. Cancel at the write confirmation.
3. Expect no new files to be written.

## Test 3: Deploy to Devnet

Before testing deployment:

```bash
solana config set --url devnet
solana airdrop 2
solana balance
anchor --version
```

Then:

1. Open the generated Anchor workspace.
2. Run `SolanaPilot: Deploy to Devnet`.
3. Review the warning prompt and approve it.
4. Expect the integrated terminal to run:
   `solana config set --url devnet`
   `solana airdrop 2`
   `anchor build`
   `anchor deploy`
5. If deployment succeeds, expect a Program ID notification and an Explorer link.

## Test 4: Generate Frontend

1. Make sure `anchor build` has completed and `target/idl/*.json` exists.
2. Run `SolanaPilot: Generate React Frontend`.
3. Review the file list in the confirmation prompt.
4. Click `Yes, Write Frontend`.
5. When prompted, click `Start Now`.
6. Expect `npm install` to run in the generated `app` folder.
7. Expect the Vite app to open in the browser.

Guardrail check:

1. Run `SolanaPilot: Generate React Frontend` again.
2. Cancel at the write confirmation.
3. Expect no frontend files to be changed by that run.

## What to Report

When testers report issues, ask for:

- Operating system
- VS Code version
- Whether they used the `.vsix` or development host
- The exact command they ran
- The exact error message they saw
- Terminal output for deploy/frontend failures
- Screenshots when UI behavior looks wrong

## Success Criteria

The tester build is good to share when:

- Chat opens and responds
- Ask mode stays read-only
- Agent actions require confirmation before writing or deploying
- Program generation writes files only inside the workspace
- Deployment runs in the integrated terminal
- Frontend generation writes files only after confirmation
- The generated frontend can start successfully
