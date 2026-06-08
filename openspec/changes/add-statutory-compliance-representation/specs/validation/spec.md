## ADDED Requirements

### Requirement: Statutory Compliance Representation Field Validation
Template metadata SHALL support a narrow `statutory_compliance_representation: true`
boolean field category for representations whose truth is a statutory precondition to
enforceability. A field in this category MUST be `type: boolean`, MUST declare
`default: 'false'`, MUST declare an http(s) `authority_url`, and MUST declare a non-empty
`confirm_note`. The `authority_url` and `confirm_note` properties MUST only appear on a
`statutory_compliance_representation` field. The template validator SHALL require each such
field to be rendered as a `{IF !<field>}` conditional immediately followed by a `[CONFIRM
before signing: …]` bracket, and SHALL require the URL and note inside that bracket to
equal the field's metadata `authority_url` and `confirm_note`. Because `metadata.yaml` is
the single authoring source for these values (issue #413), this equality check guards the
committed rendered artifact (e.g. a stale, un-regenerated `template.docx`) and
hand-authored JSON templates rather than two hand-edited files. Presence of a bare
`{IF !<field>}` conditional without the CONFIRM bracket SHALL NOT satisfy the requirement.

#### Scenario: [OA-TMP-063] Statutory compliance representation field shape is enforced
- **WHEN** metadata declares a `statutory_compliance_representation` field
- **THEN** validation passes only if it is boolean with `default: 'false'`, an http(s)
  `authority_url`, and a non-empty `confirm_note`
- **AND** validation fails if it is non-boolean, defaults to `'true'`, omits
  `authority_url` or `confirm_note`, or if `authority_url`/`confirm_note` appear on a
  non-category field

#### Scenario: [OA-TMP-064] Validator requires the CONFIRM bracket and matching authority_url/confirm_note
- **WHEN** a `statutory_compliance_representation` field is rendered with a
  `{IF !<field>}` + `[CONFIRM before signing: <note>; see <url>]` bracket whose URL and
  note match the metadata `authority_url`/`confirm_note`
- **THEN** template validation passes
- **AND** validation fails when only `{IF !<field>}` is present without the bracket, or
  when the bracket URL or note drifts from the metadata `authority_url`/`confirm_note`
