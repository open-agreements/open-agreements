## ADDED Requirements

### Requirement: SAFE Stockholder Consent Contract IR Backport
The system SHALL include the SAFE stockholder consent template as a canonical
Contract IR-authored template under
`content/templates/openagreements-stockholder-consent-safe/`, with generated
DOCX and Markdown artifacts derived from the same source content.

#### Scenario: [OA-TMP-026] SAFE stockholder consent preserves source fidelity
- **WHEN** the Contract IR SAFE stockholder consent is rendered
- **THEN** the output preserves the Joey Tsang stockholder consent legal text,
  Section 228 effectiveness framing, variable placeholders, and signature
  structure with materially similar professional formatting

#### Scenario: [OA-TMP-027] Filled stockholder consent removes the drafting note
- **WHEN** the SAFE stockholder consent is filled through the normal template
  pipeline
- **THEN** the introductory drafting note is removed from user-facing output
- **AND** the remaining stockholder consent text remains intact
