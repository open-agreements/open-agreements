## ADDED Requirements

### Requirement: Persisted Intrinsic Node IDs

The MCP server SHALL use persisted intrinsic paragraph/node identifiers (`jr_para_*`) as canonical anchor identity.

The identifier strategy SHALL NOT use absolute sequential indexes as anchor identity.

#### Scenario: Re-opening unchanged document yields same IDs
- **GIVEN** a document opened in two independent MCP sessions with no content changes
- **WHEN** `read_file` is called in both sessions
- **THEN** equivalent paragraphs receive the same `jr_para_*` identifiers

#### Scenario: Inserting new paragraph does not renumber unrelated IDs
- **GIVEN** an existing session with stable `jr_para_*` IDs
- **WHEN** a new paragraph is inserted
- **THEN** existing untouched paragraphs retain their prior `jr_para_*` IDs
- **AND** only new/edited paragraphs receive newly minted intrinsic IDs as needed

#### Scenario: Two identical signature-block paragraphs remain uniquely addressable
- **GIVEN** a document containing duplicate text blocks such as:
- **AND** `Supplier / By: / Name: / Title:` and `Customer / By: / Name: / Title:`
- **WHEN** IDs are assigned and `read_file` is called
- **THEN** each paragraph instance has a distinct `jr_para_*` identifier
- **AND** those identifiers remain stable for subsequent edits and downloads

#### Scenario: Missing intrinsic IDs are backfilled once
- **GIVEN** a document paragraph without a `jr_para_*` identifier
- **WHEN** the document is opened
- **THEN** the server mints and persists a new `jr_para_*` identifier for that paragraph
- **AND** future reads use that same identifier

### Requirement: Dual-Variant Download by Default

The `download` tool SHALL return both `clean` and `redline` outputs by default when no variant override is provided.

#### Scenario: Default download returns both variants
- **GIVEN** a session with applied edits
- **WHEN** `download` is called without variant override
- **THEN** the response includes both `clean` and `redline` artifacts

#### Scenario: Explicit variant override returns subset
- **GIVEN** a session with applied edits
- **WHEN** `download` is called with an explicit variant override for only `clean`
- **THEN** only the clean artifact is returned
- **AND** no redline artifact is generated for that request

### Requirement: Session-Based Re-Download Without Re-Editing

The MCP server SHALL allow users to re-download previously generated artifacts by `session_id` without replaying edit operations.

#### Scenario: Repeat download reuses cached artifacts
- **GIVEN** a session and edit revision with previously generated `clean` and `redline` outputs
- **WHEN** `download` is called again for the same session and revision
- **THEN** the server returns cached artifacts
- **AND** the response indicates a cache hit
- **AND** no edit replay is performed

#### Scenario: New edit invalidates previous revision cache
- **GIVEN** cached artifacts for edit revision N
- **WHEN** a new edit creates revision N+1
- **THEN** subsequent downloads for the current state use revision N+1 artifacts
- **AND** stale revision N artifacts are not returned as current outputs

### Requirement: Download Operations Preserve Anchor Stability

Artifact generation for `download` SHALL NOT mutate the active session's paragraph anchor mapping.

#### Scenario: Anchors unchanged after dual download
- **GIVEN** a session with known paragraph IDs
- **WHEN** `download` is called with default dual-variant behavior
- **THEN** a subsequent `read_file` call returns the same paragraph IDs for unchanged paragraphs

#### Scenario: Generating clean artifact does not invalidate redline anchors
- **GIVEN** a session with applied edits
- **WHEN** a clean artifact is generated
- **THEN** paragraph anchor mappings remain valid for redline generation in the same session

### Requirement: Explicit Download Contract Metadata

The MCP server SHALL expose download defaults and re-download behavior in tool metadata and responses.

#### Scenario: Open response advertises download defaults
- **GIVEN** a successful `open_document` call
- **WHEN** tool metadata is returned
- **THEN** metadata states that default `download` behavior returns both `clean` and `redline`
- **AND** metadata describes override support

#### Scenario: Download response reports variant and cache details
- **GIVEN** any `download` invocation
- **WHEN** the response is returned
- **THEN** it includes returned variant list
- **AND** includes cache hit/miss status
- **AND** includes an edit revision marker
