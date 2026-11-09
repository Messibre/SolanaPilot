# ADR 0002: Progressive Disclosure Skills System

- **Status**: Accepted
- **Date**: 2026-11-03
- **Deciders**: SolanaPilot Core Team

## Context

The legacy `src/systemPrompt.ts` was a monolithic 307-line prompt injected into every single model call regardless of whether the user was asking about basic Anchor syntax, complex Token-2022 extensions, Cross-Program Invocations, or frontend wallet adapters. This wasted context window tokens (over 1,800 tokens per call), diluted model focus, and created ambiguity when unrelated domain constraints clashed.

## Decision

We replace the monolithic prompt with a progressive disclosure skills architecture:
1. **Base System Prompt** (`src/ai/prompts/base.ts`): Concise core identity and immutable security invariants (checked arithmetic, signer validation, PDA bumps, rent close refunds).
2. **Modular Skill Modules** (`src/agent/skills/`): Eight specialized skills (`anchor-core`, `pda`, `spl-token`, `token-2022`, `cpi`, `security-checklist`, `frontend-wallet`, `testing`). Each defines trigger keywords, relevant stages, workflow, schemas, failure rules, and security boundaries.
3. **Progressive Disclosure Loader** (`src/agent/skills/loader.ts`):
   - Injects a compact one-line summary table of all skills.
   - Dynamically injects full reference instructions ONLY for skills triggered by keywords in the user request or pipeline stage.
   - Enforces that skills cannot override or weaken the base security invariants.

## Alternatives Considered

1. **Retain Monolithic Prompt**: Simpler loader logic, but wastes >60% of prompt tokens on irrelevant instructions and risks model instruction distraction.
2. **External File Storage (dynamic disk reads)**: Dynamically reading markdown files from disk on every invocation introduces filesystem I/O latency and potential path traversal / tamper vectors.
3. **Pure Model Tool Retrieval**: Asking the model to call a retrieval tool to fetch skill documentation adds 1 extra round-trip latency to every turn.

## Consequences

- Token Efficiency: Base prompt size is reduced by >80% (~250 tokens vs ~1,875 tokens in the monolithic prompt).
- Target Focus: A token-focused prompt receives SPL Token guidance without cluttering context with unrelated PDA or CPI examples.
- Security Invariance: Safety rules in the base prompt cannot be overridden by dynamic skill content.

## Reverse This Decision If

Reverse this decision if:
1. More than 40% of typical user requests trigger 6 or more skills simultaneously (indicating domain boundaries are fragmented rather than modular), or
2. Progressive disclosure prompt assembly latency exceeds 25ms per invocation in production telemetry.

