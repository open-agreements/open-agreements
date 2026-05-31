# closing-checklist Specification

## Purpose
Defines the closing checklist capability after restructuring the legacy open-agreements monolith.

## Requirements
### Requirement: Document-First Closing Checklist Data Model
The system SHALL model closing checklists with canonical documents as the primary records and stage-scoped checklist entries as render rows. IDs SHALL be stable string identifiers and SHALL NOT require UUID format.

#### Scenario: [OA-CKL-001] Document and checklist entry use stable string IDs
- **WHEN** a checklist payload defines `document_id: "escrow-agreement-executed"` and `entry_id: "entry-escrow-closing"`
- **THEN** validation accepts those IDs as valid stable strings
- **AND** validation does not require UUID-only formats

#### Scenario: [OA-CKL-002] Checklist entry references unknown document ID
- **WHEN** a checklist entry references a `document_id` not present in canonical documents
- **THEN** validation fails with a structured error identifying the missing reference

#### Scenario: [OA-CKL-003] One document maps to at most one checklist entry
- **WHEN** two checklist entries reference the same `document_id`
- **THEN** validation fails with a structured duplicate-mapping error

### Requirement: Stage-First Nested Lawyer Rendering
The system SHALL render closing checklists grouped by stage (`PRE_SIGNING`, `SIGNING`, `CLOSING`, `POST_CLOSING`) with nested rows based on parent entry relationships.

#### Scenario: [OA-CKL-004] Checklist renders in canonical stage order
- **WHEN** checklist entries are provided across all four stages
- **THEN** rendered output groups rows under those stage headers in canonical order

#### Scenario: [OA-CKL-005] Child entry is rendered beneath parent entry
- **WHEN** an entry includes `parent_entry_id` referencing another entry in the same stage
- **THEN** rendered output displays the child row indented beneath the parent row

### Requirement: Stable Sort Key and Computed Display Numbering
Checklist entries SHALL include a stable non-positional `sort_key`. Rendered row numbering (`1`, `1.1`, `1.1.1`) SHALL be computed at render time from the sorted nested tree.

#### Scenario: [OA-CKL-006] Inserting an entry does not require renumbering stored IDs
- **WHEN** a new entry is inserted between existing entries by assigning an intermediate `sort_key`
- **THEN** existing `entry_id` and `document_id` values remain unchanged
- **AND** rendered numbering updates to reflect the new order

### Requirement: Optional Document Labels
Canonical documents SHALL support optional freeform `labels[]` metadata.

#### Scenario: [OA-CKL-007] Document carries optional labels
- **WHEN** a document includes labels like `phase:closing` and `priority:high`
- **THEN** validation accepts the labels
- **AND** checklist rendering remains valid whether labels are present or absent

### Requirement: Named Signatory Tracking with Signature Artifacts
The system SHALL track signatories as explicit named entries with per-signatory status on checklist entries. The renderer SHALL display signer identity and signer status, not only aggregate counts. Signatories SHALL support optional signature artifact locations.

#### Scenario: [OA-CKL-008] Partially signed document shows missing signer identity
- **WHEN** one checklist entry has three expected signatories and one has not signed
- **THEN** rendered output identifies the specific signatory marked pending
- **AND** rendered output does not collapse the state to only a numeric fraction

#### Scenario: [OA-CKL-009] Signatory stores signature artifact location
- **WHEN** a signatory includes a signature artifact with `uri` or `path` and optional `received_at`
- **THEN** validation accepts the artifact metadata
- **AND** rendered output can include the artifact location context

### Requirement: Minimal Citation Support
Checklist entries SHALL support optional minimal citation metadata as a list of reference objects.

#### Scenario: [OA-CKL-010] Entry includes simple citation reference
- **WHEN** an entry includes `citations: [{ "ref": "SPA §6.2(b)" }]`
- **THEN** rendered output includes that citation with the corresponding row

### Requirement: Document-Linked and Document-Less Checklist Entries
Checklist entries MAY exist without `document_id` to support pre-document or administrative tasks. Action items and issues SHALL link to zero or more canonical documents via `related_document_ids`.

#### Scenario: [OA-CKL-011] Checklist entry with no document for pre-document task
- **WHEN** an entry is created for a task like ordering a good standing certificate and omits `document_id`
- **THEN** validation succeeds
- **AND** the entry renders normally in its stage section

#### Scenario: [OA-CKL-012] Unlinked action item is rendered in fallback section
- **WHEN** an action item has no related document IDs
- **THEN** rendered output includes the item in a dedicated unlinked section

### Requirement: Simplified Issue Lifecycle
Issues SHALL use a simplified lifecycle with only `OPEN` and `CLOSED` statuses.

#### Scenario: [OA-CKL-013] Issue with unsupported granular status is rejected
- **WHEN** an issue status is provided as `AGREED_IN_PRINCIPLE`
- **THEN** validation fails with a status-enum error

### Requirement: Standalone Working Group Document
The system SHALL treat the working group roster as a standalone document flow rather than an embedded closing checklist table.

#### Scenario: [OA-CKL-014] Checklist references working group roster document
- **WHEN** a user includes a working group list in the deal packet
- **THEN** the closing checklist represents it as a document row with link/reference metadata
- **AND** the checklist renderer does not require an embedded working-group table block

