## 0. Decision closure (required before implementation)

- [ ] 0.1 Confirm v1 A2A identity/trust model and document accepted credential mechanisms
- [ ] 0.2 Confirm policy-check model for sensitive tasks (`submit-time`, `execution-time`, or both)
- [ ] 0.3 Confirm idempotency scope and retention policy
- [ ] 0.4 Confirm transport parity contract between A2A and MCP (semantic vs shape-level)
- [ ] 0.5 Confirm required vs optional actions for baseline `contracts-a2a` capability profile

## 1. Package and core scaffolding

- [ ] 1.1 Create `packages/contracts-a2a/` with build/test scripts and TypeScript config
- [ ] 1.2 Define core orchestration types: task envelope, execution record, worker capability, retry policy
- [ ] 1.3 Export stable orchestrator interfaces for coordinator, registry, and task store
- [ ] 1.4 Define canonical action taxonomy for v1 contract workflows (draft/redline, policy-check, approval, signature, executed-state transitions)

## 2. Task schema and lifecycle

- [ ] 2.1 Implement envelope validation including actor, matter/document context, action, and idempotency key
- [ ] 2.2 Implement deterministic state transitions (`requested -> validated -> queued -> in_progress -> terminal`)
- [ ] 2.3 Add invalid transition guards and structured error responses
- [ ] 2.4 Add task expiration and cancellation handling

## 3. Reliability controls

- [ ] 3.1 Implement idempotency enforcement for duplicate submissions
- [ ] 3.2 Implement bounded retries with backoff policy
- [ ] 3.3 Add dead-letter state and recovery/replay command paths
- [ ] 3.4 Add correlation identifiers and timeline records for replay/debuggability

## 4. Delegation routing

- [ ] 4.1 Implement capability registry mapping actions to worker adapters
- [ ] 4.2 Add workspace worker adapter
- [ ] 4.3 Add governance worker adapter
- [ ] 4.4 Add signature worker adapter
- [ ] 4.5 Add capability allowlist enforcement per worker

## 5. Governance and audit integration

- [ ] 5.1 Require policy context and approval references for sensitive actions
- [ ] 5.2 Re-check policy context at execution time for sensitive actions
- [ ] 5.3 Write audit events for task submission, delegation, retry, failure, and completion
- [ ] 5.4 Persist policy/approval references in execution records

## 6. A2A transport and discovery profile

- [ ] 6.1 Add A2A endpoints for submit/status/retry/cancel that call shared coordinator APIs
- [ ] 6.2 Publish Agent Card and contracts capability profile (actions, governance modes, evidence semantics, version metadata)
- [ ] 6.3 Add capability/version negotiation guards for unsupported action/profile versions

## 7. MCP bridge and CLI compatibility

- [ ] 7.1 Add CLI commands for `a2a submit`, `a2a status`, `a2a retry`, and `a2a cancel`
- [ ] 7.2 Add MCP tools for task submit/query/retry/cancel with structured outputs
- [ ] 7.3 Ensure MCP and CLI paths call the same orchestration core APIs
- [ ] 7.4 Keep direct non-orchestrated command paths backward-compatible

## 8. Interop tests and reference workflow

- [ ] 8.1 Add unit tests for envelope validation, state transitions, idempotency, and retry logic
- [ ] 8.2 Add integration tests covering delegated workspace/governance/signature flows
- [ ] 8.3 Add A2A/MCP parity tests using golden task traces
- [ ] 8.4 Add a reference end-to-end workflow test (`draft/redline -> policy-check -> approvals -> signature status`)
- [ ] 8.5 Add docs for orchestration model, simulation mode, trust model, and operational runbook

## 9. Validation

- [ ] 9.1 Run `openspec validate add-a2a-orchestration-layer --strict`
- [ ] 9.2 Run A2A package tests and build checks
- [ ] 9.3 Run governance/signature/workspace regression checks
