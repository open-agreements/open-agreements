## ADDED Requirements

### Requirement: Convention Configuration
The workspace tooling SHALL support a convention config file
(`.contracts-workspace/conventions.yaml`) that declares workspace-specific
naming conventions, execution status markers, lifecycle folder names, and
lifecycle applicability per domain. When no convention config exists, the system
SHALL fall back to default conventions (current hardcoded values).

#### Scenario: Config present overrides defaults
- **WHEN** `.contracts-workspace/conventions.yaml` exists with `executed_marker.pattern: "(fully executed)"`
- **THEN** lint and indexer use `(fully executed)` as the execution status marker
- **AND** the default `_executed` marker is not enforced

#### Scenario: Config absent falls back to defaults
- **WHEN** no `.contracts-workspace/conventions.yaml` exists
- **THEN** lint and indexer use `_executed` as the execution status marker
- **AND** behavior is identical to the pre-config codebase

#### Scenario: Invalid config rejected
- **WHEN** `.contracts-workspace/conventions.yaml` contains invalid YAML or fails schema validation
- **THEN** the system reports a descriptive error
- **AND** does not fall back silently to defaults

### Requirement: Adaptive Workspace Initialization
When `init` runs in a non-empty directory, the system SHALL scan existing
filenames to infer naming conventions and execution status patterns. The
inferred conventions SHALL be written to the convention config file. When no
clear convention is detected, the system SHALL bias toward default conventions
(kebab-case naming, `_executed` suffix).

#### Scenario: Init on non-empty directory infers conventions
- **WHEN** `init` runs in a directory containing files named with `(fully executed)` status markers
- **THEN** the convention config is written with `executed_marker.pattern: "(fully executed)"`
- **AND** existing files are not renamed or moved

#### Scenario: Init on empty directory uses defaults
- **WHEN** `init` runs in an empty directory
- **THEN** the convention config is written with default values
- **AND** the workspace scaffold matches current behavior

#### Scenario: Init preserves existing content
- **WHEN** `init` runs in a directory with existing files and folders
- **THEN** no existing files are deleted, renamed, or moved
- **AND** only new scaffold folders and documentation files are created

### Requirement: Lifecycle Applicability Per Domain
The convention config SHALL declare which domain folders are lifecycle domains
(receive lifecycle subfolders: forms, drafts, executed, archive) and which are
asset domains (flat collections without lifecycle subfolders). Init SHALL only
create lifecycle subfolders for lifecycle-applicable domains.

#### Scenario: Lifecycle domain gets subfolders
- **WHEN** `init` runs and the convention config lists `Vendor Agreements` as a lifecycle domain
- **THEN** lifecycle subfolders are created under `Vendor Agreements/`

#### Scenario: Asset domain stays flat
- **WHEN** `init` runs and the convention config lists `Logos` as an asset domain
- **THEN** no lifecycle subfolders are created under `Logos/`
- **AND** the `Logos/` folder is left as-is

### Requirement: Workspace Documentation Generation
The `init` command SHALL generate a root `WORKSPACE.md` documenting overall
workspace structure and linking to per-folder documentation. Each domain folder
SHALL receive a `FOLDER.md` declaring purpose, naming convention, owner, and
applicable lifecycle stages. Generated documentation SHALL reflect the
configured conventions.

#### Scenario: WORKSPACE.md generated at root
- **WHEN** `init` completes
- **THEN** `WORKSPACE.md` exists at the workspace root
- **AND** it lists all domain folders with descriptions and links to FOLDER.md files

#### Scenario: FOLDER.md generated per domain
- **WHEN** `init` completes for a workspace with domain folders
- **THEN** each domain folder contains a `FOLDER.md`
- **AND** the FOLDER.md reflects the configured naming convention and lifecycle applicability

#### Scenario: Documentation reflects non-default conventions
- **WHEN** the convention config specifies `executed_marker.pattern: "(signed)"`
- **THEN** generated FOLDER.md files reference `(signed)` as the status marker
- **AND** WORKSPACE.md references the configured conventions

### Requirement: Filename-Folder Consistency Lint Warning
Workspace linting SHALL warn when a file's filename contains the configured
execution status marker but the file is not located in the configured executed
lifecycle folder. The filename SHALL remain authoritative for status; the
warning signals potential misorganization, not an error.

#### Scenario: Executed file in wrong folder
- **WHEN** lint runs and finds `acme_nda_executed.docx` in `drafts/`
- **THEN** lint emits a warning with code `executed-marker-outside-executed`
- **AND** the document status is still inferred as executed (filename is authoritative)

#### Scenario: Executed file in correct folder
- **WHEN** lint runs and finds `acme_nda_executed.docx` in `executed/`
- **THEN** no consistency warning is emitted

## MODIFIED Requirements

### Requirement: Filename-Driven Execution Status
Execution status SHALL be derived from filename conventions, using the
configured execution status marker as the authoritative status signal. The
marker pattern SHALL be read from the convention config when present, falling
back to `_executed` as the default.

#### Scenario: Executed status inferred from configured marker
- **WHEN** the convention config specifies `executed_marker.pattern: "(fully executed)"`
- **AND** a document filename includes `(fully executed)`
- **THEN** status indexing marks the document as executed

#### Scenario: Default marker used without config
- **WHEN** no convention config exists
- **AND** a document filename includes `_executed`
- **THEN** status indexing marks the document as executed

#### Scenario: No executed marker
- **WHEN** a document filename lacks the configured execution status marker
- **THEN** status indexing does not mark the document as executed by default

### Requirement: Workspace Initialization Command
The system SHALL provide an `init` command in a dedicated contracts workspace CLI
that bootstraps a contract directory in the current working directory. When the
directory is empty, the command MUST create default lifecycle folders. When the
directory is non-empty, the command MUST scan existing content to infer
conventions before scaffolding.

#### Scenario: Initialize empty workspace
- **WHEN** a user runs the workspace `init` command in an empty directory
- **THEN** the system creates lifecycle folders with default names
- **AND** writes convention config with default values
- **AND** generates WORKSPACE.md and FOLDER.md files
- **AND** exits successfully with a summary of created paths

#### Scenario: Initialize non-empty workspace
- **WHEN** a user runs `init` in a directory with existing files
- **THEN** the system scans existing files to infer naming conventions
- **AND** writes inferred conventions to config
- **AND** creates only missing scaffold elements
- **AND** does not modify existing files

#### Scenario: Re-run init on existing workspace
- **WHEN** a user runs `init` in a directory that already contains some or all required folders
- **THEN** existing folders are preserved
- **AND** missing folders are created
- **AND** the command remains idempotent

### Requirement: Workspace Linting
The workspace tooling SHALL lint directory and file organization rules using
conventions read from the convention config. Lint rules SHALL include disallowed
file-type placement, stale index detection, and filename-folder consistency
checks.

#### Scenario: Disallowed file type placement
- **WHEN** lint runs and finds a PDF under `forms/`
- **THEN** lint reports a violation

#### Scenario: Stale index detection
- **WHEN** lint runs and workspace files are newer than `contracts-index.yaml`
- **THEN** lint reports the index as stale and recommends regeneration

#### Scenario: Lint uses configured conventions
- **WHEN** lint runs with a convention config specifying custom lifecycle folder names
- **THEN** lint validates against the configured folder names, not hardcoded defaults
