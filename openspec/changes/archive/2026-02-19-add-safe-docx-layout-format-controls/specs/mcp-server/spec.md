# MCP Server Specification Delta

## ADDED Requirements

### Requirement: Deterministic Layout Formatting Tool
The Safe-Docx MCP server SHALL provide a deterministic `format_layout` tool to mutate document layout geometry without changing paragraph text content.

#### Scenario: format paragraph spacing by paragraph ID
- **GIVEN** an active Safe-Docx session with known `jr_para_*` IDs
- **WHEN** `format_layout` is called with `paragraph_spacing` targeting one or more paragraph IDs
- **THEN** the server SHALL set OOXML paragraph spacing values on those paragraphs
- **AND** SHALL return the count of affected paragraphs

#### Scenario: format table row height and cell padding
- **GIVEN** an active session containing one or more tables
- **WHEN** `format_layout` is called with `row_height` and/or `cell_padding` selectors
- **THEN** the server SHALL set the requested table geometry values in OOXML
- **AND** SHALL return affected row/cell counts

#### Scenario: invalid layout values are rejected with structured error
- **WHEN** `format_layout` receives invalid enum values, negative geometry units, or malformed selectors
- **THEN** the server SHALL reject the request with a structured error response
- **AND** SHALL include remediation guidance in the error hint

### Requirement: Layout Mutations Preserve Document Identity
Layout formatting operations SHALL preserve paragraph identity and text structure.

#### Scenario: no spacer paragraphs are introduced
- **GIVEN** a document with N paragraphs before layout formatting
- **WHEN** `format_layout` is applied
- **THEN** the document SHALL still contain N paragraphs
- **AND** no empty spacer paragraph SHALL be inserted as a layout workaround

#### Scenario: paragraph IDs remain stable after layout formatting
- **GIVEN** a document with existing `jr_para_*` identifiers
- **WHEN** `format_layout` mutates paragraph spacing or table geometry
- **THEN** existing paragraph IDs SHALL remain addressable and unchanged for untouched paragraphs

### Requirement: Runtime Dependency Boundary for Safe-Docx
Safe-Docx runtime distribution SHALL remain Node/TypeScript-only and SHALL NOT require Aspose/Python runtime dependencies for layout formatting.

#### Scenario: npx runtime remains Python-free
- **WHEN** a user installs and runs `npx @usejunior/safe-docx`
- **THEN** layout formatting functionality SHALL be available without Python or Aspose runtime installation

#### Scenario: build-time tooling may be external but optional
- **WHEN** teams use external local build-time formatting scripts
- **THEN** those scripts SHALL be optional and SHALL NOT be required for core Safe-Docx MCP runtime behavior
