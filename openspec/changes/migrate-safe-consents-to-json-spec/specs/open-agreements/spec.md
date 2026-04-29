## MODIFIED Requirements

### Requirement: JSON Template Renderer
The JSON template renderer MUST support multiple templates sharing layout IDs,
reject unknown layouts, detect style mismatches, validate spacing tokens,
and render loop-backed stacked signer sections for templates that need
variable-length signature blocks.

#### Scenario: [OA-TMP-017] JSON template renderer validation
- **WHEN** templates reference layout IDs
- **THEN** multiple templates sharing the same layout ID are supported
- **AND** unknown layout IDs are rejected with actionable errors
- **AND** style mismatches between spec and profile are rejected
- **AND** invalid spacing token types are caught before rendering

#### Scenario: JSON renderer emits loop-backed stacked signer sections
- **GIVEN** a JSON template spec with `signature.mode = "signers"` and
  `signature.arrangement = "stacked"`
- **AND** the signature section targets an array-backed signer collection
- **WHEN** the renderer generates the template DOCX and Markdown preview
- **THEN** the DOCX preserves the required `{FOR}` / `{$item...}` /
  `{END-FOR}` loop markers for fill-time expansion
- **AND** the Markdown preview remains readable without inventing fixed
  signer slots

### Requirement: SAFE Board Consent Contract IR Backport
The system SHALL include the SAFE board consent template as a canonical
hand-authored JSON template spec under
`content/templates/openagreements-board-consent-safe/`.

#### Scenario: [OA-TMP-032] SAFE board consent preserves source fidelity
- **WHEN** the SAFE board consent JSON spec is rendered
- **THEN** the output preserves the Joey Tsang board consent legal text,
  resolution flow, variable placeholders, and signature structure with
  materially similar professional formatting

## ADDED Requirements

### Requirement: SAFE Stockholder Consent JSON Spec
The system SHALL include the SAFE stockholder consent template as a canonical
hand-authored JSON template spec under
`content/templates/openagreements-stockholder-consent-safe/`.

#### Scenario: [OA-TMP-026] SAFE stockholder consent preserves source fidelity
- **WHEN** the SAFE stockholder consent JSON spec is rendered
- **THEN** the output preserves the Joey Tsang stockholder consent legal text,
  resolution flow, variable placeholders, and loop-based signature structure
  with materially similar professional formatting
