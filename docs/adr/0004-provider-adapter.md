# ADR 0004: Native HTTP Provider Adapters without External SDKs

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: SolanaPilot Core Team

## Context

SolanaPilot supports multiple AI providers to maximize builder flexibility: Google Gemini, Anthropic Claude, OpenAI-compatible endpoints (OpenRouter, Groq, vLLM, local inference), and Ollama. Standard industry practice frequently defaults to installing official npm SDKs for each vendor (`@anthropic-ai/sdk`, `openai`, `ollama`).

However, external vendor SDKs carry significant drawbacks for a lightweight VS Code extension:
1. **Dependency Bloat**: Adding 3 separate vendor SDKs introduces over 45 transitive packages and increases extension bundle size by > 15 MB.
2. **Runtime Divergence**: Vendor SDKs often include conflicting polyfills or node-fetch shims that conflict with VS Code's extension host environment.
3. **API Drift**: Vendor SDKs frequently release breaking changes between minor versions, requiring ongoing maintenance for simple chat completions.
4. **Supply Chain Surface**: Each external package increases vulnerability exposure and audit overhead.

## Decision

We implement Anthropic, OpenAI-compatible, and Ollama providers using **native Node.js `fetch`** with **zero external SDK dependencies**, adhering to `Agent.md` §7:
1. **Uniform Interface**: All providers implement the internal `LlmProvider` contract (`src/ai/types.ts`).
2. **Minimal HTTP Wrappers**: Providers construct raw JSON payloads and consume streaming/non-streaming responses via Node 18+ global `fetch`.
3. **Standard Abort Signals**: Timeout enforcement is achieved uniformly via standard `AbortController` (default 30 seconds).
4. **Targeted Exception**: Only Google Gemini uses an external package (`@google/genai`) due to proprietary GRPC streaming protocol optimizations.

## Alternatives Considered

1. **Official Vendor SDKs (`openai`, `@anthropic-ai/sdk`)**:
   - *Rejected*: Incurs > 15 MB bundle overhead, 45+ transitive dependencies, and violates the repo's minimal dependency policy.
2. **Multi-Provider Meta Framework (Vercel AI SDK / LangChain)**:
   - *Rejected*: Massive architectural overhead, heavy abstraction layers, and opinionated pipeline models that conflict with our deterministic ReAct loop.

## Consequences

- **Lightweight Distribution**: Total extension package remains under 3 MB.
- **Zero Transitive Vulnerabilities**: No supply chain CVEs from third-party HTTP helpers or utility libraries.
- **Deterministic Offline Testing**: Mocking native `fetch` in Vitest is standardized, deterministic, and executes in < 50ms without SDK mock harnesses.
- **Simplicity**: Adding a new OpenAI-compatible endpoint requires < 80 lines of transparent TypeScript code.

## Reverse This Decision If

Reverse this decision if maintaining raw HTTP completion payloads requires **> 200 lines of boilerplate per provider**, or if **$\ge 2$ supported providers** permanently deprecate REST endpoints in favor of proprietary binary protocols that cannot be consumed via standard `fetch`.
