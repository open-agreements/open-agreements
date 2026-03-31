## MODIFIED Requirements

### Requirement: YAML Status Index Generation
The workspace tooling SHALL generate a YAML status index summarizing contract
files, inferred lifecycle state, and lint findings. The indexer SHALL walk all
non-ignored directories under the workspace root, not only lifecycle directories.
Documents in lifecycle folders SHALL have their lifecycle field populated;
documents in other folders SHALL have lifecycle set to undefined. Generated
output MUST include a generation timestamp.

#### Scenario: [OA-WKS-013] Generate contracts index
- **WHEN** a user runs `status generate`
- **THEN** the tool writes `contracts-index.yaml`
- **AND** includes an explicit generation timestamp
- **AND** includes per-document status records

#### Scenario: [OA-WKS-046] Index documents in non-lifecycle folders
- **WHEN** `status generate` runs on a workspace with documents in custom folders
- **THEN** documents in all non-ignored directories are included in the index
- **AND** documents in lifecycle folders have lifecycle populated
- **AND** documents in other folders have lifecycle undefined

#### Scenario: [OA-WKS-047] Skip ignored directories
- **WHEN** the indexer walks the workspace
- **THEN** dot-directories, `.contracts-workspace`, `.git`, and `node_modules` are excluded
- **AND** only files with document extensions (pdf, docx, doc, txt, rtf, md) are collected

### Requirement: Workspace Linting
The workspace tooling SHALL lint directory and file organization rules,
including disallowed file-type placement and stale index detection. Lint rules
that reference lifecycle folders SHALL only fire for documents in lifecycle
directories.

#### Scenario: [OA-WKS-014] Disallowed file type placement
- **WHEN** lint runs and finds a PDF under `forms/`
- **THEN** lint reports a violation

#### Scenario: [OA-WKS-015] Stale index detection
- **WHEN** lint runs and workspace files are newer than `contracts-index.yaml`
- **THEN** lint reports the index as stale and recommends regeneration

#### Scenario: [OA-WKS-048] Lifecycle lint rules skip non-lifecycle documents
- **WHEN** lint runs on documents in non-lifecycle folders
- **THEN** lifecycle-specific rules (executed marker, disallowed file type) do not fire
