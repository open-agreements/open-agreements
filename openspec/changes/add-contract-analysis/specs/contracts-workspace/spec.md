## ADDED Requirements

### Requirement: Contract Analysis Storage
The system SHALL store per-document analysis results as sidecar YAML files in
`.contracts-workspace/analysis/documents/`, mirroring the document's relative
path. Each analysis file MUST include a stable `document_id`, `content_hash`,
classification, and clause extractions.

#### Scenario: [OA-WKS-032] Save and read contract analysis
- **WHEN** an agent stores a classification and clause extractions for a document via `save_contract_analysis`
- **THEN** a `.analysis.yaml` sidecar file is written under `.contracts-workspace/analysis/documents/`
- **AND** `read_contract_analysis` returns the stored analysis with `stale: false`

#### Scenario: [OA-WKS-033] Stable document ID across updates
- **WHEN** analysis is saved for a document that already has an analysis
- **THEN** the existing `document_id` is preserved
- **AND** the `analyzed_at` timestamp and `content_hash` are updated

#### Scenario: [OA-WKS-034] Partial analysis updates
- **WHEN** `save_contract_analysis` is called with only classification (no extractions)
- **THEN** existing extractions in the analysis file are preserved
- **AND** the classification is updated

### Requirement: Content Staleness Detection
The system SHALL detect when a document's content has changed since its last
analysis by comparing the stored `content_hash` against the current file hash.

#### Scenario: [OA-WKS-035] Detect stale analysis
- **WHEN** a document is modified after analysis
- **THEN** `read_contract_analysis` returns `stale: true` with `stale_reason: 'content_changed'`

#### Scenario: [OA-WKS-036] Fresh analysis is not stale
- **WHEN** a document has not been modified since its last analysis
- **THEN** `read_contract_analysis` returns `stale: false`

### Requirement: Pending Contracts Listing
The system SHALL provide a `list_pending_contracts` tool that returns documents
needing analysis, with reason codes for subagent dispatch.

#### Scenario: [OA-WKS-037] List unanalyzed documents
- **WHEN** `list_pending_contracts` is called on a workspace with unanalyzed documents
- **THEN** those documents are returned with `reason: 'new'`

#### Scenario: [OA-WKS-038] List stale documents
- **WHEN** `list_pending_contracts` is called and some documents have stale analyses
- **THEN** those documents are returned with `reason: 'content_changed'`

### Requirement: Contract Search
The system SHALL provide a `search_contracts` tool for filtered retrieval across
the portfolio using the global status index.

#### Scenario: [OA-WKS-039] Search by document type
- **WHEN** `search_contracts` is called with `document_type: 'nda'`
- **THEN** only documents classified as NDAs are returned

#### Scenario: [OA-WKS-040] Search by expiration date
- **WHEN** `search_contracts` is called with `expiring_before: '2026-06-30'`
- **THEN** only documents with expiration dates before that date are returned

#### Scenario: [OA-WKS-041] Search by party name
- **WHEN** `search_contracts` is called with `party: 'Acme'`
- **THEN** only documents with a matching party (substring) are returned

### Requirement: Contract Rename Suggestion
The system SHALL provide a `suggest_contract_rename` tool that suggests
standardized filenames based on classification metadata.

#### Scenario: [OA-WKS-042] Suggest rename from classification
- **WHEN** `suggest_contract_rename` is called for a classified document
- **THEN** a suggested filename is returned using the pattern `{date}_{party}_{type}.{ext}`

#### Scenario: [OA-WKS-043] No suggestion for unclassified documents
- **WHEN** `suggest_contract_rename` is called for a document without classification
- **THEN** the tool returns a null suggestion with a reason

### Requirement: Enhanced Status Index with Analysis
The `status_generate` tool SHALL enrich the status index with analysis metadata
when available. The analysis section MUST be optional for backward compatibility.

#### Scenario: [OA-WKS-044] Status index includes analysis summary
- **WHEN** `status_generate` runs on a workspace with analyzed documents
- **THEN** `contracts-index.yaml` includes an `analysis` section with counts by type and expiring-soon list

#### Scenario: [OA-WKS-045] Status index without analysis is valid
- **WHEN** `status_generate` runs on a workspace with no analyzed documents
- **THEN** `contracts-index.yaml` is valid and the `analysis` section is omitted or shows zero counts
