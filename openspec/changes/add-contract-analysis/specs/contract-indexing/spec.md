## ADDED Requirements

### Requirement: Contract Sidecar Storage
The system SHALL store per-document indexing results as `.contract.yaml` sidecar
files in `.contracts-workspace/analysis/documents/`, mirroring the document's
relative path. Sidecar writes MUST be atomic (write to temp file, then rename).

#### Scenario: [OA-IDX-001] Save and read contract sidecar
- **WHEN** an agent indexes a document via `index_contract`
- **THEN** a `.contract.yaml` sidecar is written atomically
- **AND** `get_contract_index` returns the stored data with `stale: false`

#### Scenario: [OA-IDX-002] Partial updates preserve existing data
- **WHEN** `index_contract` is called with only classification (no extractions)
- **THEN** existing extractions in the sidecar are preserved

### Requirement: Document Type Validation
The system SHALL validate document types against a canonical list of 15 types
plus custom types from `.contracts-workspace/config.yaml`. Unknown types SHALL
be accepted with a structured fallback rather than rejected.

#### Scenario: [OA-IDX-003] Accept canonical document type
- **WHEN** `index_contract` is called with a canonical document type
- **THEN** the type is stored and no warning is returned

#### Scenario: [OA-IDX-004] Unknown type stored with raw_type fallback
- **WHEN** `index_contract` is called with a type not in canonical or custom list
- **THEN** `document_type` is set to null and `raw_type` stores the detected value
- **AND** a warning is returned listing valid types

#### Scenario: [OA-IDX-005] Accept custom document type from config
- **WHEN** a custom type is defined in config.yaml and used in `index_contract`
- **THEN** the type is accepted without warning

### Requirement: Content Staleness Detection
The system SHALL detect when a document has changed since last indexing by
comparing stored content_hash against current file bytes.

#### Scenario: [OA-IDX-006] Detect stale index entry
- **WHEN** a document is modified after indexing
- **THEN** `get_contract_index` returns `stale: true` with reason `content_changed`

#### Scenario: [OA-IDX-007] Fresh index is not stale
- **WHEN** a document has not changed since indexing
- **THEN** `get_contract_index` returns `stale: false`

### Requirement: Unindexed Contract Listing
The system SHALL provide a `list_unindexed_contracts` tool returning documents
that need indexing, with reason codes for subagent dispatch.

#### Scenario: [OA-IDX-008] List new documents as unindexed
- **WHEN** `list_unindexed_contracts` runs on a workspace with unindexed documents
- **THEN** those documents are returned with `reason: 'new'`

#### Scenario: [OA-IDX-009] List stale documents as needing re-indexing
- **WHEN** documents have changed since last indexing
- **THEN** they are returned with `reason: 'content_changed'`

### Requirement: BM25 Full-Text Search
The system SHALL provide a `search_contracts` tool that performs BM25 ranked
full-text search across indexed contract metadata. The search index MUST be
built in-memory from sidecar files on each query — no persistent shared index.

#### Scenario: [OA-IDX-010] BM25 search by query text
- **WHEN** `search_contracts` is called with a text query
- **THEN** results are ranked by BM25 relevance score

#### Scenario: [OA-IDX-011] Filter by document type
- **WHEN** `search_contracts` is called with `document_type` filter
- **THEN** only documents of that type are returned

#### Scenario: [OA-IDX-012] Filter by expiration date
- **WHEN** `search_contracts` is called with `expiring_before`
- **THEN** only documents expiring before that date are returned

#### Scenario: [OA-IDX-013] Filter by party name
- **WHEN** `search_contracts` is called with `party` filter
- **THEN** only documents with matching party (substring) are returned

#### Scenario: [OA-IDX-014] Markdown format output
- **WHEN** `search_contracts` is called with `format: 'markdown'`
- **THEN** results are returned as a pipe-delimited Markdown table

### Requirement: Portfolio Overview
The `get_contract_index` tool SHALL support a portfolio overview mode returning
aggregate counts and health metrics.

#### Scenario: [OA-IDX-015] Portfolio overview
- **WHEN** `get_contract_index` is called without a document_path
- **THEN** it returns indexed_count, unindexed_count, stale_count, orphaned_sidecar_count, type distribution, and expiring-soon list

### Requirement: Orphan Detection
The system SHALL detect sidecar files whose corresponding source document no
longer exists at the recorded path.

#### Scenario: [OA-IDX-016] Detect orphaned sidecars
- **WHEN** a document is deleted but its sidecar remains
- **THEN** `get_contract_index` portfolio mode reports it in orphaned_sidecar_count
