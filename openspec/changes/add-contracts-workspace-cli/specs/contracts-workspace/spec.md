## ADDED Requirements

### Requirement: Workspace Initialization Command
The system SHALL provide an `init` command in a dedicated contracts workspace CLI
that bootstraps a lifecycle-first contract directory in the current working
directory. The command MUST create top-level folders `forms/`, `drafts/`,
`incoming/`, `executed/`, and `archive/` when missing.

#### Scenario: Initialize empty workspace
- **WHEN** a user runs the workspace `init` command in an empty directory
- **THEN** the system creates `forms/`, `drafts/`, `incoming/`, `executed/`, and `archive/`
- **AND** exits successfully with a summary of created paths

#### Scenario: Re-run init on existing workspace
- **WHEN** a user runs `init` in a directory that already contains some or all required folders
- **THEN** existing folders are preserved
- **AND** missing folders are created
- **AND** the command remains idempotent

### Requirement: Topic Scaffold Under Forms
The `init` workflow SHALL scaffold topic subfolders under `forms/` so forms can
be organized by subject area while keeping lifecycle as the top-level information
architecture.

#### Scenario: Forms topic scaffolding
- **WHEN** `init` creates a new workspace
- **THEN** topic folders are created under `forms/`
- **AND** no topic folders are created as top-level lifecycle replacements

### Requirement: Shared Agent Guidance File
The `init` workflow SHALL generate a shared `CONTRACTS.md` file that defines
workspace conventions for AI agents and humans. This file MUST include folder
semantics, naming conventions, status conventions, and command references for
catalog/status operations.

#### Scenario: CONTRACTS.md generated
- **WHEN** `init` completes
- **THEN** `CONTRACTS.md` exists at the workspace root
- **AND** it documents lifecycle folders and status naming rules

### Requirement: Claude and Gemini Integration Guidance
The workspace tooling SHALL provide optional setup guidance for Claude Code and
Gemini CLI that references `CONTRACTS.md` as the canonical collaboration ruleset.

#### Scenario: Agent setup output
- **WHEN** a user requests agent setup during initialization
- **THEN** the tool emits or writes integration instructions for Claude Code and Gemini CLI
- **AND** both integrations reference `CONTRACTS.md`

### Requirement: Forms Catalog With URL and Checksum
The workspace tooling SHALL support a forms catalog format that records
downloadable form references with both source URL and checksum. Catalog entries
MUST include license handling metadata that distinguishes redistributable
unmodified sources from pointer-only/proprietary references.

#### Scenario: Validate catalog entry with checksum
- **WHEN** `catalog validate` runs on an entry containing `source_url` and SHA-256 checksum
- **THEN** the entry passes structural validation if required fields are present

#### Scenario: Reject missing checksum
- **WHEN** `catalog validate` runs on an entry with a URL but no checksum
- **THEN** validation fails with an error describing the missing checksum requirement

### Requirement: Catalog Download and Verification
The workspace tooling SHALL provide a command to download eligible catalog
entries and verify file integrity against the configured checksum before placing
files into the workspace.

#### Scenario: Successful download and checksum verification
- **WHEN** a user runs catalog download for an eligible entry
- **AND** the downloaded file hash matches the configured checksum
- **THEN** the file is placed in the configured workspace destination

#### Scenario: Checksum mismatch blocks placement
- **WHEN** a catalog download completes but computed hash differs from configured checksum
- **THEN** the tool fails the operation
- **AND** the file is not accepted into the workspace destination

### Requirement: Pointer-Only Catalog Handling
Catalog entries marked as pointer-only/proprietary SHALL be represented as
reference metadata and MUST NOT be vendored automatically when redistribution is
not permitted.

#### Scenario: Pointer-only entry behavior
- **WHEN** catalog download is requested for a pointer-only/proprietary entry
- **THEN** the tool reports that direct vendoring is disallowed
- **AND** provides reference details (URL/checksum/license notes) for user-managed retrieval

### Requirement: Filename-Driven Execution Status
Execution status SHALL be derived from filename conventions, with `_executed` as
an authoritative status marker for signed/executed documents.

#### Scenario: Executed status inferred from filename
- **WHEN** a document filename includes `_executed`
- **THEN** status indexing marks the document as executed

#### Scenario: No executed marker
- **WHEN** a document filename lacks `_executed`
- **THEN** status indexing does not mark the document as executed by default

### Requirement: YAML Status Index Generation
The workspace tooling SHALL generate a YAML status index summarizing contract
files, inferred lifecycle state, and lint findings. Generated output MUST include
a generation timestamp.

#### Scenario: Generate contracts index
- **WHEN** a user runs `status generate`
- **THEN** the tool writes `contracts-index.yaml`
- **AND** includes an explicit generation timestamp
- **AND** includes per-document status records

### Requirement: Workspace Linting
The workspace tooling SHALL lint directory and file organization rules,
including disallowed file-type placement and stale index detection.

#### Scenario: Disallowed file type placement
- **WHEN** lint runs and finds a PDF under `forms/`
- **THEN** lint reports a violation

#### Scenario: Stale index detection
- **WHEN** lint runs and workspace files are newer than `contracts-index.yaml`
- **THEN** lint reports the index as stale and recommends regeneration

### Requirement: Filesystem-Only Operation in v1
The workspace tooling SHALL operate on local filesystem directories only in v1,
including locally synced cloud-drive folders. It SHALL NOT require cloud API
integrations in this change.

#### Scenario: Local synced drive compatibility
- **WHEN** a user runs workspace commands in a locally synced Google Drive folder
- **THEN** commands operate using normal filesystem semantics
- **AND** no Google Drive API credentials are required

### Requirement: Independent Package Boundary
Contracts workspace functionality SHALL be delivered as a sibling package/CLI,
independently installable from the existing OpenAgreements template-filling CLI.

#### Scenario: Workspace-only adoption
- **WHEN** a user installs the workspace package without installing template-filling tooling
- **THEN** workspace commands are available
- **AND** template-filling commands are not required for workspace initialization, catalog, or status features
