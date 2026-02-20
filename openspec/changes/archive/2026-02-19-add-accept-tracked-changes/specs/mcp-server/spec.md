## ADDED Requirements

### Requirement: Accept Tracked Changes Tool
The Safe-Docx MCP server SHALL provide an `accept_changes` tool that accepts all tracked changes in the document body, producing a clean .docx with no revision markup in the body. v1 scope is document body only; headers, footers, footnotes, and endnotes are deferred.

#### Scenario: accept_changes produces clean document body with no revision markup
- **GIVEN** a document containing tracked changes (insertions, deletions, formatting changes, moves) in the document body
- **WHEN** `accept_changes` is called
- **THEN** the server SHALL return a document with all tracked changes in the body accepted
- **AND** the response SHALL include acceptance stats (insertions accepted, deletions accepted, moves resolved, property changes resolved)
- **AND** tracked changes in headers, footers, footnotes, and endnotes SHALL remain unmodified in v1

#### Scenario: accepted document opens cleanly in Microsoft Word
- **GIVEN** a document with tracked changes that has been processed by `accept_changes`
- **WHEN** the resulting document is opened in Microsoft Word
- **THEN** the document SHALL open without errors or repair prompts
- **AND** no tracked changes SHALL appear in the review pane

#### Scenario: original document is not mutated
- **GIVEN** a source document with tracked changes
- **WHEN** `accept_changes` is called
- **THEN** the original source document SHALL remain unchanged
- **AND** the accepted output SHALL be written to a separate file or session working copy
