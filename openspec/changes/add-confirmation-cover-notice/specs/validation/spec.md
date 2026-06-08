## ADDED Requirements

### Requirement: Reserved Confirmation Derived Tag
The template validator SHALL tolerate the confirmation derived control identifier
`any_confirmation_pending`. A `{IF any_confirmation_pending}` conditional in a generated
`template.docx` MUST NOT be reported as an unknown placeholder (no warning or error). This
derived tag MUST NOT satisfy the statutory-compliance-representation bracket requirement, which
still requires the literal `{IF !<field>}` + `[CONFIRM before signing: …]` bracket.

#### Scenario: [OA-TMP-073] The any_confirmation_pending tag does not trip placeholder validation
- **WHEN** a generated `template.docx` references `{IF any_confirmation_pending}` for its cover
  confirmation notice
- **THEN** template validation does not report that identifier as an unknown placeholder
- **AND** the statutory-compliance-representation field still requires its own `{IF !<field>}` +
  `[CONFIRM before signing: …]` bracket to validate
