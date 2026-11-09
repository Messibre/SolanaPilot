# SolanaPilot Security Policy & Threat Model

SolanaPilot operates with autonomous code generation, on-chain transactions, and external AI providers. Security is designed defensively from first principles: all external content (user prompts, model completions, file reads, and web fetches) is treated as untrusted data.

---

## 1. Threat Model & Mitigations

```mermaid
flowchart TD
    subgraph Threats["Identified Threat Vectors"]
        T1["1. Prompt & Jailbreak Injection"]
        T2["2. Server-Side Request Forgery (SSRF)"]
        T3["3. Secret Leakage & Key Exposure"]
        T4["4. Workspace Escape & Malicious File Write"]
        T5["5. Mainnet Transaction Execution"]
        T6["6. Web Explorer SIWS Replay & Abuse"]
    end

    subgraph Defenses["Architectural Countermeasures"]
        D1["injectionScreen.ts (Regex/Heuristic Screen)"]
        D2["urlGuard.ts (Blocked Ranges, Strict HTTPS)"]
        D3["VS Code SecretStorage + redact.ts + check-secrets"]
        D4["pathGuard.ts (Canonical Path Sandboxing)"]
        D5["devnetGuard in runner.ts (solana config check)"]
        D6["Single-use Nonces, Rate Limiter, 100KB Payload Cap"]
    end

    T1 --> D1
    T2 --> D2
    T3 --> D3
    T4 --> D4
    T5 --> D5
    T6 --> D6
```

---

## 2. In-Depth Countermeasure Specifications

### 2.1 Prompt & Indirect Injection (`src/security/injectionScreen.ts`)
- **Risk**: Malicious instructions embedded in prompts, dependency files, or documentation instructing the model to exfiltrate secrets, execute destructive shell commands, or disregard safety constraints.
- **Defense**: All external input is processed through `screenPrompt(text)`. Patterns matching system overrides ("ignore previous instructions", "system prompt reveal", "exfiltrate", raw role delimiters) are flagged. When tools retrieve external documentation, output is enclosed in defensive data brackets so the model treats it strictly as content, not instructions.

### 2.2 Server-Side Request Forgery (`src/security/urlGuard.ts`)
- **Risk**: Agent tool `fetch_docs` coerced into probing internal ports, AWS/GCP cloud metadata services (`169.254.169.254`), or loopback services.
- **Defense**:
  - Outbound requests require strict HTTPS (`https://`).
  - Private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local, broadcast, and cloud metadata addresses are blocked.
  - Decimal, octal, hexadecimal, and IPv6-mapped IP representations are resolved and blocked before request initiation.
  - Embedded credentials (`https://user:pass@host`) are rejected.
  - **Loopback Exception**: Localhost loopbacks (`http://127.0.0.1`, `http://localhost`) are strictly forbidden for agent tools and allowed **only** for the local Ollama provider.

### 2.3 Secret Hygiene & Leakage Prevention (`src/security/redact.ts`)
- **Risk**: Private keypairs, wallet seed phrases, and AI API keys accidentally committed to git or exposed in logs, receipts, or chat webview messages.
- **Defense**:
  - Extension API keys reside in VS Code `SecretStorage`, never in settings JSON or disk files.
  - Explorer secrets (`DATABASE_URL`, `AUTH_SECRET`) are server-side only and never prefixed with `NEXT_PUBLIC_`.
  - All log entries pass through `redact(text)` before serialization, scrubbing Solana base58 private keys, JWTs, OAuth tokens, and bearer secrets.
  - CI verification runs an automated AST/regex secret scanner (`npm run check:secrets`) across all tracked files.

### 2.4 File System Sandboxing (`src/security/pathGuard.ts`)
- **Risk**: Path traversal attacks (`../../etc/passwd`) modifying critical system files or overwriting repository configurations.
- **Defense**:
  - All file operations (`read_file`, `write_file`, `edit_file`) are canonicalized using `path.resolve` and validated against the workspace root.
  - Access to sensitive files and directories is permanently blocked:
    - `.git/`
    - `.env*`
    - `id.json` and `*keypair*.json`
    - `.ssh/`
    - `node_modules/`

### 2.5 Devnet Protection (`src/deploy/runner.ts`)
- **Risk**: Automated deployment workflows accidentally deploying to Solana mainnet, risking real user funds or key depletion.
- **Defense**:
  - Before executing any transaction-signing CLI command, the deployment runner executes `solana config get`.
  - The active RPC URL is validated to contain `devnet`, `localhost`, or `127.0.0.1`. If mainnet or an unrecognized URL is detected, execution aborts with a fatal `AppError` before transaction submission.

### 2.6 Web Explorer Security (`web-explorer/lib/`)
- **SIWS Cryptographic Verification**: Sign-In With Solana validates domain name, URI, expiration timestamp, and uses `tweetnacl.sign.detached.verify` to check 64-byte ed25519 signatures.
- **Atomic Nonce Consumption**: Nonces are stored in PostgreSQL and consumed atomically via SQL update with conditions (`usedAt: null, expiresAt > NOW()`), completely eliminating race conditions and replay attacks.
- **API Defense in Depth**:
  - Payloads exceeding 100 KB are rejected with HTTP 413.
  - Input bodies are strictly parsed with Zod schemas, returning HTTP 400 on failure (never 200).
  - Middleware enforces security headers:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `Content-Security-Policy: frame-ancestors 'none';`

