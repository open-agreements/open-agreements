## ADDED Requirements

### Requirement: Pure TypeScript DOCX Comparison
The system SHALL provide a pure TypeScript DOCX comparison engine that produces a DOCX containing Word track-changes markup.

#### Scenario: Compare returns tracked changes without external runtimes
- **WHEN** the caller compares two DOCX buffers
- **THEN** the system returns a DOCX with `w:ins` and `w:del` changes
- **AND** the comparison operation SHALL NOT require .NET or Word automation

### Requirement: Engine Selection
The system SHALL support selecting a comparison engine from a supported pure TypeScript set.

#### Scenario: Atomizer engine is available
- **WHEN** the caller selects `engine: 'atomizer'`
- **THEN** the system performs an atom-level comparison and returns a tracked-changes DOCX

#### Scenario: Diffmatch engine is available
- **WHEN** the caller selects `engine: 'diffmatch'`
- **THEN** the system performs a paragraph-level comparison and returns a tracked-changes DOCX

### Requirement: Output Semantics
The system SHALL treat the reference form as the structural base of the output document.

#### Scenario: Output uses form as base
- **WHEN** the caller compares `form` (original) against `agreement` (revised)
- **THEN** the output DOCX SHALL preserve the form's structure
- **AND** the output track changes SHALL represent the delta needed to produce the agreement

#### Scenario: Move operations may be present
- **WHEN** the caller uses `engine: 'atomizer'`
- **THEN** the output MAY include `w:moveFrom` and `w:moveTo` operations

#### Scenario: Move operations are not required for diffmatch
- **WHEN** the caller uses `engine: 'diffmatch'`
- **THEN** the output is NOT REQUIRED to include `w:moveFrom` and `w:moveTo`

### Requirement: Author Metadata
The system SHALL attach author metadata to revision elements.

#### Scenario: Author specified
- **WHEN** the caller provides an `author` string
- **THEN** all `w:ins` and `w:del` elements in the output SHALL include `w:author` set to that string

#### Scenario: Author omitted
- **WHEN** the caller omits `author`
- **THEN** the system SHALL use the default author value `OpenAgreements`

### Requirement: Error Behavior
The system SHALL fail fast with typed errors for invalid inputs.

#### Scenario: Empty buffer
- **WHEN** the caller provides an empty buffer
- **THEN** the system throws `InvalidDocxError` with a descriptive message

#### Scenario: Non-DOCX buffer
- **WHEN** the caller provides a non-DOCX buffer
- **THEN** the system throws `InvalidDocxError` with a descriptive message

#### Scenario: Corrupt DOCX
- **WHEN** the caller provides a corrupt DOCX (e.g., valid ZIP but invalid OOXML)
- **THEN** the system throws `InvalidDocxError` with context about which part is invalid

### Requirement: Determinism
The system SHALL document whether outputs are byte-identical.

#### Scenario: Semantic determinism (v1)
- **GIVEN** identical inputs and options
- **WHEN** the comparison is performed multiple times
- **THEN** the output SHALL be semantically equivalent
- **AND** the output is NOT REQUIRED to be byte-identical (ZIP ordering and XML serialization may vary)
