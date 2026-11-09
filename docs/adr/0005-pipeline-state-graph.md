# ADR 0005: Explicit Finite State Graph for Autonomous Pipeline

- **Status**: Accepted
- **Date**: 2026-11-09
- **Deciders**: SolanaPilot Core Team

## Context

SolanaPilot orchestrates an end-to-end autonomous program development lifecycle: planning instructions and PDAs, generating Rust Anchor code, invoking `anchor build`, repairing compiler errors, executing `anchor test`, performing security review, and deploying to devnet.

Modern AI tooling often relies on open-ended multi-agent frameworks (LangChain, AutoGen, CrewAI) or unstructured prompt loops. In a smart contract development context where compilation errors and financial invariants are critical, unconstrained agent loops frequently hallucinate nonexistent APIs, spin in infinite retries, or mutate valid code unpredictably.

## Decision

We implement the autonomous pipeline as an **explicit, deterministic Finite State Machine (FSM)** in pure TypeScript (`src/agent/pipeline.ts`):
1. **Explicit States**: The pipeline transitions strictly across 8 deterministic stages:
   `PLAN → GENERATE → VALIDATE → WRITE → BUILD → FIX → TEST → REVIEW → AWAIT_CONFIRM → DEPLOY → REGISTER → DONE`.
2. **Bounded Compiler Repair**: If compilation fails at `BUILD`, the pipeline transitions to `FIX` if and only if `fixCount < 3`. After 3 attempts, it transitions unconditionally to `FAILED`.
3. **Isolated Stage Handlers**: Each stage (`stages/*.ts`) is an isolated, testable function receiving a typed state context.
4. **Full Serialization & Receipts**: The complete state graph, execution trace, token budget, and stage transitions are serializable to JSON (`agent/receipts.ts`).

## Alternatives Considered

1. **Third-Party Agent Frameworks (LangChain, AutoGen, CrewAI)**:
   - *Rejected*: Incurs massive dependency graphs (> 80 packages), non-deterministic control flow, heavy memory footprints, and difficulty integrating with VS Code's extension lifecycle.
2. **Unconstrained ReAct Loop for Entire Workflow**:
   - *Rejected*: High probability of non-terminating loops and high token consumption during complex Rust compilation failures.

## Consequences

- **Determinism**: Every pipeline step transition is predictable, verifiable, and observable.
- **Fail-Fast Safety**: Bounded fix loops prevent budget exhaustion and endless retries.
- **Zero Framework Lock-In**: Pure TypeScript implementation with zero external framework dependencies.
- **Auditable Receipts**: Full history of fixes and generated artifacts can be exported as an auditable receipt.

## Reverse This Decision If

Reverse this decision if hackathon builder requirements demand **> 5 dynamic branching workflows** that cannot be modeled as deterministic FSM states, or if the static state graph fails to support **> 15% of standard Anchor workspace architectures** without manual intervention.

