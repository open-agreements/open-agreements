# contracts-workspace Specification

## Purpose
Define the canonical behavior for the standalone contracts workspace package and
CLI used for filesystem-first contract repository operations.

## Requirements
### Requirement: Workspace Initialization Command
The system SHALL provide an `init` command in a dedicated contracts workspace
CLI that writes workspace guidance/config files and planning output in the
current directory. In v1, `init` SHALL NOT require automatic creation of
lifecycle folders.

#### Scenario: [OA-115] Initialize empty workspace
- **WHEN** a user runs the workspace `init` command in an empty directory
- **THEN** the system writes core workspace guidance/config files
- **AND** reports a plan for recommended workspace structure

#### Scenario: [OA-116] Re-run init on existing workspace
- **WHEN** a user runs `init` in a directory that already contains generated workspace files
- **THEN** existing files are preserved
- **AND** the command remains idempotent

### Requirement: Topic Scaffold Planning
The `init` workflow SHALL include topic-domain planning so forms can be
organized by subject area without forcing one fixed top-level folder layout.

#### Scenario: [OA-117] Forms topic scaffolding
- **WHEN** `init` planning runs with topic inputs
- **THEN** suggested topic domains are included in the generated plan
- **AND** planning does not require immediate folder creation

### Requirement: Shared Agent Guidance File
The `init` workflow SHALL generate a shared `CONTRACTS.md` file that defines
workspace conventions for AI agents and humans. This file MUST include folder
semantics, naming conventions, status conventions, and command references for
catalog/status operations.

#### Scenario: [OA-118] CONTRACTS.md generated
- **WHEN** `init` completes
- **THEN** `CONTRACTS.md` exists at the workspace root
- **AND** it documents lifecycle folders and status naming rules

### Requirement: Claude and Gemini Integration Guidance
The workspace tooling SHALL provide optional setup guidance for Claude Code and
Gemini CLI that references `CONTRACTS.md` as the canonical collaboration ruleset.

#### Scenario: [OA-119] Agent setup output
- **WHEN** a user requests agent setup during initialization
- **THEN** the tool emits or writes integration instructions for Claude Code and Gemini CLI
- **AND** both integrations reference `CONTRACTS.md`

### Requirement: Forms Catalog With URL and Checksum
The workspace tooling SHALL support a forms catalog format that records
downloadable form references with both source URL and checksum. Catalog entries
MUST include license handling metadata that distinguishes redistributable
unmodified sources from pointer-only/proprietary references.

#### Scenario: [OA-120] Validate catalog entry with checksum
- **WHEN** `catalog validate` runs on an entry containing `source_url` and SHA-256 checksum
- **THEN** the entry passes structural validation if required fields are present

#### Scenario: [OA-121] Reject missing checksum
- **WHEN** `catalog validate` runs on an entry with a URL but no checksum
- **THEN** validation fails with an error describing the missing checksum requirement

### Requirement: Catalog Download and Verification
The workspace tooling SHALL provide a command to download eligible catalog
entries and verify file integrity against the configured checksum before placing
files into the workspace.

#### Scenario: [OA-122] Successful download and checksum verification
- **WHEN** a user runs catalog download for an eligible entry
- **AND** the downloaded file hash matches the configured checksum
- **THEN** the file is placed in the configured workspace destination

#### Scenario: [OA-123] Checksum mismatch blocks placement
- **WHEN** a catalog download completes but computed hash differs from configured checksum
- **THEN** the tool fails the operation
- **AND** the file is not accepted into the workspace destination

### Requirement: Pointer-Only Catalog Handling
Catalog entries marked as pointer-only/proprietary SHALL be represented as
reference metadata and MUST NOT be vendored automatically when redistribution is
not permitted.

#### Scenario: [OA-124] Pointer-only entry behavior
- **WHEN** catalog download is requested for a pointer-only/proprietary entry
- **THEN** the tool reports that direct vendoring is disallowed
- **AND** provides reference details (URL/checksum/license notes) for user-managed retrieval

### Requirement: Filename-Driven Execution Status
Execution status SHALL be derived from filename conventions, with `_executed` as
an authoritative status marker for signed/executed documents.

