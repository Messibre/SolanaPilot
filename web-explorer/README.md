# SolanaPilot Web Explorer

A fast, developer-friendly web explorer for browsing SolanaPilot registry programs, accounts, and deployments on Solana devnet.

---

## 1. Features

- **Dense Registry Table**: High-information density table displaying program names, 32-byte base58 addresses, creator authorities, deployment counts, and version tags.
- **Theme Support**: First-class dark, light, and system theme modes following the 60/30/10 developer tool design system (WCAG AA compliant contrast).
- **Dual Authentication (Auth.js v5)**:
  - **Sign-In With Solana (SIWS)**: Cryptographic wallet sign-in with Phantom, Solflare, and Backpack using ed25519 signature checks (`tweetnacl`).
  - **GitHub OAuth**: Developer sign-in for linking hackathon repos.
- **Multi-Identity Account Linking**: Connect both a Solana wallet and GitHub profile to a single user account at `/profile`.
- **Security by Default**:
  - Route protection middleware for `/profile` and `/api/account/*`.
  - Security headers: CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - API handler enforcing 100 KB request size limits (returns HTTP 413) and strict Zod validation (returns HTTP 400).
  - Sliding-window rate limiting on sensitive authentication routes.
- **Observability**:
  - `/api/health`: Lightweight process liveness probe (HTTP 200).
  - `/api/ready`: Dependency readiness probe verifying environment configuration, PostgreSQL database reachability, and Solana RPC health (HTTP 200 or 503).
  - Automated smoke runner (`scripts/smoke.mjs`).

---

## 2. Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run full verification suite (typecheck + lint + unit tests)
npm run verify
```

Open `http://localhost:3000` in your browser.

---

## 3. Environment Variables

Environment variables are validated using strict Zod schemas defined in `lib/env.ts`.

Copy `.env.example` to `web-explorer/.env.local`:

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

> **Security Rule**: Database credentials and Auth secrets must **never** use the `NEXT_PUBLIC_` prefix.

---

## 4. Scripts & Commands

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev` | Start development server on port 3000 |
| `npm run build` | `next build` | Create production build |
| `npm run start` | `next start` | Start production server |
| `npm run verify` | `npm run typecheck && npm run lint && npm run test` | Full verification pipeline |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compilation check |
| `npm run lint` | `eslint .` | Lint rules verification |
| `npm run test` | `vitest run` | Run Vitest unit & integration test suite |
| `node scripts/smoke.mjs` | `node scripts/smoke.mjs [url]` | Run health, readiness, and negative checks |

---

## 5. Smoke Testing & Operational Runbook

To test a running build or deployment:

```bash
node scripts/smoke.mjs http://localhost:3000
```

The smoke script tests:
1. `GET /api/health` returns `200 OK`
2. `GET /api/ready` reports dependency readiness (HTTP 200 or 503)
3. Malformed POST requests return `4xx` (never `200`)
4. Oversized request bodies (> 100 KB) return `413 Payload Too Large`
5. Records probe latencies

For production deployment rollback criteria and incident handling, see `docs/release/rollback.md`.
