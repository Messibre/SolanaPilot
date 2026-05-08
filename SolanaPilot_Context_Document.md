# SolanaPilot — Full Product Context Document

**Version:** 1.0 | **Hackathon:** Dev3pack Global Hackathon (May 8–10, 2026)
**Author context:** Built in 1 day with multi-AI parallel development

---

## 1. WHAT IS SOLANAPILOT?

SolanaPilot is a VS Code extension that acts as an AI-powered Solana development copilot. It is specifically designed for developers building on the Solana blockchain — particularly students and Web2 developers transitioning to Web3. It understands Solana's unique architecture deeply and can do things that general AI tools like GitHub Copilot or Cursor cannot: generate complete, deployable Anchor smart contracts, write them directly into your workspace, deploy them to Solana devnet via terminal automation, and scaffold React frontends that connect to the deployed program — all from natural language inside VS Code.

The core promise: **describe what you want to build → SolanaPilot writes, deploys, and connects it.**

---

## 2. THE PROBLEM IT SOLVES

### Why general AI tools fail on Solana

- Solana's account model is fundamentally different from Ethereum/EVM. General AI tools (Copilot, ChatGPT, Cursor) are trained predominantly on Ethereum patterns and frequently hallucinate incorrect Solana code.
- AI often generates Rust code that compiles but fails at runtime on Solana (missing account validation, wrong PDA derivation, sequential assumptions in parallel runtime).
- The Anchor framework uses Rust macros (#[program], #[derive(Accounts)], constraints) that generic AI does not understand in context.
- There is no existing tool that combines AI code generation + file writing + terminal deployment + frontend scaffolding into one VS Code-native workflow.

### The target user

- Students at the Dev3pack bootcamp learning Solana for the first time
- Web2 developers (JavaScript/Python background) entering Solana development
- Hackathon participants who need to ship fast
- Any developer who wants to go from idea to deployed Solana program in under 10 minutes

---

## 3. TECH STACK

### Extension Layer

- **Language:** TypeScript
- **Runtime:** Node.js (bundled with VS Code extension host)
- **Framework:** VS Code Extension API (vscode namespace)
- **Packaging:** @vscode/vsce → produces .vsix file

### AI Layer

- **Primary model:** gemini-2.5-flash
- **Context strategy:** Large Solana-specific system prompt + workspace file injection

- **API call pattern:** REST fetch from extension host process (not webview)

### Solana Layer

- **Framework:** Anchor (Rust-based smart contract framework)
- **RPC:** Helius (free tier: 1M credits/month) for devnet interactions
- **CLI tools used:** solana-cli, anchor-cli (called via VS Code terminal)
- **Network target:** Solana Devnet (for demo), architecture supports mainnet

### Frontend Generation

- **Generated stack:** React + TypeScript + @coral-xyz/anchor + @solana/web3.js + @solana/wallet-adapter-react
- **Styling:** Tailwind CSS
- **Wallet:** Phantom or most probably metamask wallet adapter

---

## 4. FULL FEATURE LIST — DETAILED

---

### FEATURE 1: AI Chat Panel (Solana-Aware Chat)

**What it does:**
Opens a sidebar/split panel chat interface inside VS Code. The user can ask any Solana development question in natural language. The AI responds with Solana-specific knowledge, code snippets, explanations, and debugging advice. Unlike ChatGPT, this assistant has the full content of the open workspace files injected as context so it knows exactly what the user is building.

**How it works:**

1. User runs command: `Solana Copilot: Open Chat` (or clicks status bar icon)
2. VS Code creates a WebviewPanel (split editor beside current file)
3. The webview renders a dark-themed HTML chat UI with Solana branding (#9945FF purple)
4. User types a message and submits
5. Webview sends message to extension host via `panel.webview.onDidReceiveMessage`
6. Extension host calls `buildWorkspaceContext()` — reads or creates files if none - open Rust/TypeScript files
7. Extension host constructs full prompt: SOLANA_SYSTEM_PROMPT + workspace context + user message
8. Extension host calls gemini API via node-fetch
9. Response streams back to webview
10. Webview renders response with syntax-highlighted code blocks
11. Each code block has an "Insert into Editor" button that injects the code at cursor position

**Context it receives:**

- Current open file contents (up to 2000 chars per file)
- Anchor.toml (program configuration)
- Cargo.toml (Rust dependencies)
- lib.rs (main program file)
- Any test files open

**Solana knowledge in system prompt covers:**

- Account model vs EVM contract model
- PDA derivation (find_program_address, seeds, bump)
- Anchor macros: #[program], #[derive(Accounts)], #[account], #[error_code]
- Account constraints: has_one, constraint =, mut, init, seeds, bump
- Sealevel parallel execution model
- SPL Token program, Token Extensions (Token-2022)
- Cross-Program Invocations (CPI)
- Common security vulnerabilities: missing signer check, integer overflow, account confusion
- Devnet vs Mainnet behavior
- Helius RPC, Jupiter swap, Metaplex NFT patterns

---

### FEATURE 2: Generate Smart Contract (Full Program Generator)

**What it does:**
The flagship feature. User describes a program in plain English. SolanaPilot generates a complete, working, deployable Anchor smart contract with all required files, writes them directly into the VS Code workspace, and offers to deploy immediately.

**How it works:**

1. User runs command: `Solana Copilot: Generate Smart Contract`
2. VS Code shows an input box: "What Solana program do you want to build?"
3. User types a description (e.g., "a voting program where users create polls and cast votes")
4. Progress notification appears: "🔨 Generating Rust code..."
5. Extension calls AI with a prompt that demands structured JSON output
6. AI returns JSON with this exact schema:

```json
{
  "type": "full_program",
  "programName": "voting",
  "description": "On-chain voting with polls and vote tracking",
  "files": [
    { "path": "programs/voting/src/lib.rs", "content": "..." },
    { "path": "programs/voting/Cargo.toml", "content": "..." },
    { "path": "Anchor.toml", "content": "..." },
    { "path": "Cargo.toml", "content": "..." }
  ],
  "deployCommands": [
    "solana config set --url devnet",
    "solana airdrop 2",
    "anchor build",
    "anchor deploy"
  ]
}
```

7. `fileWriter.ts` parses the JSON and writes each file to the workspace root
8. Directories are created recursively as needed
9. The main `lib.rs` is opened in the VS Code editor
10. A dialog appears: "Program 'voting' generated! Deploy to devnet?" with [Deploy Now] [Later] buttons
11. If Deploy Now: hands off to the Deploy feature (Feature 3)

**What it generates (for a voting program example):**

- `lib.rs`: Full Anchor program with instructions (create_poll, vote), account structs, error codes, PDA logic
- `Anchor.toml`: Configured for devnet with program ID placeholder
- `Cargo.toml` (workspace and program-level): Anchor dependency, Solana version pinned
- Comments on every non-obvious line
- Proper account validation constraints on all accounts
- Custom error codes with descriptive messages

**AI output requirements (enforced by system prompt):**

- Always use Anchor (not native Rust) unless explicitly asked
- Include #[error_code] enum
- Include account validation constraints
- Include PDAs where appropriate
- Return ONLY the JSON, no markdown fences
- Make it simple but functional — 2-3 instructions max for hackathon scope

---

### FEATURE 3: Deploy to Devnet (Automated Terminal Deployment)

**What it does:**
Runs the full Anchor build + Solana devnet deployment pipeline inside a VS Code integrated terminal, with friendly status messages. No manual CLI knowledge required.

**How it works:**

1. User triggers via post-generation dialog OR runs command: `Solana Copilot: Deploy to Devnet`
2. Extension checks that a workspace folder is open
3. Creates a named VS Code terminal: "🚀 Solana Copilot"
4. Runs commands sequentially (VS Code terminal supports sequential sendText):

```
cd <workspace_root>
echo "🔧 Configuring Solana CLI to devnet..."
solana config set --url devnet
echo "💰 Airdropping SOL for deployment fees..."
solana airdrop 2
echo "🏗️ Building Anchor program (this takes 2-4 minutes)..."
anchor build
echo "🚀 Deploying to devnet..."
anchor deploy && echo "✅ DEPLOYED SUCCESSFULLY — check Explorer"
```

5. Terminal stays open and visible throughout
6. After `anchor deploy` succeeds, terminal prints the Program ID
7. Extension watches terminal output (via `vscode.window.onDidWriteTerminalData`) to detect the program ID in the output
8. When detected, shows notification: "✅ Deployed! Program ID: [ID]" with [View on Explorer] button
9. [View on Explorer] opens `https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet` in browser

**Prerequisites (user must have installed):**

- Rust (rustup)
- Solana CLI (solana-install)
- Anchor CLI (avm + anchor)
- A funded devnet wallet (~2 SOL minimum)

**Failure handling:**

- If airdrop fails (devnet faucet empty): shows message with link to faucet.solana.com
- If build fails: shows error in terminal, prompts user to paste error into chat for AI debugging
- If deploy fails due to insufficient SOL: shows command to airdrop more

---

### FEATURE 4: Generate Frontend (React dApp Scaffold)

**What it does:**
After a program is deployed, SolanaPilot reads the generated IDL (Interface Definition Language) file — which Anchor automatically produces during build — and generates a complete React frontend application that connects to the deployed program on devnet. The frontend includes wallet connection, program state display, and buttons to call every instruction.

**How it works:**

1. User runs command: `Solana Copilot: Generate Frontend`
2. Extension searches workspace for `target/idl/*.json` (Anchor IDL file)
3. If not found: error message "Build your program first (anchor build)"
4. If found: reads IDL JSON (contains all instructions, accounts, types)
5. Extension reads Program ID from `Anchor.toml` [programs.devnet] section
6. Constructs AI prompt with IDL + Program ID injected
7. AI generates complete React frontend as JSON:

```json
{
  "type": "frontend",
  "files": [
    { "path": "app/src/App.tsx", "content": "..." },
    { "path": "app/package.json", "content": "..." },
    { "path": "app/tailwind.config.js", "content": "..." },
    { "path": "app/tsconfig.json", "content": "..." }
  ],
  "startCommand": "cd app && npm install && npm run dev"
}
```

8. Files are written to workspace
9. Extension opens VS Code integrated terminal and runs: `cd app && npm install && npm run dev`
10. Browser opens at localhost:5173 (Vite dev server default)

**What the generated frontend includes:**

- Phantom/metamask wallet connect/disconnect button
- Connection status indicator (devnet badge)
- For each Anchor instruction: a form with input fields matching instruction parameters
- "Submit Transaction" button that calls the instruction via Anchor client
- Transaction result display with Explorer link
- Real-time program account state fetched and displayed
- Dark mode, responsive, Solana-purple accent color

**Tech choices in generated frontend:**

- React 18 + TypeScript + Vite (fast setup)
- @coral-xyz/anchor (Anchor TypeScript client)
- @solana/web3.js (core Solana JS SDK)
- @solana/wallet-adapter-react + @solana/wallet-adapter-phantom
- Tailwind CSS (utility classes, no custom CSS needed)

---

### FEATURE 5: Explain Code (Inline Code Action)

**What it does:**
User selects any Solana-related code (Rust or TypeScript), right-clicks, and chooses "🔆 Explain with Solana Copilot." The AI explains the selected code specifically in the context of Solana's architecture — not just what the code does syntactically, but WHY it's needed in Solana.

**How it works:**

1. User selects code in editor
2. Right-click context menu shows: "🔆 Explain with Solana Copilot"
3. Available when: `editorHasSelection` is true and file is .rs or .ts
4. Extension gets selected text + surrounding 20 lines of context
5. Calls AI with prompt: "Explain this Solana code. Focus on WHY this is needed in Solana's architecture, not just what it does syntactically."
6. Response opens in a VS Code information panel or the existing chat panel
7. Code blocks in response have "Insert" buttons

**Example explanations it gives:**

- `find_program_address(&[b"poll", authority.key().as_ref()], program_id)` → explains PDA concept, why no private key, why seeds determine the address, why this is needed for program-owned accounts
- `#[account(init, payer = user, space = 8 + 32 + 200)]` → explains rent exemption, account initialization, why 8 bytes discriminator, how space is calculated
- `has_one = authority` → explains Anchor constraint system, why this prevents unauthorized access

---

### FEATURE 6: Fix Solana Issue (AI-Powered Error Fixer)

**What it does:**
User selects code that has an error or security issue, right-clicks and chooses "🛠 Fix Solana Issue." The AI analyzes the code for Solana-specific bugs and returns fixed code with an explanation.

**How it works:**

1. User selects problematic code
2. Right-click: "🛠 Fix Solana Issue"
3. AI analyzes selected code for:
   - Missing signer checks (account not marked as Signer)
   - Missing mut on accounts that are modified
   - Incorrect PDA derivation
   - Integer overflow (should use checked_add, checked_mul)
   - Missing account validation constraints
   - Incorrect space calculation for account initialization
   - Wrong account ownership assumptions
4. AI returns: the fixed code + a brief explanation of each fix
5. VS Code shows a diff view: original vs fixed
6. User clicks "Apply Fix" to replace the code

---

### FEATURE 7: Security Check (Static Analysis)

**What it does:**
Scans the entire open Rust file for common Solana security vulnerabilities and shows warnings inline in the editor, similar to a linter.

**How it works:**

1. User runs command: `Solana Copilot: Security Check`
2. OR: runs automatically on file save (configurable in settings)
3. Extension reads the full current .rs file
4. Sends to AI with prompt listing 9 vulnerability categories to check
5. AI returns JSON array of issues:

```json
[
  {
    "line": 42,
    "severity": "error",
    "message": "Missing signer check on 'authority' account — anyone can call this instruction",
    "fix": "Add 'signer' constraint or check authority.key() == expected_key"
  },
  {
    "line": 67,
    "severity": "warning",
    "message": "Unchecked arithmetic — use checked_add() to prevent overflow",
    "fix": "Replace 'count + 1' with 'count.checked_add(1).ok_or(ErrorCode::Overflow)?'"
  }
]
```

6. Extension uses `vscode.languages.createDiagnosticCollection` to show red/yellow underlines
7. Hovering over underlined code shows the message and suggested fix
8. Issues also appear in the VS Code Problems panel (bottom)

**Vulnerability categories checked:**

- Missing signer checks
- Missing mut constraints on modified accounts
- Unsafe arithmetic (no overflow protection)
- PDA validation missing (program not verified as owner)
- Account data not zeroed on close (reuse attacks)
- Missing account discriminator checks
- Insecure randomness
- Reentrancy patterns (CPI to untrusted programs)
- Missing documentation on security-critical sections

---

### FEATURE 8: PDA Generator (Utility Tool)

**What it does:**
A quick utility command. User provides a PDA name and seed description, and SolanaPilot generates the correct Anchor Rust code for the PDA derivation on both the program side (constraints) and client side (TypeScript).

**How it works:**

1. User runs command: `Solana Copilot: Generate PDA`
2. Input box: "PDA name (e.g., 'user_profile')"
3. Input box: "Seeds description (e.g., 'user wallet pubkey + string "profile"')"
4. AI generates:
   - Rust: `#[account(seeds = [b"profile", user.key().as_ref()], bump)]`
   - Rust struct field: `pub user_profile: Account<'info, UserProfile>`
   - TypeScript: `const [userProfile, bump] = PublicKey.findProgramAddressSync([Buffer.from("profile"), user.toBuffer()], programId);`
5. Code is inserted at cursor position in the active editor

---

### FEATURE 9: Devnet Deploy Helper Panel

**What it does:**
A persistent sidebar panel showing the current Solana development environment status and quick action buttons.

**Displays:**

- Current Solana CLI cluster (localnet / devnet / mainnet)
- Current wallet address (from `~/.config/solana/id.json`)
- Current wallet SOL balance on devnet
- Deployed program ID (if available in Anchor.toml)
- Link to program on Solana Explorer

**Quick action buttons:**

- [Switch to Devnet]
- [Airdrop 2 SOL]
- [Build Program]
- [Deploy Program]
- [View on Explorer]

**How it works:**

- TreeDataProvider registers a sidebar panel in VS Code
- Polls `solana balance` and `solana config get` via child_process.exec at 30-second intervals
- Buttons run corresponding CLI commands in the Solana Copilot terminal

---

## 5. PROJECT FILE STRUCTURE (Complete)

```
solana-copilot/
├── src/
│   ├── extension.ts              ← Entry point. Registers all commands, providers
│   ├── aiClient.ts               ← Anthropic/OpenAI API calls with retry + error handling
│   ├── fileWriter.ts             ← Writes AI-generated files to workspace
│   ├── terminalRunner.ts         ← Creates VS Code terminal, runs CLI commands
│   ├── contextBuilder.ts         ← Reads workspace files, builds AI context string
│   ├── systemPrompt.ts           ← SOLANA_SYSTEM_PROMPT + FRONTEND_PROMPT constants
│   ├── diagnostics.ts            ← Security check: diagnostic collection management
│   ├── pdaGenerator.ts           ← PDA generation utility
│   ├── sidebarProvider.ts        ← TreeDataProvider for devnet helper panel
│   ├── secretStorage.ts          ← API key management via VS Code SecretStorage
│   └── webview/
│       ├── chat.html             ← Chat panel UI (dark theme, Solana purple)
│       └── chat.js               ← Webview message handling, highlight.js rendering
├── templates/
│   ├── anchor-program.ts         ← Base Anchor program template strings
│   ├── frontend-react.ts         ← React app template strings
│   └── anchor-toml.ts            ← Anchor.toml template
├── assets/
│   └── icon.png                  ← Extension icon (Solana-themed)
├── package.json                  ← Extension manifest (commands, menus, config)
├── tsconfig.json
├── .vscodeignore
└── README.md
```

---

## 6. DATA FLOW — End to End

### Flow A: Generate + Deploy + Frontend (Full Happy Path)

```
User input: "build a voting program"
    ↓
extension.ts: registerCommand('solanaCopilot.generateProgram')
    ↓
contextBuilder.ts: buildWorkspaceContext() → reads open files
    ↓
aiClient.ts: callAI(userDescription, workspaceContext, expectJSON=true)
    → POST https://api.anthropic.com/v1/messages
    → model: claude-sonnet-4-20250514
    → system: SOLANA_SYSTEM_PROMPT (Solana expert context)
    → user: "Generate program for: [description]. Return JSON."
    ↓
AI Response: JSON with files array + deployCommands
    ↓
fileWriter.ts: writeFilesToWorkspace(files)
    → creates directories
    → writes each file
    → opens lib.rs in editor
    ↓
VS Code dialog: "Deploy to devnet?"
    ↓ [Deploy Now]
terminalRunner.ts: runDeploy(workspaceRoot)
    → opens "🚀 Solana Copilot" terminal
    → runs: solana config set --url devnet
    → runs: solana airdrop 2
    → runs: anchor build  (2-4 min Rust compile)
    → runs: anchor deploy
    → detects Program ID in output
    ↓
Notification: "✅ Deployed! ID: [id]" + [View on Explorer]
    ↓ [Generate Frontend]
extension.ts: registerCommand('solanaCopilot.generateFrontend')
    → reads target/idl/*.json (Anchor IDL)
    → reads Program ID from Anchor.toml
    ↓
aiClient.ts: callAI(FRONTEND_PROMPT with IDL + programId)
    ↓
fileWriter.ts: writes app/ directory with React files
    ↓
terminalRunner.ts: runs "cd app && npm install && npm run dev"
    ↓
Browser opens: localhost:5173 — live dApp connected to devnet program
```

### Flow B: Chat with Context

```
User: "why is my PDA not found?"
    ↓
chat.js (webview): sends { type: 'ask', text: "why is my PDA not found?" }
    ↓
extension.ts: panel.webview.onDidReceiveMessage handler
    ↓
contextBuilder.ts: reads active editor + open Rust files
    ↓
aiClient.ts: callAI(message, context)
    ↓
streaming response → sent back to webview as chunks
    ↓
chat.js: renders response with code highlighting + Insert buttons
```

---

## 7. SYSTEM PROMPT — CORE INTELLIGENCE LAYER

The system prompt is the most critical component. It is ~2,000 tokens and covers:

**Identity:** "You are SolanaPilot, an expert Solana AI copilot embedded in VS Code."

**Architecture knowledge section:** Full explanation of account model, PDAs, Sealevel, Anchor macros, SPL tokens, CPI — written so the AI always uses correct Solana patterns.

**Code generation rules:**

- Always Anchor (not native) unless asked
- Always #[error_code] for errors
- Always account validation constraints
- Always explain PDAs
- Always flag security risks in comments
- Complete, deployable code — never pseudocode

**Structured output format:** When generating full programs, return ONLY valid JSON in the specified schema. No markdown fences.

**Workspace context injection:** `{WORKSPACE_CONTEXT}` placeholder replaced at runtime with actual file contents.

---

## 8. API + RESOURCE USAGE

| Resource              | Provider          | Free Tier              | Usage in SolanaPilot                          |
| --------------------- | ----------------- | ---------------------- | --------------------------------------------- |
| AI API                | Gemini            | Hackathon: 250k tokens | All AI calls: chat, generate, security check  |
| Solana RPC            | Helius            | 1M credits/month       | Balance checks, IDL fetching, tx confirmation |
| Solana Devnet         | Solana Foundation | Free                   | Program deployment, testing                   |
| VS Code Extension API | Microsoft         | Free                   | All extension features                        |
| Anchor CLI            | Coral/Armani      | Free/OSS               | Build + deploy commands                       |
| Solana CLI            | Solana Labs       | Free/OSS               | Config, airdrop, wallet commands              |

**Token budget strategy:**

- Average chat response: ~2,000 tokens/call
- Full program generation: ~8,000 tokens/call
- Security check: ~3,000 tokens/call
- Frontend generation: ~6,000 tokens/call
- 250k budget ≈ 500+ program generations before exhaustion
- Rate limiting: max 50 API calls/hour enforced client-side

---

## 9. AI PROMPT PATTERNS (For Any AI Working on This Codebase)

### Pattern 1: Program Generation

```
System: SOLANA_SYSTEM_PROMPT
User: Generate a complete Anchor Solana program for: "{description}".
      Keep it simple: maximum 3 instructions, clear PDA usage.
      Return ONLY valid JSON in the specified schema. No markdown.
      Program name: snake_case, no spaces.
```

### Pattern 2: Chat with Context

```
System: SOLANA_SYSTEM_PROMPT (with {WORKSPACE_CONTEXT} filled in)
User: {user's question}
```

### Pattern 3: Frontend Generation

```
System: FRONTEND_PROMPT (with {IDL} and {PROGRAM_ID} filled in)
User: Generate the complete React frontend for this Anchor program.
      Return ONLY valid JSON. App must compile with npm install && npm run dev.
```

### Pattern 4: Code Explanation

```
System: SOLANA_SYSTEM_PROMPT
User: Explain this Solana code. Focus on WHY it's needed architecturally, not just what it does.
      Be concise. Highlight any security implications.
      Code: {selected_code}
      Context (surrounding lines): {context_lines}
```

### Pattern 5: Security Check

```
System: SOLANA_SYSTEM_PROMPT
User: Perform a security audit of this Solana program. Check for:
      missing signer checks, integer overflow, account confusion, unsafe CPI,
      missing constraints, improper account closing, reentrancy.
      Return JSON array: [{line, severity, message, fix}].
      File content: {file_content}
```

---

## 10. DEMO SCRIPT (Hackathon Showcase)

**Duration:** 3 minutes
**Setup:** Empty folder open in VS Code, SolanaPilot installed

**Minute 1 — Generate:**

- Open Command Palette → "Solana Copilot: Generate Smart Contract"
- Type: "A voting program where users create polls and cast votes on-chain"
- Watch files appear in explorer (lib.rs, Anchor.toml, Cargo.toml)
- lib.rs opens with complete Rust code visible

**Minute 2 — Deploy:**

- Click "Deploy Now" in dialog
- Terminal opens showing all commands running
- Point out: "No CLI knowledge needed — one click from code to deployed program"
- Anchor build completes → `anchor deploy` runs → Program ID appears
- Click "View on Explorer" → Solana Explorer shows deployed program

**Minute 3 — Frontend + Live Vote:**

- Run "Generate Frontend" command
- React files appear → `npm install && npm run dev` runs
- Browser opens with live dApp
- Connect Phantom wallet (devnet)
- Create a poll: "Best blockchain?" [Solana] [Ethereum]
- Click Vote → transaction confirms → vote count updates
- Show transaction on Solana Explorer with devnet program ID

---

## 11. WHAT IT IS NOT (Scope Boundaries)

- **Not a full IDE replacement** — it works inside VS Code, not as a standalone editor
- **Not mainnet-ready** — demo uses devnet; mainnet deployment requires user-funded wallet
- **Not a no-code platform** — it generates real Rust code that developers can read and modify
- **Not a token** — SolanaPilot is a developer tool, not a token or DeFi protocol
- **Not a security auditor** — security check is AI-powered heuristic, not a formal audit

---

## 12. KNOWN RISKS AND MITIGATIONS

| Risk                         | Mitigation                                                           |
| ---------------------------- | -------------------------------------------------------------------- |
| `anchor build` takes 3-5 min | Pre-compile before demo, show build in background                    |
| Devnet airdrop rate-limited  | Pre-fund devnet wallet with 10 SOL before demo day                   |
| AI returns invalid JSON      | Strip markdown fences, retry up to 3 times, fallback to chat display |
| Webview CSP blocks API fetch | All API calls from extension host (Node.js), not webview             |
| API key exposure             | Use VS Code SecretStorage, never hardcode in source                  |
| Context window overflow      | Truncate workspace context to 3000 chars per file, max 5 files       |

---

## 13. INSTALLATION + SETUP (User-Facing)

### Prerequisites (what user needs installed)

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Anchor via AVM
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest && avm use latest

# Node.js 18+ (for frontend generation)
```

### Install the extension

```bash
# From .vsix file (hackathon submission)
code --install-extension solana-copilot-1.0.0.vsix

# Or from VS Code Marketplace (post-hackathon)
# Search: "SolanaPilot"
```

### Configure API key

1. Open VS Code Command Palette (Ctrl/Cmd + Shift + P)
2. Run: "Solana Copilot: Set API Key"
3. Enter your Anthropic API key
4. Key is stored securely in VS Code's encrypted SecretStorage

---

## 14. COMPETITIVE POSITIONING

| Tool                               | What it does                                              | Gap vs SolanaPilot             |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------ |
| Ackee Blockchain VS Code Extension | Security analysis only, no AI, no code generation         | No generation, no deploy       |
| GitHub Copilot                     | Generic code completion, not Solana-aware                 | Hallucinates Solana code       |
| Cursor                             | AI IDE, not Solana-specific                               | No Solana context, no deploy   |
| Neur (Solana AI Hackathon winner)  | End-user Solana assistant (not dev tool)                  | Different audience             |
| NoahAI                             | No-code dApp builder (separate platform)                  | Not in VS Code, not extensible |
| SolanaPilot                        | Solana-aware AI in VS Code + generate + deploy + frontend | First to combine all           |

---

## 15. FUTURE ROADMAP (Post-Hackathon)

- **Mainnet deployment support** with cost estimation
- **Program upgrade assistant** — detects breaking changes before upgrade
- **Test generation** — generates Anchor TypeScript tests from program code
- **IDL import** — import any existing deployed program's IDL and generate a client
- **Multi-file refactor** — AI-powered codebase-wide Solana refactoring
- **Audit report generation** — professional security audit PDF from security check results
- **Integration with Solana Playground** — deploy directly from browser without local CLI
- **Team features** — shared context, collaborative coding sessions

---

_Document last updated: May 9, 2026_
_For questions or contributions: refer to this document as ground truth for all SolanaPilot features, architecture, and design decisions._
