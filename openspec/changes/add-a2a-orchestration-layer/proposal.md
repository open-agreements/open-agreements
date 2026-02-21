# Change: Add A2A orchestration layer for multi-agent contract workflows

## Why

OpenAgreements currently exposes contract workflows through CLI and MCP tools,
but multi-step operations still rely on a single caller coordinating policy
checks, approvals, and execution. As governance and signature capabilities grow,
we need a first-class agent-to-agent orchestration layer that preserves
accountability across delegated actions.

## What Changes

- Add a new `contracts-a2a` capability for agent-to-agent orchestration.
- Make A2A the canonical orchestration interface for delegated contract tasks.
- Keep MCP as a compatibility bridge that calls the same orchestration core.
- Introduce a canonical task envelope containing actor identity, matter/document
  context, requested action, policy context, approval references, and
  idempotency key.
- Introduce a deterministic task lifecycle/state machine for delegated work.
- Add capability-scoped routing so a coordinator agent can delegate to
  workspace, governance, and signature specialist agents.
- Publish an agent discovery profile (Agent Card + contracts capability profile)
  describing supported actions, governance modes, evidence guarantees, and
  transport endpoints.
- Require governance context propagation and policy re-checks at execution time.
- Record immutable handoff and execution provenance in audit events.
- Add A2A operations plus CLI/MCP bridge commands to submit, inspect, retry,
  and cancel orchestration tasks.
- Add interoperability and parity tests so A2A and MCP produce equivalent task
  semantics and outcomes.
- Add a reference end-to-end flow for immediate utility:
  draft/redline -> policy check -> approvals -> signature prepare/send/status.

## Dependency and Sequencing

- This change depends on:
  - `add-authorization-approval-audit-core`
  - `add-signature-connectors`
- Before those are available, A2A can run in simulation mode for non-sensitive
  tasks only.

## Scope Boundaries

### In scope (v1)

- Local-first orchestration runtime and task store
- A2A server endpoints for submit/status/retry/cancel operations
- MCP bridge adapters mapped to the same orchestration core
- Task envelope schema and state machine
- Capability registry and delegation routing
- Agent Card and contracts capability profile publishing
- Governance/approval/audit context handoff
- Basic retry and dead-letter handling
- Interop/parity test harness with golden traces

### Out of scope (future changes)

- Cross-organization federated agent identity
- Global distributed queue infrastructure
- Billing/rate governance for third-party agent networks
- Provider-agnostic trust exchange beyond local policy assertions

## Impact

- Affected specs:
  - `contracts-a2a` (new capability)
  - `contracts-governance` (integration by dependency)
  - `contracts-signature` (integration by dependency)
- Affected code (planned):
  - new package under `packages/` for A2A runtime
  - A2A transport server and Agent Card/profile definitions
  - MCP bridge adapters that delegate into orchestration core
  - workspace/governance/signature adapters for delegated execution
  - CLI, A2A, and MCP command/tool additions for orchestration operations
  - interop/parity tests and replay fixtures
- Compatibility:
  - additive
  - existing direct CLI/MCP flows remain supported

## Critical Open Questions (Must Be Confirmed Before Final Approval)

- What is the authoritative agent identity mechanism for A2A in v1
  (for example: mTLS, signed assertions, or local trust-only mode)?
- Should policy checks on sensitive actions use
  snapshot-at-submit, re-evaluate-at-execution, or both (with conflict rules)?
- What is the idempotency collision scope: per actor, per matter, or global?
- Should retries be strictly orchestrator-driven, or may workers request retry
  with normalized reason codes?
- Which actions are mandatory in the v1 contracts capability profile, and which
  are optional extensions?
- What compatibility commitment is required between A2A and MCP
  (identical payloads vs normalized equivalent outcomes)?
