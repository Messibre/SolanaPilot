# solanapilot-explorer

Web explorer for browsing SolanaPilot registry programs, accounts, and deployments on Solana devnet.

## Quick Start

```bash
# install dependencies
npm install

# run development server
npm run dev

# run full test & verification suite (typecheck, lint, test)
npm run verify
```

Open `http://localhost:3000` to browse the registry.

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run verify` | `npm run typecheck && npm run lint && npm run test` | Full verification suite |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compiler check |
| `npm run lint` | `eslint .` | ESLint rules check |
| `npm run test` | `vitest run` | Unit test suite via Vitest |
| `npm run dev` | `next dev` | Local development server |
| `npm run build` | `next build` | Next.js production build |
| `npm run start` | `next start` | Start production server |

## Environment Variables

Environment variables are validated using strict Zod schemas defined in `lib/env.ts`.

See `.env.example` for starter values:

```bash
# Server-only variables (never expose to the browser, never use NEXT_PUBLIC_ prefix)
DATABASE_URL="postgresql://user:password@localhost:5432/solanapilot?sslmode=require"
AUTH_SECRET="your-32-byte-random-auth-secret-string"
AUTH_GITHUB_ID="your-github-oauth-client-id"
AUTH_GITHUB_SECRET="your-github-oauth-client-secret"
AUTH_URL="http://localhost:3000"
SOLANA_RPC_URL="https://api.devnet.solana.com"
NODE_ENV="development"

# Public variables (accessible in browser client bundle)
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
NEXT_PUBLIC_SOLANA_NETWORK="devnet"
```

### Server vs. Client Variables
- **Server Variables**: Database credentials and authentication secrets must **never** be prefixed with `NEXT_PUBLIC_`. The validator immediately throws if a secret is configured with `NEXT_PUBLIC_`.
- **Public Variables**: Only client-safe, key-less variables (such as network name or public RPC endpoint) may use `NEXT_PUBLIC_`.

## Data Modes

The explorer supports two operational data modes:

1. **Devnet Live Mode**: Connects to Solana devnet via RPC (`SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL`) and decodes on-chain program accounts using Anchor 0.31 IDL.
2. **Demo Data Mode**: When devnet RPC is unavailable, network requests fail, or no programs are registered yet, the UI explicitly displays an amber **Demo Data Mode** status banner with a manual "Retry live fetch" action. Mock data is never used as a silent fallback.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, CSS variables
- **Solana**: `@solana/web3.js`, `@coral-xyz/anchor`
- **Validation**: `zod`
- **Testing**: `vitest`
