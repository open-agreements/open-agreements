## Context

AI will often receive incremental evidence from email threads that implies one or more
checklist changes. Those changes must be applied safely and traceably.

Examples:
- one email confirms two separate issues are resolved
- one email provides a signature page path for one signatory
- one email changes status and adds citation evidence

To support this, updates should be transactional (all-or-nothing), replay-safe, and
verifiable against source evidence.

## Goals / Non-Goals

- Goals:
  - Atomic JSON patching of checklist state
  - Required dry-run validation before apply
  - No-guessing path resolution (strict target existence)
  - Patch-level idempotency
  - Flexible citations (`text`, optional `link`, optional `filepath`)
  - Future-ready `PROPOSED` mode without enforcing approval today
  - Validation artifact handoff (`validation_id`) from validate to apply

- Non-Goals:
  - Mandatory approval workflow
  - Deep-link portability guarantees across email providers
  - Confidence score fields

## Decisions

### Decision: JSON patch format is canonical update envelope

Use JSON for patch payloads and JSON Patch-style operations. YAML/Markdown can be
used as human-facing drafts but MUST compile to canonical JSON before validation/apply.

### Decision: Apply uses optimistic concurrency on revision

Patch envelopes include `expected_revision`. Apply fails if current revision differs.
This prevents lost updates from concurrent writers.

### Decision: Dry-run is mandatory and apply requires a validation artifact

`validate` returns a short-lived `validation_id` tied to:
- checklist identifier
- `expected_revision`
- patch hash
- resolved target plan

`apply` MUST include `validation_id` and MUST reject if:
- `validation_id` is missing, expired, or unknown
- patch hash differs from validated payload
- checklist/revision no longer match validated preconditions

Apply still re-checks critical invariants to avoid TOCTOU issues.

### Decision: No guessing on target resolution

Replace/remove operations MUST target existing paths. Unknown IDs/paths fail fast.
No heuristic remapping is allowed at apply time.

### Decision: Idempotency is patch-level, not email-level

One email can imply multiple updates; those are represented by one patch with multiple
operations. Replaying the same `patch_id` must not duplicate effects.

### Decision: Optional `PROPOSED` mode in envelope

`mode: APPLY` (default) applies atomically.
`mode: PROPOSED` stores patch intent and validation output without mutating checklist
state. Approval remains optional/out-of-scope for v1.

## Patch Envelope (v1)

```json
{
  "patch_id": "patch_2026_02_22_thread44_v1",
  "expected_revision": 12,
  "mode": "APPLY",
  "source_event": {
    "provider": "outlook",
    "message_id": "AAMkAG...",
    "conversation_id": "AAQkAG..."
  },
  "operations": [
    {
      "op": "replace",
      "path": "/issues_by_id/iss_mfn/status",
      "value": "CLOSED"
    },
    {
      "op": "add",
      "path": "/issues_by_id/iss_mfn/citations/-",
      "value": {
        "text": "Opposing counsel replied: 'I agree.'",
        "link": "https://outlook.office365.com/mail/deeplink?ItemID=..."
      }
    }
  ]
}
```

Apply request shape (conceptual):

```json
{
  "validation_id": "val_01J....",
  "patch": {
    "...": "same payload that was validated"
  }
}
```

## Citation Schema (v1)

```json
{
  "text": "Opposing counsel replied: 'I agree.'",
  "link": "https://...",          
  "filepath": "/path/to/email.eml"
}
```

Rules:
- `text` required
- `link` optional
- `filepath` optional

## Validation and Apply Flow

1. Parse patch JSON and schema-validate envelope.
2. Verify `patch_id` shape and `expected_revision`.
3. Resolve each operation path against current checklist state.
4. Dry-run operations on an isolated copy.
5. Validate resulting checklist state with `ClosingChecklistSchema`.
6. Persist validation artifact (`validation_id`, checklist id, expected revision,
   patch hash, resolved targets, expiration).
7. If apply:
   - require `validation_id`
   - verify patch hash equals validated hash
   - re-check revision/preconditions
   - enforce idempotency (`patch_id` uniqueness)
   - commit all operations + revision increment + patch log append atomically.

Any failure in validation or apply preconditions yields no state mutation.

## Risks / Trade-offs

- Risk: JSON path authoring errors by LLMs.
  - Mitigation: explicit dry-run tool; strict error responses with resolved-path diagnostics.
- Risk: Required validate->apply handoff increases integration complexity.
  - Mitigation: make `validation_id` TTL practical (for example 10 minutes) and return
    clear apply errors that instruct callers to re-validate.
- Risk: Path brittleness if arrays are patched by index.
  - Mitigation: encourage ID-addressed paths (`..._by_id/...`) in patch surface.
- Risk: Provider deep links may be mailbox-specific.
  - Mitigation: `link` optional; allow `filepath` and textual evidence fallback.

## Open Questions

- Should we expose a canonical path map (`issues_by_id`, `entries_by_id`) as a first-class
  API response to reduce patch path mistakes?
- For `PROPOSED` mode, should storage include full diff preview or only envelope + validation output?
