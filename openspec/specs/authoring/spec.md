# authoring Specification

## Purpose
Defines the authoring capability after restructuring the legacy open-agreements monolith.
## Requirements
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

### Requirement: Conditional Clause Clean Omission
The canonical Markdown renderer SHALL treat a `when=<field>` (`condition`) clause that
declares NO `omitted=` (`omitted_body`) as fully omitted when the field is false: the clause
heading AND body MUST both be gated by the condition so that nothing — no heading, no
placeholder — renders when the field is false. A `when=<field> omitted="<text>"` clause MUST
retain the existing behavior (the heading always renders, with the body swapped for the
`omitted_body` placeholder when the field is false). A `when=` clause without `omitted=` MUST
NOT render its heading or body unconditionally.

#### Scenario: [OA-TMP-066] when= without omitted= drops the whole clause
- **WHEN** a canonical source declares an `oa:clause` with `when=<field>` and no `omitted=`
- **THEN** the rendered DOCX wraps the clause heading and body together in `{IF <field>}` …
  `{END-IF}`
- **AND** filling with the field false yields no heading and no `[Intentionally Omitted.]`
  placeholder for that clause

#### Scenario: [OA-TMP-067] when= with omitted= keeps the placeholder
- **WHEN** a canonical source declares an `oa:clause` with `when=<field> omitted="<text>"`
- **THEN** the rendered DOCX still emits the clause heading unconditionally and swaps the body
  for `<text>` gated on `{IF !<field>}`

### Requirement: Conditional Applicability of Confirmation Clauses
The canonical Markdown renderer SHALL allow a `confirm=<field>` clause to also declare a
`when=<gate>` applicability condition. `confirm=` MUST still be rejected when combined with
`omitted=`. When both `confirm=` and `when=` are present, the entire confirm clause — its
heading, its always-rendering body, and its `{IF !<field>}` `[CONFIRM before signing: …]`
bracket — MUST be wrapped in `{IF <gate>}` … `{END-IF}` so the clause (and its bracket) is
fully absent when the gate is false. The in-body `{IF !<field>}` + `[CONFIRM before signing:
…; see <authority_url>]` bracket MUST remain intact within the gate so the compliance
validator still recognizes it.

#### Scenario: [OA-TMP-068] confirm= combines with when= as an applicability gate
- **WHEN** a canonical source declares an `oa:clause` with both `confirm=<field>` and
  `when=<gate>` (and no `omitted=`)
- **THEN** the compiled clause carries `confirm` and `condition`
- **AND** the rendered DOCX wraps the heading, body, and the `{IF !<field>}` CONFIRM bracket in
  `{IF <gate>}` … `{END-IF}`
- **AND** filling with `<gate>` false yields neither the recital nor the CONFIRM bracket, while
  filling with `<gate>` true and `<field>` false yields the recital plus the bracket

#### Scenario: [OA-TMP-069] confirm= combined with omitted= is still rejected
- **WHEN** a canonical source declares an `oa:clause` with `confirm=<field>` and `omitted="…"`
- **THEN** compiling the canonical source fails with a descriptive error

### Requirement: Cover-Notice Cross-Reference Anchors and Hyperlinks
When the renderer emits the cover confirmation notice, each listed confirm clause's heading SHALL be
wrapped in a bookmark named `oa_xref_HASH` (a hash of the clause id, so the name satisfies Word's
bookmark-name constraints), and each notice bullet SHALL read `• SECTION-NUMBER — HEADING — for more
details see URL`. The section number MUST be a `<<xref:bookmark>>` sentinel wrapped in an internal
hyperlink anchored to that heading bookmark (resolved to the live `Section N` by the fill pipeline).
The URL MUST be a real external hyperlink (a `word/_rels/document.xml.rels` relationship with
`TargetMode="External"`), not plain text. Anchors SHALL be emitted only for clauses the notice links
to. The bullet text MUST NOT contain the literal `[CONFIRM before signing:` token, and the in-body
`[CONFIRM …; see URL]` bracket MUST remain plain text so the statutory-compliance representation
validator is unaffected.

#### Scenario: [OA-TMP-075] Rendered template emits the anchor, sentinel, and external hyperlink
- **WHEN** a template with a `confirm=` clause is rendered
- **THEN** the confirm clause heading carries an `oa_xref_*` bookmark and the cover bullet carries
  the matching `<<xref:bookmark>>` sentinel inside an internal hyperlink to that bookmark
- **AND** the "for more details" URL is an external hyperlink relationship, and the unresolved
  sentinel is not reported as an unknown placeholder by template validation

