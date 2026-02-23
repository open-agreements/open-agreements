# Change: Add Atomic JSON Patch Updates for Closing Checklists

## Why

The closing checklist is now modeled as structured state, but updates still depend on
regenerating from full payloads. That is brittle for event-driven workflows where AI
needs to apply small, traceable updates from new evidence (for example, an email
message from opposing counsel saying "I agree").

We need an atomic update mechanism that allows:

- deterministic, partial state updates
- strict no-guessing target resolution
- required dry-run validation before apply
- patch-level idempotency
- evidence citations that humans can verify (raw text + optional link/filepath)

This enables AI-assisted checklist maintenance while preserving auditability and
human trust.

## What Changes

- Add a checklist patch transaction contract using JSON Patch-style operations.
- Add checklist state revisioning and optimistic concurrency (`expected_revision`).
- Add dry-run patch validation that resolves targets and validates post-patch state
  without mutating persisted checklist state.
- Add a validation artifact (`validation_id` + patch hash) that `apply` MUST require.
- Add atomic patch apply that re-validates and either commits all operations or none.
- Add patch-level idempotency (`patch_id`) so retries do not duplicate updates.
- Add flexible citation payloads for evidence:
  - required `text`
  - optional `link`
  - optional `filepath`
- Add optional `mode: PROPOSED | APPLY` support to allow future human approval
  workflows without requiring approval in v1.

## Agent Workflow (v1)

The expected LLM flow is:

1. Build patch JSON in a temp file.
2. Call patch validate (dry run).
3. Ensure the response reports:
   - valid JSON envelope
   - all targets resolved (no unresolved paths/IDs)
   - post-patch checklist schema validity
4. Call patch apply with the returned `validation_id`.

`apply` MUST reject requests that do not reference a successful validation result.

## Scope Boundaries

### In scope
- Closing checklist patch contract and validation/apply semantics
- Validate-first-then-apply enforcement
- Atomicity, optimistic concurrency, and idempotency rules
- Evidence citation model for patch-generated updates
- Agent workflow requirements for no-guessing target resolution

### Out of scope
- Mandatory human approval gating
- Confidence scoring fields
- Provider-agnostic deep-link normalization
- Full generic patching for all template types (design should remain extensible)

## Impact

- Affected specs: `open-agreements`
- Affected code (expected):
  - `src/core/checklist/` patch engine + schemas
  - checklist persistence layer (revision + patch log)
  - checklist CLI/MCP tools for validate/apply patch
  - checklist rendering integration for citation display
- Compatibility: additive