### Requirement: Legacy Checklist Payload Rejection
The system SHALL reject the previous flat checklist payload shape once the document-first model is enabled.

#### Scenario: [OA-CKL-015] Legacy flat payload submitted to checklist creation
- **WHEN** input includes only top-level legacy flat arrays and omits required document-first checklist entry structures
- **THEN** validation fails with machine-readable contract errors

### Requirement: Atomic Checklist JSON Patch Transactions
The system SHALL support checklist updates via JSON patch envelopes applied atomically. If any operation in a patch is invalid, the system SHALL apply none of the operations.

#### Scenario: [OA-CKL-016] Apply valid multi-operation patch atomically
- **WHEN** a patch contains valid operations that update multiple checklist targets
- **THEN** the system applies all operations in one transaction
- **AND** checklist revision increments exactly once

#### Scenario: [OA-CKL-017] Reject invalid patch without partial mutation
- **WHEN** one operation in a patch is invalid
- **THEN** the patch is rejected
- **AND** no checklist state mutation is committed

### Requirement: Optimistic Concurrency for Patch Apply
Patch apply SHALL require `expected_revision` and SHALL reject apply when current revision differs.

#### Scenario: [OA-CKL-018] Expected revision mismatch
- **WHEN** a patch is submitted with stale `expected_revision`
- **THEN** apply fails with revision conflict
- **AND** no state mutation is committed

### Requirement: Dry-Run Patch Validation
The system SHALL provide dry-run patch validation that parses patch JSON, resolves targets, and validates post-patch checklist state without committing changes. Successful validation SHALL return a short-lived `validation_id` bound to the validated patch hash, checklist, and expected revision.

#### Scenario: [OA-CKL-019] Dry-run returns resolved plan without mutation
- **WHEN** a valid patch is submitted to validation
- **THEN** the response includes resolved operations, resulting-state validity, and `validation_id`
- **AND** checklist revision remains unchanged

### Requirement: Apply Requires Prior Successful Validation
The system SHALL require apply requests to include a valid, unexpired `validation_id` from a successful validation run for the same patch payload and checklist revision.

#### Scenario: [OA-CKL-020] Apply without validation_id is rejected
- **WHEN** an apply request omits `validation_id`
- **THEN** apply fails with a validation-required error
- **AND** no checklist state mutation is committed

#### Scenario: [OA-CKL-021] Apply with mismatched validation artifact is rejected
- **WHEN** an apply request includes a `validation_id` that does not match the submitted patch payload hash or expected revision
- **THEN** apply fails with a validation mismatch error
- **AND** no checklist state mutation is committed

### Requirement: Strict Target Resolution Without Guessing
Patch operations that require existing targets (for example replace/remove) SHALL fail when target paths or IDs do not resolve exactly.

#### Scenario: [OA-CKL-022] Unknown target path is rejected
- **WHEN** a replace operation references a non-existent issue ID path
- **THEN** validation fails with a structured target-resolution error

### Requirement: Patch-Level Idempotency
The system SHALL enforce patch-level idempotency using `patch_id`.

#### Scenario: [OA-CKL-023] Replay same patch_id does not duplicate effects
- **WHEN** the same patch payload is applied again with the same `patch_id`
- **THEN** the system returns an idempotent replay response
- **AND** checklist revision does not increment a second time

#### Scenario: [OA-CKL-024] Reused patch_id with different payload is rejected
- **WHEN** a patch is submitted with a previously used `patch_id` but different operations
- **THEN** apply fails with a patch-id conflict error

### Requirement: Flexible Evidence Citations in Patch Updates
Checklist updates SHALL support citations with required raw evidence text and optional link/filepath.

#### Scenario: [OA-CKL-025] Citation with text only
- **WHEN** a patch adds a citation containing only `text`
- **THEN** validation succeeds

#### Scenario: [OA-CKL-026] Citation with link and filepath
- **WHEN** a patch adds a citation containing `text`, `link`, and `filepath`
- **THEN** validation succeeds

### Requirement: Optional Proposed Patch Mode
Patch envelopes SHALL support optional `mode` with `APPLY` and `PROPOSED` values. `PROPOSED` mode SHALL not require approval workflow in v1.

#### Scenario: [OA-CKL-027] Proposed patch is stored but not applied
- **WHEN** a valid patch is submitted with `mode: PROPOSED`
- **THEN** the system stores the proposal and validation output
- **AND** checklist state revision remains unchanged

### Requirement: Closing Checklist Stage-First Rendering
The closing checklist renderer MUST output stage-first grouped rows with linked
items and unlinked fallback sections.

#### Scenario: [OA-CKL-028] Stage-first checklist rendering with fallbacks
- **WHEN** checklist entries include linked and unlinked items across stages
- **THEN** rendering outputs stage-grouped rows with linked items and unlinked fallbacks

### Requirement: Working Group List Rendering
The working group list renderer MUST output one line per working group member.

#### Scenario: [OA-CKL-029] Working group member rendering
- **WHEN** a working group list payload contains multiple members
- **THEN** rendering outputs one line per member

