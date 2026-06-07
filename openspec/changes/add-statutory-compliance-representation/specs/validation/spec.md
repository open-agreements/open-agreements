## ADDED Requirements

### Requirement: Statutory Compliance Representation Field Validation
Template metadata SHALL support a narrow `statutory_compliance_representation: true`
boolean field category for representations whose truth is a statutory precondition to
enforceability. A field in this category MUST be `type: boolean`, MUST declare
`default: 'false'`, and MUST declare an http(s) `authority_url`. The `authority_url`
property MUST only appear on a `statutory_compliance_representation` field. The template
validator SHALL require each such field to be rendered as a `{IF !<field>}` conditional
immediately followed by a `[CONFIRM before signing: …]` bracket, and SHALL require the URL
inside that bracket to equal the field's metadata `authority_url` (so metadata.yaml and
template.md cannot drift). Presence of a bare `{IF !<field>}` conditional without the
CONFIRM bracket SHALL NOT satisfy the requirement.

#### Scenario: [OA-TMP-063] Statutory compliance representation field shape is enforced
- **WHEN** metadata declares a `statutory_compliance_representation` field
- **THEN** validation passes only if it is boolean with `default: 'false'` and an http(s)
  `authority_url`
- **AND** validation fails if it is non-boolean, defaults to `'true'`, omits
  `authority_url`, or if `authority_url` appears on a non-category field

#### Scenario: [OA-TMP-064] Validator requires the CONFIRM bracket and a matching authority_url
- **WHEN** a `statutory_compliance_representation` field is rendered with a
  `{IF !<field>}` + `[CONFIRM before signing: …]` bracket whose URL matches the metadata
  `authority_url`
- **THEN** template validation passes
- **AND** validation fails when only `{IF !<field>}` is present without the bracket, or
  when the bracket URL drifts from the metadata `authority_url`
