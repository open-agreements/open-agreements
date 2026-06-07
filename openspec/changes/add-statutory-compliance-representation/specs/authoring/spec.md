## ADDED Requirements

### Requirement: Statutory Compliance Representation Clause Authoring
The canonical Markdown renderer SHALL support a `confirm=<field>` attribute on an
`oa:clause` directive that marks the clause as reciting a statutory compliance
representation. `confirm=` MUST name a single boolean field (the `always` value is NOT a
sentinel and MUST be rejected) and MUST NOT be combined with `when=`/`condition` or
`omitted`. Per single-source-of-truth (issue #413), the directive MUST NOT restate
`confirm_note` or `authority_url`; the canonical compiler SHALL resolve both from the
named field's `metadata.yaml` entry (reading the sibling `metadata.yaml`), and the named
field MUST be a `statutory_compliance_representation` field declaring a non-empty
`confirm_note` and an http(s) `authority_url`. When `confirm=` is present, the clause body
SHALL always render, and the renderer SHALL append a yellow-highlighted `[CONFIRM before
signing: <confirm_note>; see <authority_url>]` bracket gated on `{IF !<field>}` so that
the bracket appears only while the field is false (unconfirmed) and is dropped cleanly
when the field is true (confirmed). The renderer SHALL NOT silently omit the clause and
SHALL NOT emit future-tense fallback phrasing.

#### Scenario: [OA-TMP-061] confirm= compiles and renders a highlighted CONFIRM bracket
- **WHEN** a canonical source declares an `oa:clause` with `confirm=<field>` and the named
  field in `metadata.yaml` is a `statutory_compliance_representation` with `confirm_note`
  and `authority_url`
- **THEN** the compiled clause carries `confirm`/`confirm_note`/`authority_url` (resolved
  from metadata, and no `condition`/`omitted_body`)
- **AND** the rendered DOCX contains the clause body unconditionally plus a yellow-
  highlighted `[CONFIRM before signing: <confirm_note>; see <authority_url>]` run gated on
  `{IF !<field>}`

#### Scenario: [OA-TMP-062] Misused confirm= is rejected at compile time
- **WHEN** a `confirm=` clause also declares `when=`/`omitted`, restates `confirm_note`/
  `authority_url` in the directive, names a non-field-name value, or names a field that is
  missing from metadata, is not a `statutory_compliance_representation`, or lacks a
  non-empty `confirm_note` / http(s) `authority_url`
- **THEN** compiling the canonical source fails with a descriptive error

#### Scenario: [OA-TMP-065] confirm= note/url resolve from the sibling metadata.yaml
- **WHEN** `compileCanonicalSourceFile` compiles a template whose `confirm=<field>` clause
  names a `statutory_compliance_representation` field defined only in the sibling
  `metadata.yaml` (the directive carries no `confirm_note`/`authority_url`)
- **THEN** the compiled clause's `confirm_note` and `authority_url` are populated from that
  metadata field
