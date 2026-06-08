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

### Requirement: Canonical Employment Templates Use the Signer Model
First-party employment templates SHALL express asymmetric signer semantics
through canonical signer metadata instead of mirrored `two-party` rows.

#### Scenario: [OA-TMP-057] Offer letter and employment signer sources avoid mirrored individual title rows
- **WHEN** the canonical employment template sources are compiled into contract
  specs
- **THEN** the employment offer letter is sourced from canonical `template.md`
  with a committed derived JSON spec
- **AND** the offer letter, Employee IP assignment, and Wyoming restrictive
  covenant templates all use `mode: signers`
- **AND** the entity signer may include `Title`
- **AND** the individual signer does not include `Title`
- **AND** no first-party employment template relies on `left_only`

### Requirement: Canonical Markdown Section Directive Anchors
The canonical Markdown compiler SHALL support
`<!-- oa:section type=... -->` directives that bind semantic section types to
the body H2 that immediately follows each directive. Supported section types
SHALL include `standard_terms`, `signature`, and `recitals`.

#### Scenario: [OA-TMP-054] Directive-anchored sections compile with author-chosen headings
- **WHEN** a canonical Markdown source declares
  `<!-- oa:section type=standard_terms -->` before an H2 such as
  `## Resolutions`
- **AND** declares `<!-- oa:section type=signature -->` before the signature H2
- **THEN** the compiler maps those body sections into the operative and
  signature contract-spec sections
- **AND** the H2 text may differ from `Standard Terms` and `Signatures`
- **AND** unknown `oa:section` types fail validation with an actionable error

#### Scenario: [OA-TMP-055] Legacy required titles remain accepted during migration
- **WHEN** a canonical Markdown source omits `oa:section` directives but still
  includes `## Standard Terms` and `## Signatures`
- **THEN** the compiler continues to accept the source during the migration
  window
- **AND** a directive, when present for the same semantic section, takes
  precedence over title-based fallback

### Requirement: Canonical Markdown Repeat-Backed Signer Authoring
The canonical Markdown compiler and shared branded-template renderer SHALL
support repeat-backed stacked signer sections declared on
`oa:signature-mode`.

#### Scenario: [OA-TMP-058] Repeat-backed stacked signer sections compile into loop-backed output
- **WHEN** a canonical Markdown template declares
  `<!-- oa:signature-mode arrangement=stacked repeat=signers item=signer -->`
  and authors one signer prototype using `{signer.*}` references
- **THEN** the compiler records repeat metadata in the contract spec
- **AND** the rendered output emits `{FOR signer IN signers}`
- **AND** signer row values render with loop-safe placeholders such as
  `{$signer.name}`
- **AND** the rendered output closes the loop with `{END-FOR signer}`
