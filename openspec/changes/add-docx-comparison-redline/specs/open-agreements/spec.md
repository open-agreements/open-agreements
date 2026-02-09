## ADDED Requirements

### Requirement: Redline Against Form
The system SHALL support generating a tracked-changes DOCX by comparing a prepared agreement against a reference form DOCX.

#### Scenario: Library API generates a redlined document
- **WHEN** the caller provides a `form` DOCX and an `agreement` DOCX
- **THEN** the system returns a DOCX buffer containing tracked changes representing the differences

#### Scenario: Wrapper engine policy
- **WHEN** the caller uses `redlineAgainstForm()`
- **THEN** the wrapper SHALL use the `atomizer` engine
- **AND** the wrapper SHALL NOT expose engine selection
- **AND** callers who want `diffmatch` SHALL use `@open-agreements/docx-comparison` directly

### Requirement: Redline CLI
The CLI SHALL support generating a redlined DOCX.

#### Scenario: Missing input paths
- **WHEN** `--form` or `--agreement` path does not exist
- **THEN** the CLI exits with code 1
- **AND** prints `Error: File not found: <path>` to stderr

#### Scenario: Default output path
- **WHEN** the user omits `--out`
- **THEN** the CLI writes `<agreement>.redlined.docx` next to the agreement path

#### Scenario: Default author
- **WHEN** the user omits `--author`
- **THEN** the CLI uses the default author `OpenAgreements`

#### Scenario: Success behavior
- **WHEN** the comparison succeeds
- **THEN** the CLI exits with code 0
- **AND** prints the output path to stdout
