## Context

Contract workflow execution is moving from single-agent commands to delegated
multi-agent flows. Without a shared orchestration protocol, delegation creates
blind spots in policy enforcement and audit provenance. The A2A layer provides
a normalized transport and lifecycle for delegated work while preserving
governance controls.

## Goals

- Standardize delegated task envelopes across agent types.
- Guarantee deterministic task lifecycle transitions.
- Preserve actor/matter/policy/approval context across handoffs.
- Keep every delegation and outcome attributable in audit history.
- Reuse existing workspace, governance, and signature capabilities as workers.
- Make A2A the canonical delegated-task interface and keep MCP transport parity.
- Publish a machine-discoverable contracts capability profile for agents.

## Non-Goals

- Defining a universal external A2A internet standard in v1.
- Replacing direct CLI/MCP invocation for simple one-step tasks.
- Building global multi-tenant queue infrastructure.

## Decisions

- Decision: Introduce `contracts-a2a` orchestration package.
  - Why: isolates orchestration semantics from domain-specific worker logic.

- Decision: Use one orchestration core behind A2A and MCP transports.
  - Why: prevents behavior drift and keeps semantics stable across integrations.

- Decision: Treat A2A as canonical and MCP as compatibility bridge.
  - Why: maximizes long-term inter-agent interoperability while preserving near-term utility.

- Decision: Use canonical `TaskEnvelope` and `TaskExecutionRecord` schemas.
  - Why: ensures stable inter-agent contracts and easier replay/debugging.

- Decision: Enforce state-machine transitions.
  - Why: avoids ambiguous or out-of-order task updates.

- Decision: Require policy/approval references on sensitive actions.
  - Why: delegation must not bypass governance gates.

- Decision: Support idempotency keys and bounded retries with dead-letter state.
  - Why: improves reliability without hidden duplicate side effects.

- Decision: Publish Agent Card + contracts capability profile.
  - Why: enables discovery, capability negotiation, and trust-surface clarity.

- Decision: Add A2A/MCP parity tests using golden task traces.
  - Why: validates that compatibility bridges do not alter core semantics.

## Architecture Overview

Core components:
- `Coordinator`: receives task requests, validates envelope, routes to worker.
- `Capability Registry`: maps action types to worker capabilities.
- `Task Store`: append-only state transition records and current state index.
- `Worker Adapters`: wrappers around workspace/governance/signature commands.
- `Audit Bridge`: writes delegation and completion events into governance audit.
- `A2A Transport`: canonical agent-facing submit/status/retry/cancel interface.
- `MCP Bridge`: tool surface that forwards to the same coordinator APIs.
- `Agent Card Publisher`: emits contracts capability profile and version metadata.
- `Parity Harness`: runs transport-equivalence tests against golden traces.

Lifecycle:
1. `requested`
2. `validated`
3. `queued`
4. `in_progress`
5. `succeeded` | `failed` | `canceled` | `dead_letter`

Sensitive action flow:
1. Envelope includes actor, matter, resource, requested action.
2. Coordinator checks required policy/approval context.
3. Worker re-validates policy snapshot at execution time.
4. Outcome is persisted and audit-linked.

Transport behavior:
1. A2A submit and MCP submit call the same `Coordinator.submitTask`.
2. Status/retry/cancel map to shared orchestration APIs.
3. All transport responses include canonical task id, state, attempt metadata,
   and correlation/audit references.

## Risks and Mitigations

- Risk: policy drift between request and execution.
  - Mitigation: re-check effective policy on execution; record policy version.
- Risk: duplicated execution on retries.
  - Mitigation: idempotency key enforcement and side-effect guards.
- Risk: overly broad delegation permissions.
  - Mitigation: capability-scoped routing with explicit allowlists.
- Risk: troubleshooting complexity.
  - Mitigation: execution record timelines and replay tooling.
- Risk: divergence between A2A and MCP behavior.
  - Mitigation: shared core interfaces + mandatory parity suite in CI.
- Risk: ambiguous trust semantics in early federation scenarios.
  - Mitigation: explicit v1 trust model in Agent Card and enforced local-only defaults.

## Migration Plan

1. Create A2A domain model and state machine.
2. Add local task store and idempotency/retry handling.
3. Add worker adapters for workspace/governance/signature actions.
4. Add CLI/MCP surfaces for task submit/query/retry/cancel.
5. Add A2A transport and Agent Card/profile publishing.
6. Add audit bridge integration and replay diagnostics.
7. Add parity/interop suite and golden traces in CI.
8. Roll out with simulation mode defaults for high-risk actions until governance
   dependencies are active.

## Open Questions

- Identity and trust:
  - Which identity proof is mandatory in v1 for A2A task submission?
  - Is local trust mode explicitly allowed for bootstrap/demo deployments?
- Governance execution model:
  - Do we require both submit-time and execution-time policy checks for all sensitive actions?
  - How should conflicts be resolved if policy changed between submit and execution?
- Idempotency semantics:
  - Is key uniqueness scoped globally, per actor, or per matter?
  - What is the retention TTL for idempotency records?
- Retry ownership and semantics:
  - Are retries initiated only by coordinator, or can workers request retry intents?
  - Which failure reasons are retryable by default?
- Capability profile contract:
  - Which actions are required for baseline `contracts-a2a` compatibility?
  - How are optional action families versioned and negotiated?
- Transport parity contract:
  - Do we require byte-equivalent payloads across A2A and MCP, or semantic equivalence only?
  - What are accepted response-shape differences between transports?
- Rollout and compatibility:
  - Is `a2a submit` gated behind feature flags until governance dependency is merged?
  - What deprecation plan is required if existing MCP-only workflows diverge?
