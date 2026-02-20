# MCP Server Specification Delta

## ADDED Requirements

### Requirement: Formatting-Preserving Replacement with Run Normalization
The Safe-Docx MCP server SHALL support formatting-preserving text replacement via `smart_edit`, with an optional `normalize_first` flag to merge fragmented runs before searching.

#### Scenario: replace_text performs formatting-preserving replacement
- **GIVEN** a document paragraph targeted by stable `jr_para_*` identity
- **WHEN** `smart_edit` is called with a unique `old_string` and `new_string`
- **THEN** the server SHALL apply the replacement deterministically
- **AND** SHALL preserve surrounding run formatting as closely as possible

#### Scenario: replace_text can normalize fragmented runs before search
- **GIVEN** matching text is fragmented across adjacent format-identical runs
- **WHEN** `smart_edit` is called with `normalize_first` enabled
- **THEN** the server SHALL normalize mergeable runs before search
- **AND** SHALL apply replacement only after post-normalization uniqueness is confirmed

### Requirement: Comment and Reply Authoring
The Safe-Docx MCP server SHALL provide an `add_comment` helper tool that supports root comments and threaded replies with deterministic OOXML wiring.

#### Scenario: add root comment to target range
- **GIVEN** a document and a caller-provided comment body and author metadata
- **WHEN** `add_comment` is called for a target paragraph/range
- **THEN** the server SHALL create a comment entry and anchor markers in OOXML
- **AND** the saved document SHALL display the comment in Microsoft Word

#### Scenario: add threaded reply linked to parent comment
- **GIVEN** an existing parent comment ID
- **WHEN** `add_comment` is called with `parent_comment_id`
- **THEN** the server SHALL create a reply comment linked to that parent
- **AND** thread linkage metadata SHALL be persisted in the appropriate comment extension part

#### Scenario: comment parts are bootstrapped when missing
- **GIVEN** a DOCX file with no existing comment parts
- **WHEN** `add_comment` is called
- **THEN** the server SHALL create required comment XML parts from packaged templates
- **AND** SHALL add required relationship/content-type entries for those parts

### Requirement: Run Consolidation and Redline Simplification (Internal Primitives)
The Safe-Docx MCP server SHALL apply run consolidation and redline simplification as internal primitives during normalize-on-open, ensuring clean document state for downstream tools.

#### Scenario: merge_runs consolidates adjacent format-identical runs
- **WHEN** a document containing mergeable adjacent runs is opened
- **THEN** the server SHALL merge adjacent runs whose effective run properties are equivalent
- **AND** SHALL preserve visible text order and paragraph structure

#### Scenario: simplify_redlines merges adjacent same-author tracked wrappers
- **GIVEN** adjacent tracked-change wrappers (`w:ins` or `w:del`) from the same author
- **WHEN** a document is opened with normalization enabled
- **THEN** the server SHALL merge adjacent wrappers of the same change type
- **AND** SHALL NOT merge across different change types or non-whitespace separators

#### Scenario: simplify_redlines reports tracked-change author summary
- **WHEN** a document with tracked changes is opened
- **THEN** the server SHALL return normalization statistics including tracked-change consolidation counts
- **AND** SHALL provide normalization metadata in the open response

### Requirement: Document Validation and Auto-Repair (Internal Primitives)
The Safe-Docx MCP server SHALL apply document validation as an internal primitive during download, and auto-repair as an internal primitive during normalize-on-open.

#### Scenario: validate packed or unpacked DOCX inputs
- **WHEN** a document is downloaded via the `download` tool
- **THEN** the server SHALL validate the document before output
- **AND** SHALL return structured pass/fail diagnostics on validation failure

#### Scenario: redline validation runs when original baseline is provided
- **GIVEN** an edited document with a baseline (original file retained in session)
- **WHEN** the document is downloaded in clean format
- **THEN** the server SHALL run validation checks against the edited content
- **AND** SHALL produce a valid output file

#### Scenario: auto-repair fixes known safe issues
- **GIVEN** a document containing known safe issues (e.g., proofErr elements, fragmented runs)
- **WHEN** the document is opened with normalization enabled
- **THEN** the server SHALL repair supported issue classes during normalization
- **AND** the repaired content SHALL remain accessible through standard read operations
