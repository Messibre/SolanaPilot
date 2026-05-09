# SolanaPilot Testing Guide

This guide is for the current tester build that includes four features:

- AI chat
- Smart contract generation
- Devnet deployment
- React frontend generation

## Prerequisites

Make sure testers have:

- VS Code 1.84 or newer
- Node.js 18 or newer
- Internet access
- A Gemini API key from https://aistudio.google.com

For deploy and frontend testing, also install:

- Rust
- Solana CLI
- Anchor CLI

## Install the Extension

Use the packaged `.vsix`:

```bash
code --install-extension solana-copilot-1.0.0.vsix
```

Then restart VS Code if needed.

## One-Time Setup

1. Open VS Code.
2. Open an empty folder or a Solana workspace to test in.
3. Press `Ctrl+Shift+P`.
4. Run `SolanaPilot: Set Gemini API Key`.
5. Paste the Gemini API key.

## Test 1: Chat

1. Press `Ctrl+Shift+S` or run `SolanaPilot: Open Chat`.
2. Confirm the chat panel opens.
3. Ask: `What are PDAs in Solana?`
4. Expect a Solana-specific answer.
5. Switch between `Ask` and `Agent` mode.
6. In Ask mode, try: `Generate a voting program`.
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