#### Scenario: [OA-125] Executed status inferred from filename
- **WHEN** a document filename includes `_executed`
- **THEN** status indexing marks the document as executed

#### Scenario: [OA-126] No executed marker
- **WHEN** a document filename lacks `_executed`
- **THEN** status indexing does not mark the document as executed by default

### Requirement: YAML Status Index Generation
The workspace tooling SHALL generate a YAML status index summarizing contract
files, inferred lifecycle state, and lint findings. Generated output MUST include
a generation timestamp.

#### Scenario: [OA-127] Generate contracts index
- **WHEN** a user runs `status generate`
- **THEN** the tool writes `contracts-index.yaml`
- **AND** includes an explicit generation timestamp
- **AND** includes per-document status records

### Requirement: Workspace Linting
The workspace tooling SHALL lint directory and file organization rules,
including disallowed file-type placement and stale index detection.

#### Scenario: [OA-128] Disallowed file type placement
- **WHEN** lint runs and finds a PDF under `forms/`
- **THEN** lint reports a violation

#### Scenario: [OA-129] Stale index detection
- **WHEN** lint runs and workspace files are newer than `contracts-index.yaml`
- **THEN** lint reports the index as stale and recommends regeneration

### Requirement: Filesystem-Only Operation in v1
The workspace tooling SHALL operate on local filesystem directories only in v1,
including locally synced cloud-drive folders. It SHALL NOT require cloud API
integrations in this change.

#### Scenario: [OA-130] Local synced drive compatibility
- **WHEN** a user runs workspace commands in a locally synced cloud-drive folder
- **THEN** commands operate using normal filesystem semantics
- **AND** no cloud API credentials are required

### Requirement: Independent Package Boundary
Contracts workspace functionality SHALL be delivered as a sibling package/CLI,
independently installable from the existing OpenAgreements template-filling CLI.

#### Scenario: [OA-131] Workspace-only adoption
- **WHEN** a user installs the workspace package without installing template-filling tooling
- **THEN** workspace commands are available
- **AND** template-filling commands are not required for workspace initialization, catalog, or status features

### Requirement: Workspace Convention Configuration
The convention system MUST support writing, loading, and round-tripping convention
configs with both filesystem and memory providers. Default conventions MUST be
returned when no config file exists.

#### Scenario: [OA-202] Convention config round-trip and defaults
- **WHEN** convention config is written and loaded via any provider
- **THEN** the loaded config matches the written config
- **AND** when no config file exists, default conventions are returned

### Requirement: Convention Scanner Detection
The convention scanner MUST detect naming styles (snake_case, kebab-case,
title-case-spaces), execution status markers (_executed, _partially_executed),
and asset-like folders from workspace file inventories.

#### Scenario: [OA-203] Convention scanner pattern detection
- **WHEN** the scanner analyzes workspace files
- **THEN** it returns defaults for empty or small (< 5 files) workspaces
- **AND** detects _executed and (fully executed) marker patterns from file majority
- **AND** detects snake_case, kebab-case, and title-case-spaces naming styles
- **AND** classifies asset-like folders separately

### Requirement: Convention-Aware Linting
The linter MUST use default or custom markers from conventions config and support
marker-based validation of workspace files.

#### Scenario: [OA-204] Convention-aware lint with custom markers
- **WHEN** linting runs with or without a conventions config
- **THEN** default markers are used when no config exists
- **AND** custom markers from config are applied when present

#### Scenario: [OA-205] Convention-aware indexer marker detection
- **WHEN** the indexer checks for executed markers
- **THEN** `hasExecutedMarker` accepts custom patterns from conventions

### Requirement: Workspace Initialization Artifacts
The `init` command MUST generate WORKSPACE.md, FOLDER.md, and conventions.yaml
files. It MUST be idempotent and scan conventions on non-empty workspaces.

#### Scenario: [OA-206] Init generates documentation and config files
- **WHEN** `init` runs on an empty workspace
- **THEN** WORKSPACE.md, FOLDER.md, and conventions.yaml are created
- **AND** re-running init is idempotent
- **AND** non-empty workspaces trigger convention scanning

