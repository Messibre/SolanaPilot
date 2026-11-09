# ADR 0001: Modular Architecture and VS Code Boundary Separation

- **Status**: Accepted
- **Date**: 2026-11-03
- **Deciders**: SolanaPilot Core Team

## Context

The initial SolanaPilot codebase coupled AI generation, rate limiting, and business logic directly with the `vscode` API throughout `src/`. This created tight coupling, prevented offline unit testing without heavy mocking harnesses, and made it difficult to extend the pipeline or swap providers.

## Decision

We separate the codebase into clearly defined architectural tiers according to `Agent.md` §6:
1. **Core & Security**: `src/core` (errors, logger, config, validation) and `src/security` (redact, pathGuard, urlGuard, injectionScreen). Zero `vscode` imports.
2. **AI Provider Layer**: `src/ai` (types, gateway, structured outputs, providers). Zero `vscode` imports.
3. **Agent Pipeline**: `src/agent` (loop, budget, tools, stages, skills). Zero `vscode` imports.
4. **Platform & Workspace**: `src/deploy`, `src/registry`, `src/workspace`.
5. **UI & Host Adapters**: `src/chat`, `src/vscodeAdapters`, and `src/extension.ts`. These are the only modules permitted to import `vscode`.

All external dependencies and host capabilities required by core/agent modules are passed via plain interfaces and dependency injection.

## Alternatives Considered

1. **Keep flat directory structure**: Lower initial reorganization overhead, but retains architectural drift and prevents reliable offline testing.
2. **Multi-package monorepo (npm workspaces)**: High tooling complexity and build overhead for an extension project at hackathon scale.

## Consequences

- Offline testability: Core logic and agent loops run deterministically in Vitest under 2 seconds.
- Clean boundaries: Lint rules strictly enforce that no core/agent file imports `vscode`.
- Progressive migration: Legacy modules can be systematically phased out into the new modules.

## Reverse This Decision If

Reverse this decision if more than 3 distinct files inside `src/core/`, `src/security/`, `src/ai/`, or `src/agent/` require direct `vscode` imports that cannot be cleanly decoupled via dependency injection.
