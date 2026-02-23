## ADDED Requirements

### Requirement: Document-First Closing Checklist Data Model
The system SHALL model closing checklists with canonical documents as the primary records and stage-scoped checklist entries as render rows. IDs SHALL be stable string identifiers and SHALL NOT require UUID format.

#### Scenario: Document and checklist entry use stable string IDs
- **WHEN** a checklist payload defines `document_id: "escrow-agreement-executed"` and `entry_id: "entry-escrow-closing"`
- **THEN** validation accepts those IDs as valid stable strings
- **AND** validation does not require UUID-only formats

#### Scenario: Checklist entry references unknown document ID
- **WHEN** a checklist entry references a `document_id` not present in canonical documents
- **THEN** validation fails with a structured error identifying the missing reference

#### Scenario: One document maps to at most one checklist entry
- **WHEN** two checklist entries reference the same `document_id`
- **THEN** validation fails with a structured duplicate-mapping error

### Requirement: Stage-First Nested Lawyer Rendering
The system SHALL render closing checklists grouped by stage (`PRE_SIGNING`, `SIGNING`, `CLOSING`, `POST_CLOSING`) with nested rows based on parent entry relationships.

#### Scenario: Checklist renders in canonical stage order
- **WHEN** checklist entries are provided across all four stages
- **THEN** rendered output groups rows under those stage headers in canonical order

#### Scenario: Child entry is rendered beneath parent entry
- **WHEN** an entry includes `parent_entry_id` referencing another entry in the same stage
- **THEN** rendered output displays the child row indented beneath the parent row

### Requirement: Stable Sort Key and Computed Display Numbering
Checklist entries SHALL include a stable non-positional `sort_key`. Rendered row numbering (`1`, `1.1`, `1.1.1`) SHALL be computed at render time from the sorted nested tree.

#### Scenario: Inserting an entry does not require renumbering stored IDs
- **WHEN** a new entry is inserted between existing entries by assigning an intermediate `sort_key`
- **THEN** existing `entry_id` and `document_id` values remain unchanged
- **AND** rendered numbering updates to reflect the new order

### Requirement: Optional Document Labels
Canonical documents SHALL support optional freeform `labels[]` metadata.

#### Scenario: Document carries optional labels
- **WHEN** a document includes labels like `phase:closing` and `priority:high`
- **THEN** validation accepts the labels
- **AND** checklist rendering remains valid whether labels are present or absent

### Requirement: Named Signatory Tracking with Signature Artifacts
The system SHALL track signatories as explicit named entries with per-signatory status on checklist entries. The renderer SHALL display signer identity and signer status, not only aggregate counts. Signatories SHALL support optional signature artifact locations.

#### Scenario: Partially signed document shows missing signer identity
- **WHEN** one checklist entry has three expected signatories and one has not signed
- **THEN** rendered output identifies the specific signatory marked pending
- **AND** rendered output does not collapse the state to only a numeric fraction

#### Scenario: Signatory stores signature artifact location
- **WHEN** a signatory includes a signature artifact with `uri` or `path` and optional `received_at`
- **THEN** validation accepts the artifact metadata
- **AND** rendered output can include the artifact location context

### Requirement: Minimal Citation Support
Checklist entries SHALL support optional minimal citation metadata as a list of reference objects.

#### Scenario: Entry includes simple citation reference
- **WHEN** an entry includes `citations: [{ "ref": "SPA §6.2(b)" }]`
- **THEN** rendered output includes that citation with the corresponding row

### Requirement: Document-Linked and Document-Less Checklist Entries
Checklist entries MAY exist without `document_id` to support pre-document or administrative tasks. Action items and issues SHALL link to zero or more canonical documents via `related_document_ids`.

#### Scenario: Checklist entry with no document for pre-document task
- **WHEN** an entry is created for a task like ordering a good standing certificate and omits `document_id`
- **THEN** validation succeeds
- **AND** the entry renders normally in its stage section

#### Scenario: Unlinked action item is rendered in fallback section
- **WHEN** an action item has no related document IDs
- **THEN** rendered output includes the item in a dedicated unlinked section

### Requirement: Simplified Issue Lifecycle
Issues SHALL use a simplified lifecycle with only `OPEN` and `CLOSED` statuses.

#### Scenario: Issue with unsupported granular status is rejected
- **WHEN** an issue status is provided as `AGREED_IN_PRINCIPLE`
- **THEN** validation fails with a status-enum error

### Requirement: Standalone Working Group Document
The system SHALL treat the working group roster as a standalone document flow rather than an embedded closing checklist table.

#### Scenario: Checklist references working group roster document
- **WHEN** a user includes a working group list in the deal packet
- **THEN** the closing checklist represents it as a document row with link/reference metadata
- **AND** the checklist renderer does not require an embedded working-group table block

### Requirement: Legacy Checklist Payload Rejection
The system SHALL reject the previous flat checklist payload shape once the document-first model is enabled.

#### Scenario: Legacy flat payload submitted to checklist creation
- **WHEN** input includes only top-level legacy flat arrays and omits required document-first checklist entry structures
- **THEN** validation fails with machine-readable contract errors
