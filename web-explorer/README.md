# SolanaPilot Registry Web Explorer

The web explorer displays SolanaPilot registry entries with resilient data loading:

- It tries to read live accounts from Solana devnet.
- If live fetch fails for any reason, it falls back to local demo data.
- Search, sort, loading skeletons, empty states, and no-match states continue to work.

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
