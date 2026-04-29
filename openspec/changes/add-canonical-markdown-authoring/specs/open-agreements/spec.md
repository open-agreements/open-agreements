## ADDED Requirements
### Requirement: Canonical Markdown Employment Template Authoring
The employment template renderer SHALL support canonical Markdown authoring
files that compile frontmatter, cover-term tables, clause directives,
definition paragraphs, alias metadata, and inline signer metadata into a
validated contract spec and rendered artifacts.

#### Scenario: [OA-TMP-033] Canonical Markdown definitions compile into a contract spec
- **WHEN** a canonical Markdown employment template contains a definitions
  clause where each paragraph declares its term with a first `[[...]]` span
- **THEN** the compiler derives the canonical defined term from that first
  bracketed span
- **AND** optional `(Aliases: [[...]], [[...]])` metadata is captured without
  rendering into the legal output
- **AND** cover-term rows authored with `Kind | Label | Value | Show When`
  compile into the validated contract spec model

#### Scenario: [OA-TMP-034] Explicit defined-term references validate against canonical terms and aliases
- **WHEN** canonical Markdown body text contains explicit `[[...]]` references
- **THEN** the compiler resolves each reference against either a canonical
  defined term or a declared alias
- **AND** unresolved references fail validation with an actionable error
- **AND** alias collisions with other aliases or canonical terms fail
  validation

#### Scenario: [OA-TMP-035] Canonical Markdown generates rendered employment template artifacts
- **WHEN** the employment template generator processes a canonical Markdown
  source with inline signer metadata
- **THEN** it treats `template.md` as the canonical source file
- **AND** writes the derived JSON spec alongside the rendered DOCX artifact
- **AND** the rendered signature section preserves the declared signer labels
  and rows
- **AND** authoring-only alias metadata is omitted from rendered legal output
