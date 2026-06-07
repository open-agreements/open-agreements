## ADDED Requirements

### Requirement: Statutory Compliance Representation Clause Authoring
The canonical Markdown renderer SHALL support a `confirm=<field>` attribute on an
`oa:clause` directive that marks the clause as reciting a statutory compliance
representation. `confirm=` MUST name a single boolean field (the `always` value is NOT a
sentinel and MUST be rejected), MUST be accompanied by a non-empty `confirm_note` and an
http(s) `authority_url`, and MUST NOT be combined with `when=`/`condition` or
`omitted`. When `confirm=` is present, the clause body SHALL always render, and the
renderer SHALL append a yellow-highlighted `[CONFIRM before signing: <confirm_note>; see
<authority_url>]` bracket gated on `{IF !<field>}` so that the bracket appears only while
the field is false (unconfirmed) and is dropped cleanly when the field is true
(confirmed). The renderer SHALL NOT silently omit the clause and SHALL NOT emit
future-tense fallback phrasing.

#### Scenario: [OA-TMP-061] confirm= compiles and renders a highlighted CONFIRM bracket
- **WHEN** a canonical source declares an `oa:clause` with `confirm=<field>`,
  `confirm_note`, and `authority_url`
- **THEN** the compiled clause carries `confirm`/`confirm_note`/`authority_url` (and no
  `condition`/`omitted_body`)
- **AND** the rendered DOCX contains the clause body unconditionally plus a yellow-
  highlighted `[CONFIRM before signing: …; see <authority_url>]` run gated on
  `{IF !<field>}`

#### Scenario: [OA-TMP-062] Misused confirm= is rejected at compile time
- **WHEN** a `confirm=` clause also declares `when=`/`omitted`, omits `confirm_note` or
  `authority_url`, or names a non-field-name value
- **THEN** compiling the canonical source fails with a descriptive error
