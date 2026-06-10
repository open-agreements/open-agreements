## ADDED Requirements

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
