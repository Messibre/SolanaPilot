# SolanaPilot Registry Web Explorer

The web explorer displays SolanaPilot registry entries with resilient data loading:

- It tries to read live accounts from Solana devnet.
- If live fetch fails for any reason, it falls back to local demo data.
- Search, sort, loading skeletons, empty states, and no-match states continue to work.

## Setup

### Prerequisites

- Node.js 18+
- A Solana RPC endpoint with devnet access

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` after the dev server starts.

## Environment Variable Configuration

Create `web-explorer/.env.local` and set the RPC endpoint:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

If this variable is omitted, the explorer uses the public Solana devnet RPC URL by default.

## Tech Stack & Architecture

The explorer is built with:

- Next.js App Router
- React and TypeScript
- `@coral-xyz/anchor` for account decoding
- `@solana/web3.js` for RPC access
- shadcn/ui-style components for the registry UI

Architecture overview:

- `components/registry/registry-explorer.tsx` owns the page state, loading flow, fallback behavior, and source badges
- `lib/solana.ts` reads live registry accounts, decodes the Anchor account data, and caches the result
- `lib/idl.json` provides the local registry IDL for client-side decoding
- `lib/mock-data.ts` provides the demo dataset used when live fetches fail

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Set RPC endpoint in `.env.local`:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

If unset, the app defaults to `https://api.devnet.solana.com`.

## Live data integration

Live fetch uses:

- `lib/solana.ts`: connection, Anchor program, account fetch/decode
- `lib/idl.json`: registry IDL used for account decoding
- `components/registry/registry-explorer.tsx`: UI state, retry, fallback badge

On fetch errors, the app shows a dismissible warning banner and keeps rendering demo data.

## Demo Flow

1. The page loads the registry explorer shell immediately.
2. The client fetches live registry accounts from Solana devnet.
3. If the fetch succeeds, the explorer shows live entries and marks the source as `Devnet Live`.
4. If the fetch fails or returns no data, the UI falls back to demo data and shows `Demo Data`.
5. Users can dismiss the warning banner or retry the fetch without losing the current browsing state.

## How It Works

- A read-only Anchor provider is created only when live fetching starts.
- The app computes the `ProgramEntry` account discriminator and uses it to filter `getProgramAccounts` RPC results.
- Each account is decoded with the local IDL and converted into the explorer's program card model.
- Results are cached in memory for 30 seconds to reduce repeated RPC calls.
- Any RPC or decoding failure maps to a user-friendly message, and the UI keeps working with fallback content.

## Deployment Guide for Vercel

This app can be deployed as a standalone Vercel project:

1. Set the project root to `web-explorer`.
2. Add `NEXT_PUBLIC_SOLANA_RPC_URL` in the Vercel environment settings.
3. Use the default build command: `npm run build`.
4. Deploy to production or preview as a standard Next.js application.

## Data source indicator

The header shows the active source:

- `Devnet Live` when on-chain fetch succeeds
- `Demo Data` when fallback is active

## Security notes

- No private key is exposed in the UI.
- The Anchor provider uses a generated read-only wallet object only for decoding context.
- No transactions are signed in the explorer fetch path.

## Performance

Live account fetches are cached in memory with a 30-second TTL to reduce repeated RPC calls during rapid re-renders.

## Stack

- Next.js (App Router)
- React + TypeScript
- `@solana/web3.js`
- `@coral-xyz/anchor`
- shadcn/ui components
