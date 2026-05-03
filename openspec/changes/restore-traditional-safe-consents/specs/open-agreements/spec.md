## ADDED Requirements

### Requirement: Traditional Consent Layout Module
The system SHALL provide a `traditional-consent-v1` canonical-Markdown layout
module that renders consents with no cover-page table, a centered all-caps
title, italic drafting note, opening recital, centered+bold+underlined
section headings (no auto-numbering), inline-bold body text (e.g., for
`**WHEREAS**` and `**RESOLVED**` lead-ins), a `[Signature Page Follows]`
separator, and a separate signature page with preamble paragraphs followed by
a repeating signature stack.

#### Scenario: [OA-TMP-046] Traditional layout renders no cover-page table
- **WHEN** a template using `layout_id: traditional-consent-v1` is compiled
  and rendered
- **THEN** the rendered DOCX has no `<w:tbl>` elements in `word/document.xml`
- **AND** the rendered DOCX has no leaked Cover Terms / Standard Terms /
  Signature Page section labels

### Requirement: Optional Cover Terms in Canonical Markdown
The canonical-Markdown compiler and contract-spec schema SHALL accept
templates that omit both the `## Cover Terms` body section and the
`sections.cover_terms` frontmatter, so long as both are absent together.

#### Scenario: [OA-TMP-047] Compiler accepts templates without cover-page section
- **WHEN** a canonical Markdown template omits both `## Cover Terms` and
  `sections.cover_terms` in frontmatter
- **THEN** the compiler succeeds without raising an error
- **AND** the resulting contract spec has `sections.cover_terms` undefined

### Requirement: Traditional SAFE Consent Authoring
The SAFE board and SAFE stockholder consents SHALL be authored canonically
using `layout_id: traditional-consent-v1`, with `document.opening_note`
carrying the italic drafting note, `document.opening_recital` carrying the
opening recital paragraph, and `sections.standard_terms` containing the
WHEREAS/RESOLVED clause chain.

#### Scenario: [OA-TMP-048] Traditional SAFE consents render and fill faithfully
- **WHEN** the SAFE board or stockholder consent is compiled, rendered, and
  filled with reasonable signer data
- **THEN** the rendered DOCX has the centered all-caps title with the
  `{company_name}` placeholder substituted
- **AND** the italic drafting note appears immediately after the title
- **AND** the opening recital cites the appropriate DGCL section (§ 141(f) for
  the board consent, § 228 for the stockholder consent)
- **AND** each clause heading (`Approval of SAFE Financing`, `General
  Authorizing Resolution`) renders centered, bold, and underlined
- **AND** WHEREAS and RESOLVED lead-ins render as bold inline text
- **AND** the signature page expands the signer array into one block per
  signer with a `Print Name:` row carrying the signer name and a `Date:` row
  carrying the effective date
