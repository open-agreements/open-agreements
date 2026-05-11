## ADDED Requirements

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

### Requirement: SAFE Consent Recitals Authoring
The SAFE board and SAFE stockholder canonical consents SHALL support a separate
`recitals` body section so WHEREAS clauses can be authored separately from the
operative resolutions while preserving rendered legal content.

#### Scenario: [OA-TMP-056] SAFE consents separate WHEREAS and RESOLVED content
- **WHEN** a SAFE board or stockholder consent canonical source declares
  `<!-- oa:section type=recitals -->` before `## Recitals` and
  `<!-- oa:section type=standard_terms -->` before `## Resolutions`
- **THEN** WHEREAS clauses compile into the `recitals` section
- **AND** RESOLVED clauses compile into the operative section
- **AND** the rendered traditional consent output preserves the recital text,
  resolution text, ordering, and signature behavior
