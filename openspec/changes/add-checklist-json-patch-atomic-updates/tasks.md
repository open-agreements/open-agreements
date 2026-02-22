## 1. Patch Schemas
- [x] 1.1 Add `ChecklistPatchEnvelopeSchema` with `patch_id`, `expected_revision`, optional `mode`, optional `source_event`, and `operations`
- [x] 1.2 Add `CitationSchema` for patch-insertable citations (`text`, optional `link`, optional `filepath`)
- [x] 1.3 Add schema checks for operation/path/value compatibility
- [x] 1.4 Add `ChecklistPatchApplyRequestSchema` requiring `validation_id` and `patch`

## 2. Validation Engine
- [x] 2.1 Implement checklist patch dry-run validator (no mutation)
- [x] 2.2 Return structured diagnostics for invalid JSON/path/target resolution failures
- [x] 2.3 Validate post-patch checklist state with `ClosingChecklistSchema`
- [x] 2.4 Persist validation artifacts (`validation_id`, patch hash, revision binding, expiry)

## 3. Atomic Apply Engine
- [x] 3.1 Implement apply transaction with optimistic concurrency on `expected_revision`
- [x] 3.2 Enforce all-or-nothing commit semantics
- [x] 3.3 Add patch-level idempotency (`patch_id` replay returns no-op)
- [x] 3.4 Add conflict behavior for reused `patch_id` with different payload content
- [x] 3.5 Require valid, unexpired `validation_id` with matching patch hash before apply

## 4. Tooling Surface
- [ ] 4.1 Add checklist patch validate tool/command
- [ ] 4.2 Add checklist patch apply tool/command that requires `validation_id`
- [ ] 4.3 Add optional `PROPOSED` mode handling (stored proposal, no state mutation)
- [ ] 4.4 Document the agent workflow: write patch JSON -> validate -> apply

## 5. Evidence and Rendering
- [ ] 5.1 Persist citation metadata from patch operations
- [ ] 5.2 Render latest citation context in checklist outputs where applicable

## 6. Tests
- [x] 6.1 Unit tests for patch schema and validation edge cases
- [x] 6.2 Unit tests for no-guessing target resolution
- [ ] 6.3 Integration tests for atomicity and optimistic concurrency
- [ ] 6.4 Integration tests for idempotent replay and patch_id conflict handling
- [ ] 6.5 Integration tests for multi-operation patch from a single email source event
