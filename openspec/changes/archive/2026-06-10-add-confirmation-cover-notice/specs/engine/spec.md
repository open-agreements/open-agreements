## ADDED Requirements

### Requirement: Confirmation Pending Derived Field
The fill pipeline SHALL derive a template-wide `any_confirmation_pending` boolean that is true
when any APPLICABLE `confirm=` clause (its `when=` gate is true, or it has no gate) is still
unconfirmed (its boolean confirm field is not true). This derived boolean MUST be added to the
fill data so `{IF any_confirmation_pending}` can reference it, and MUST be excluded from the
"fields used" report (a synthetic key, like multiselect-derived `<option>_enabled` booleans).
Per-clause visibility is handled in the DOCX itself by nesting `{IF <gate>}{IF !<confirm>}`,
so no per-clause derived key is required.

#### Scenario: [OA-TMP-070] any_confirmation_pending is derived at fill time
- **WHEN** a template is filled and contains a `confirm=<field>` clause gated by `when=<gate>`
- **THEN** the fill data contains `any_confirmation_pending` true only when `<gate>` is true and
  `<field>` is false (the clause is applicable and unconfirmed), and false otherwise
- **AND** `any_confirmation_pending` does not appear in the filled template's "fields used" report

### Requirement: Confirmation Cover Notice
When a template contains at least one `confirm=` clause, the renderer SHALL place a
yellow-highlighted confirmation notice on the cover page (page one), above the standard terms,
gated on `{IF any_confirmation_pending}`. The notice SHALL list each still-unconfirmed
applicable confirm clause, each line gated on that clause's own `{IF <gate>}{IF !<confirm>}`
nesting and naming the clause heading and its `authority_url`. The notice text MUST NOT contain
the literal `[CONFIRM before signing:` token, so it cannot satisfy or spoof the in-body
compliance bracket. When no confirmation is pending, the entire notice MUST be absent.

#### Scenario: [OA-TMP-071] Cover notice appears only when a confirmation is pending
- **WHEN** a template with a `confirm=` clause is filled such that an applicable confirm field
  is false
- **THEN** the cover page renders a yellow notice naming the unconfirmed clause and its
  `authority_url`
- **AND** when every applicable confirm field is true (or no confirm clause applies), the cover
  notice is entirely absent

### Requirement: Clause Renumbering After Conditional Resolution
After the fill pipeline resolves `{IF}` conditionals, it SHALL renumber the standard-terms
clause headings sequentially (1..N in document order) so that a fully-omitted clause leaves no
gap in the numbering. The renumber pass MUST operate on the concatenated text of each clause
heading paragraph (identified by its heading paragraph style) and rewrite only the leading
numeric prefix. It MUST be idempotent: a document with already-sequential numbering is
unchanged.

#### Scenario: [OA-TMP-072] Omitting a clause renumbers the remainder with no gap
- **WHEN** a filled template has one or more standard-terms clauses fully omitted by a false
  `when=` gate
- **THEN** the surviving clause headings are numbered sequentially starting at 1 with no skipped
  numbers
- **AND** a fill in which no clause is omitted produces the same sequential numbering (the pass
  is idempotent)
