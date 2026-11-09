/**
 * Frontend Wallet & UI skill for SolanaPilot.
 * Strictly adheres to Agent.md §10.
 * Boundary constraint: Zero vscode imports allowed.
 */

import type { Skill } from "./types";

export const FRONTEND_PROMPT = `
You are an expert Solana frontend developer.
Generate a complete Vite + React + TypeScript frontend for an Anchor program.
Use this fixed stack only: Vite, React 18, TypeScript, wallet-adapter, Anchor client.
Do not ask the user to choose a frontend framework or stack.
Do not ask the user follow-up questions.
Do not provide a plan, explanation, or summary.
Do not mention alternative frameworks.
Reference: https://solana.com/developers and https://superteam.fun/build/developer-tools

REQUIRED PACKAGES (use EXACT PINNED VERSIONS in package.json):
- @coral-xyz/anchor@0.30.1: Anchor TypeScript client for RPC calls
- @solana/web3.js@1.91.0: Core Solana web3 SDK
- @solana/wallet-adapter-react@0.15.35: Wallet connection framework
- @solana/wallet-adapter-phantom@0.9.24: Phantom wallet support
- react@18.2.0, react-dom@18.2.0: UI framework
- typescript@5.3.3: Type safety
- vite@5.0.0: Fast build tool
- tailwind-css@3.3.6: Styling (optional, use only if needed)

IMPORTANT: Use exact versions (not ^, not ~) to prevent supply-chain drift and compatibility issues.
`;

export const frontendWalletSkill: Skill = {
  id: "frontend-wallet",
  name: "Frontend Wallet & UI Integration",
  description: "Vite + React 18 + Solana Wallet Adapter integration, instruction forms, devnet status badge, and IDL client decoding.",
  triggerKeywords: ["frontend", "wallet", "wallet-adapter", "react", "phantom", "ui", "vite"],
  relevantStages: ["PLAN", "GENERATE"],
  workflow: `1. Setup WalletContext with ConnectionProvider and WalletProvider (autoConnect = false)
2. Wrap app with WalletModalProvider and render WalletMultiButton
3. Instantiate Anchor Program client from IDL and connected wallet provider
4. Render interactive forms for IDL instructions with transaction status alerts`,
  expectedOutputSchema: "Complete Vite + React 18 frontend files with Anchor client hooks and transaction feedback.",
  failureRules: [
    "Never force autoConnect=true without user consent",
    "Never use dangerouslySetInnerHTML without sanitization",
    "Never expose private keys or mainnet RPC endpoints in client code",
  ],
  securityBoundary: [
    "Default RPC must target Solana devnet or localhost",
    "All client transaction requests must be explicitly signed by the connected wallet",
  ],
  content: `### Frontend Wallet Adapter Architecture
- Use @solana/wallet-adapter-react and @coral-xyz/anchor.
- Wrap application with ConnectionProvider, WalletProvider, and WalletModalProvider.
- Derive instruction accounts and submit transactions via program.methods.myInstruction(...).accounts(...).rpc().`,
};