### Requirement: Partially Executed Document Status
The system MUST detect `_partially_executed` filename suffix as a distinct status,
not conflate it with `_executed`, and skip lint warnings for partial executions.

#### Scenario: [OA-207] Partially executed document handling
- **WHEN** a document filename includes `_partially_executed`
- **THEN** `hasPartiallyExecutedMarker` detects it
- **AND** `hasExecutedMarker` returns false for partially executed files
- **AND** workspace document collection assigns `partially_executed` status
- **AND** lint does not warn about missing markers for partially executed files
- **AND** the scanner detects _partially_executed as a distinct candidate

### Requirement: Duplicate File Detection
The linter MUST detect copy-pattern and timestamp-suffixed duplicate files
while not flagging unrelated files.

#### Scenario: [OA-208] Duplicate file lint detection
- **WHEN** the workspace contains copy-pattern or timestamp-suffixed duplicate files
- **THEN** lint detects and flags them
- **AND** unrelated files are not flagged as duplicates

### Requirement: Root Orphan Detection
The linter MUST warn about files at the workspace root while exempting known
config files.

#### Scenario: [OA-209] Root orphan lint detection
- **WHEN** files exist at the workspace root
- **THEN** lint warns about non-config files
- **AND** known config files are not flagged

### Requirement: Cross-Contamination Detection
The linter MUST detect files whose names suggest they belong in a different
domain folder, using high-confidence compound phrases while ignoring generic terms.

#### Scenario: [OA-210] Cross-contamination lint detection
- **WHEN** files contain high-confidence compound phrases suggesting wrong domain placement
- **THEN** lint warns about potential cross-contamination
- **AND** generic terms like "agreement" or "policy" are not flagged
- **AND** the rule does not run when no non-lifecycle domain folders are configured

### Requirement: Workspace Init Backward Compatibility
Init MUST create config files without forcing lifecycle directory creation and
remain idempotent across repeated invocations.

#### Scenario: [OA-211] Init backward compatibility
- **WHEN** init runs
- **THEN** config files are created but lifecycle directories are not
- **AND** repeated init invocations are idempotent with conventions

### Requirement: Provider Filesystem Semantics
Both FilesystemProvider and MemoryProvider MUST implement consistent filesystem
semantics including exists, read, write, mkdir, readdir, stat, and walk operations.

#### Scenario: [OA-212] FilesystemProvider operations
- **WHEN** filesystem operations are performed via FilesystemProvider
- **THEN** exists returns false for missing paths and true after creation
- **AND** writeFile/readTextFile round-trips correctly
- **AND** readFile returns Buffers
- **AND** mkdir with recursive creates nested directories
- **AND** readdir lists entries, stat returns correct FileInfo, and walk recursively finds files

#### Scenario: [OA-213] MemoryProvider operations
- **WHEN** filesystem operations are performed via MemoryProvider
- **THEN** exists, seed, writeFile/readTextFile, readFile, mkdir, readdir, stat, and walk all behave consistently
- **AND** ENOENT errors are thrown for missing paths
- **AND** MemoryProvider works with initializeWorkspace

### Requirement: JSON Schema Snapshot Consistency
Zod-to-JSON-Schema mappings MUST produce stable snapshots for key constructs
(literal, regex, datetime, record, enum) and full schema shapes.

#### Scenario: [OA-214] Zod-to-JSON-Schema construct mappings
- **WHEN** Zod schemas are converted to JSON Schema
- **THEN** z.literal produces const, z.string().regex() produces pattern, z.iso.datetime() produces format
- **AND** z.record produces additionalProperties, z.enum produces enum arrays
- **AND** full schema snapshots for FormsCatalogSchema and ConventionConfigSchema are stable

### Requirement: MCP Tool Descriptors
The MCP tool layer MUST list expected tools, return workspace setup suggestions
without side effects, report structured errors for invalid catalog entries,
and generate status indexes with lint findings.

#### Scenario: [OA-215] MCP workspace tool operations
- **WHEN** MCP tools are invoked
- **THEN** tool listing returns expected tools
- **AND** workspace setup suggestions are returned without filesystem mutation
- **AND** invalid catalog entries produce structured errors
- **AND** status index generation includes lint findings
