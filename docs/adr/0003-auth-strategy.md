# ADR 0003: Authentication Strategy and Multi-Identity Data Model

- **Status**: Accepted
- **Date**: 2026-11-06
- **Deciders**: SolanaPilot Core Team

## Context

The SolanaPilot Web Explorer requires secure, flexible authentication for hackathon builders. Users need to authenticate using developer OAuth (GitHub) and cryptographic wallet signatures (Sign-In With Solana / SIWS), with the ability to link both providers to a single account to prove ownership of registered Solana programs. The authentication layer must operate securely, minimize database read amplification, prevent sensitive data leaks, and remain fully testable without requiring a live remote database.

## Decision

We adopt **Auth.js v5** (`next-auth@5.0.0-beta.x`) configured with a **JWT session strategy** backed by a **normalized multi-identity relational model** in PostgreSQL:

1. **Normalized Multi-Identity Model**:
   - `User`: Primary user entity with internal cuid/uuid, `createdAt`, and `updatedAt`.
   - `Identity`: Represents an authentication provider account (`provider`, `providerAccountId`, `userId`), with a composite unique index on `(provider, providerAccountId)` to prevent account duplication.
   - `WalletNonce`: Stores single-use, time-bounded nonces for SIWS authentication.
2. **Stateless JWT Sessions**:
   - Session tokens are signed/encrypted JWTs stored in HTTP-only, secure cookies.
   - The session token carries strictly the internal `userId` (`token.sub`) and an array of linked `providers` (`token.providers`).
   - No sensitive profile data (e.g. email, full name, avatar URLs, OAuth access/refresh tokens) is stored in the session payload.
3. **Decoupled Business Logic**:
   - Authentication lifecycle functions (`upsertUserAndIdentity`, `getUserProviderNames`, `shapeAuthSession`) interact through an explicit `AuthDatabase` interface, allowing complete test coverage using deterministic in-memory fake databases.

## Alternatives Considered

1. **Database Session Strategy (Prisma Adapter default)**:
   - *Rejected*: Requires a database query on every page load and API request. Adds latency and database connection pressure, particularly in serverless environments.
2. **Custom Hand-Rolled OAuth**:
   - *Rejected*: Increases security risk surface (CSRF mitigation, state parameter verification, PKCE flow, cookie encryption). Auth.js provides audited protocol handling.
3. **Proprietary Auth SaaS (Clerk / Supabase / Auth0)**:
   - *Rejected*: Incurs third-party vendor lock-in, recurring operational expenses, and violates the autonomous, self-contained architecture required for SolanaPilot hackathon teams.

## Consequences

- **Performance**: Edge-compatible, zero-DB-hit session validation for protected routes.
- **Privacy & Security**: Zero client-side leakage of external credentials or unnecessary PII.
- **Deterministic Testing**: Pure callback functions testable offline in Vitest in milliseconds without a PostgreSQL daemon.
- **Multi-Identity Extensibility**: Clean foundation for linking Solana wallet keys (T-065, T-066).

## Reverse This Decision If

Reverse this decision if any of the following numeric thresholds are breached:

1. **Session Size Bound**: Encoded JWT session cookies exceed **2,048 bytes** (> 50% of the 4,096-byte browser cookie limit) due to identity metadata expansion.
2. **Revocation Requirement**: Immediate server-side session revocation is mandated and an active token revocation blocklist exceeds **5% of total active concurrent users**.
3. **Upstream Incompatibility**: Auth.js v5 introduces **$\ge 3$ breaking, unresolvable API incompatibilities** with the installed Next.js version over a 6-month evaluation window.

