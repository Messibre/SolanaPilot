# SolanaPilot Registry Web Explorer

This web application displays registry entries for programs generated through SolanaPilot.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `NEXT_PUBLIC_REGISTRY_LIVE=true` enables live on-chain fetch mode
- `RPC_URL` or `NEXT_PUBLIC_RPC_URL` sets the Solana RPC endpoint

If live mode is disabled, the UI can fall back to static/demo data depending on the current app implementation.

## Deploy

```bash
vercel
```

## Stack

- Next.js 15 (App Router)
- React 18
- TypeScript
- Solana web3 + Anchor client libraries

## Notes

- Registry program ID is managed in application code and/or IDL files, not this README.
- Keep IDL and program address synchronized across extension and explorer builds.
