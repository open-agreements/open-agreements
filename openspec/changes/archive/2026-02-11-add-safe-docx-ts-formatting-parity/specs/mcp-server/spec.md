# MCP Server Specification Delta

## ADDED Requirements

### Requirement: Tool Feature Parity
The TypeScript Safe-Docx MCP server SHALL match the Python editing pipeline’s formatting fidelity for core editing operations, not merely structural validity.

#### Scenario: read_file returns TOON schema with structure columns
- **WHEN** `read_file` is called for a session
- **THEN** the server SHALL return TOON output using the schema:
  - `#SCHEMA id | list_label | header | style | text`
- **AND** each row SHALL include:
  - `id` as `jr_para_*`
  - `list_label` derived programmatically (empty for non-list paragraphs)
  - `header` derived programmatically for run-in headers (empty otherwise)
  - `style` as a stable, fingerprint-derived style ID (e.g., `body_1`, `section`)
  - `text` as the paragraph’s LLM-visible text (with header stripped when header column is populated)

#### Scenario: smart_edit preserves mixed-run formatting
- **GIVEN** a paragraph whose visible text spans multiple runs with different formatting (e.g., underline on one run, plain on the next)
- **WHEN** `smart_edit` replaces a substring spanning those runs
- **THEN** the output paragraph SHALL preserve the original mixed formatting structure as closely as possible
- **AND** SHALL NOT flatten the entire replacement span to a single run’s formatting template

#### Scenario: smart_insert preserves header/definition semantics
- **WHEN** `smart_insert` inserts content that includes explicit definitions and/or a run-in header
- **THEN** the inserted paragraph(s) SHALL preserve formatting conventions via role models
- **AND** run-in headers SHALL populate the `header` column rather than being duplicated inline

### Requirement: DocumentView IR and JSON Mode
The TypeScript Safe-Docx MCP server SHALL build and cache a DocumentView IR per session and support a machine-readable JSON output mode for parity testing and downstream tooling.

#### Scenario: read_file JSON mode returns node metadata
- **WHEN** `read_file` is called with `format="json"`
- **THEN** the server SHALL return a JSON payload containing nodes with:
  - `id`, `list_label`, `header`, `style`, `text`
  - `style_fingerprint` (raw stable fingerprint)
  - `header_formatting` (bold/italic/underline metadata when applicable)
  - numbering metadata (e.g., `numId`, `ilvl`) when applicable

### Requirement: Style Fingerprinting and Stable Style IDs
The server SHALL compute a deterministic, stable style fingerprint for each paragraph and map fingerprints to stable style IDs suitable for LLM consumption.

#### Scenario: fingerprint ignores volatile attributes
- **GIVEN** two documents that differ only by volatile OOXML attributes (e.g., `w:rsid*`, revision IDs/dates)
- **WHEN** the server computes style fingerprints for corresponding paragraphs
- **THEN** the fingerprints SHALL be equal
- **AND** the derived `style` IDs in TOON output SHALL be equal

#### Scenario: stable style IDs within a session
- **WHEN** `read_file` is called multiple times within a session
- **THEN** the same paragraph SHALL retain the same `style` value unless its paragraph/run properties meaningfully change

### Requirement: Header Column Detection and De-Duplication
The server SHALL detect run-in headers programmatically and represent them in the dedicated `header` column, without duplicating the header text in the `text` column.

#### Scenario: formatting-based header detection
- **GIVEN** a paragraph beginning with a short bold/underlined span ending in punctuation (e.g., `“Security Incidents:”`)
- **WHEN** the document is ingested to DocumentView
- **THEN** the server SHALL extract `Security Incidents` into the `header` column
- **AND** SHALL strip the header span from the `text` column
- **AND** SHALL record `header_formatting` metadata for edit rendering

### Requirement: Semantic Tags and Role Model Rendering
The server SHALL support semantic tags in inserted/replacement text and render them into concrete OOXML formatting using role models discovered in the document.

#### Scenario: defined term bolding via <definition> role model
- **GIVEN** a document with existing explicit definitions where defined terms are styled (e.g., bold + quoted)
- **WHEN** an insertion or replacement includes `<definition>Term</definition> means …`
- **THEN** the server SHALL render `Term` using the discovered role model’s styling
- **AND** the saved `.docx` SHALL NOT contain the literal `<definition>` tag text

### Requirement: Explicit Definition Auto-Tagging
The server SHALL automatically detect explicit definition patterns in inserted/replacement text and apply definition styling via role models without requiring the caller to include `<definition>` tags.

#### Scenario: auto-tagged explicit definition gets role model styling
- **GIVEN** a document with existing explicit definitions where the defined term has a consistent style (e.g., bold)
- **WHEN** an insertion or replacement includes an explicit definition like `"Closing Cash" means …` (without semantic tags)
- **THEN** the server SHALL detect `"Closing Cash"` as the definition term
- **AND** apply the role model definition styling to the term
- **AND** preserve quotes/brackets exactly as provided in the input text

#### Scenario: header semantics accepted via tags for backward compatibility
- **WHEN** an edit includes `<RunInHeader>Header</RunInHeader>` or `<header>Header</header>`
- **THEN** the server SHALL render the header into the `header` column representation
- **AND** apply stored header formatting metadata when writing OOXML runs

### Requirement: Formatting Surgeon (Deterministic)
The server SHALL use a deterministic formatting surgeon for edits that require run splitting, multi-run replacements, and field-aware visible-text mapping.

#### Scenario: field-aware visible text does not destroy fields
- **GIVEN** a paragraph containing Word fields (e.g., `MERGEFIELD`, `REF`, etc.)
- **WHEN** a `smart_edit` targets visible text adjacent to fields
- **THEN** the server SHALL preserve field structure (`w:fldChar`, `w:instrText`, etc.)
- **AND** SHALL refuse edits that would require unsafe field rewrites

### Requirement: Hook Pipeline (Normalization + Invariants)
The server SHALL run a hook pipeline around tool execution to normalize inputs and enforce invariants comparable to the Python editing pipeline.

#### Scenario: pagination rules deterministic for zero offset
- **WHEN** `read_file` is called with `offset=0`
- **THEN** the server SHALL treat `offset=0` as start-of-document
- **AND** SHALL return the same window as `offset` omitted (subject to `limit`)

#### Scenario: post-edit invariants prevent empty paragraph stubs
- **WHEN** an edit operation splits runs or inserts/removes paragraph-level nodes
- **THEN** the server SHALL remove empty runs/paragraph stubs introduced by the operation
- **AND** the resulting document SHALL open cleanly in Microsoft Word
