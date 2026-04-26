## ADDED Requirements

### Requirement: Template Credits and Provenance

Each template `metadata.yaml` SHALL support two optional provenance fields
alongside (and orthogonal to) `attribution_text`:

- `credits`: an array of credit entries, each with `name` (string), `role`
  (one of `drafter`, `drafting_editor`, `reviewer`, `maintainer`), and an
  optional `profile_url` (URL). The schema SHALL default to an empty array
  when the field is omitted. Any role outside the closed enum SHALL fail
  validation.
- `derived_from`: an optional string naming the materials the template was
  derived from (e.g. `"Publicly available Series Seed SAFE board consent
  materials"`). The field is purely expository and has no effect on
  licensing.

The CLI `list --json` output SHALL project these fields onto internal and
external template entries: `credits` is always an array (empty or
populated); `derived_from` is omitted from the JSON object when undefined.
Recipe entries SHALL NOT carry `credits` or `derived_from`. The committed
`data/templates-snapshot.json` SHALL be regenerated from the CLI JSON
output so the snapshot carries the same contract.

The fields SHALL NOT be surfaced through the MCP package or the remote
A2A/MCP API in their current shape; MCP and API consumers remain
credits-unaware.

#### Scenario: [OA-TMP-029] Valid credits and derived_from parse

- **GIVEN** a template `metadata.yaml` with
  `credits: [{ name: "Joey Tsang", role: "drafting_editor", profile_url: "https://www.linkedin.com/in/joey-t-b90912b1/" }]`
  and `derived_from: "Publicly available Series Seed SAFE board consent materials"`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes with no errors
- **AND** the parsed metadata contains the full credits array and `derived_from` string

#### Scenario: [OA-TMP-030] Missing credits defaults to empty array

- **GIVEN** a template `metadata.yaml` that does not declare `credits`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes with no errors
- **AND** the parsed metadata exposes `credits` as an empty array

#### Scenario: [OA-TMP-031] Invalid credit role is rejected

- **GIVEN** a template `metadata.yaml` with a credit entry whose `role` is `"author"`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error indicating the role value is not in the allowed enum

#### Scenario: [OA-TMP-032] list --json projects credits and derived_from on templates

- **GIVEN** templates and recipes exist, and two templates declare non-empty `credits` and `derived_from`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the two templates' JSON entries include a populated `credits` array and a `derived_from` string
- **AND** every other internal and external template entry includes `credits: []` and omits `derived_from`
- **AND** no recipe entry includes `credits` or `derived_from`
