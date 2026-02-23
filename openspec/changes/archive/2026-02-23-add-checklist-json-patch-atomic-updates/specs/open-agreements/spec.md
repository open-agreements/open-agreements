## ADDED Requirements

### Requirement: Atomic Checklist JSON Patch Transactions
The system SHALL support checklist updates via JSON patch envelopes applied atomically. If any operation in a patch is invalid, the system SHALL apply none of the operations.

#### Scenario: Apply valid multi-operation patch atomically
- **WHEN** a patch contains valid operations that update multiple checklist targets
- **THEN** the system applies all operations in one transaction
- **AND** checklist revision increments exactly once

#### Scenario: Reject invalid patch without partial mutation
- **WHEN** one operation in a patch is invalid
- **THEN** the patch is rejected
- **AND** no checklist state mutation is committed

### Requirement: Optimistic Concurrency for Patch Apply
Patch apply SHALL require `expected_revision` and SHALL reject apply when current revision differs.

#### Scenario: Expected revision mismatch
- **WHEN** a patch is submitted with stale `expected_revision`
- **THEN** apply fails with revision conflict
- **AND** no state mutation is committed

### Requirement: Dry-Run Patch Validation
The system SHALL provide dry-run patch validation that parses patch JSON, resolves targets, and validates post-patch checklist state without committing changes. Successful validation SHALL return a short-lived `validation_id` bound to the validated patch hash, checklist, and expected revision.

#### Scenario: Dry-run returns resolved plan without mutation
- **WHEN** a valid patch is submitted to validation
- **THEN** the response includes resolved operations, resulting-state validity, and `validation_id`
- **AND** checklist revision remains unchanged

### Requirement: Apply Requires Prior Successful Validation
The system SHALL require apply requests to include a valid, unexpired `validation_id` from a successful validation run for the same patch payload and checklist revision.

#### Scenario: Apply without validation_id is rejected
- **WHEN** an apply request omits `validation_id`
- **THEN** apply fails with a validation-required error
- **AND** no checklist state mutation is committed

#### Scenario: Apply with mismatched validation artifact is rejected
- **WHEN** an apply request includes a `validation_id` that does not match the submitted patch payload hash or expected revision
- **THEN** apply fails with a validation mismatch error
- **AND** no checklist state mutation is committed

### Requirement: Strict Target Resolution Without Guessing
Patch operations that require existing targets (for example replace/remove) SHALL fail when target paths or IDs do not resolve exactly.

#### Scenario: Unknown target path is rejected
- **WHEN** a replace operation references a non-existent issue ID path
- **THEN** validation fails with a structured target-resolution error

### Requirement: Patch-Level Idempotency
The system SHALL enforce patch-level idempotency using `patch_id`.

#### Scenario: Replay same patch_id does not duplicate effects
- **WHEN** the same patch payload is applied again with the same `patch_id`
- **THEN** the system returns an idempotent replay response
- **AND** checklist revision does not increment a second time

#### Scenario: Reused patch_id with different payload is rejected
- **WHEN** a patch is submitted with a previously used `patch_id` but different operations
- **THEN** apply fails with a patch-id conflict error

### Requirement: Flexible Evidence Citations in Patch Updates
Checklist updates SHALL support citations with required raw evidence text and optional link/filepath.

#### Scenario: Citation with text only
- **WHEN** a patch adds a citation containing only `text`
- **THEN** validation succeeds

#### Scenario: Citation with link and filepath
- **WHEN** a patch adds a citation containing `text`, `link`, and `filepath`
- **THEN** validation succeeds

### Requirement: Optional Proposed Patch Mode
Patch envelopes SHALL support optional `mode` with `APPLY` and `PROPOSED` values. `PROPOSED` mode SHALL not require approval workflow in v1.

#### Scenario: Proposed patch is stored but not applied
- **WHEN** a valid patch is submitted with `mode: PROPOSED`
- **THEN** the system stores the proposal and validation output
- **AND** checklist state revision remains unchanged
