## MODIFIED Requirements

### Requirement: Template Metadata Schema

Each template directory SHALL contain a `metadata.yaml` validated by Zod schema
with fields: `name`, `source_url`, `version`, `license` (enum: CC-BY-4.0,
CC0-1.0), `allow_derivatives` (boolean), `attribution_text`, and `fields`
(array of field definitions with `name`, `type`, `description`, and optional
field metadata such as `display_label`, defaults, sections, enum options, and
nested `items` definitions for array fields).

#### Scenario: [OA-TMP-009] Valid metadata passes validation
- **GIVEN** a template directory with a `metadata.yaml` containing all required fields with valid values
- **WHEN** the system validates the metadata
- **THEN** validation passes with no errors

#### Scenario: [OA-TMP-010] Missing metadata field fails validation
- **GIVEN** a template directory with a `metadata.yaml` missing the `license` field
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: [OA-TMP-011] Invalid license enum fails validation
- **GIVEN** a template directory with `metadata.yaml` containing `license: MIT`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error indicating the license value is not in the allowed enum (CC-BY-4.0, CC0-1.0)

#### Scenario: [OA-TMP-028] Array field item schemas pass validation
- **GIVEN** a template metadata file with an array field that declares nested `items` field definitions
- **WHEN** the metadata is validated
- **THEN** validation accepts the array field schema
- **AND** nested item field definitions use the same field-definition rules as top-level fields

#### Scenario: [OA-TMP-033] Field metadata accepts curated display labels
- **GIVEN** a template metadata file with a field that declares `display_label`
- **WHEN** the metadata is validated
- **THEN** validation accepts the field definition
- **AND** the parsed field metadata preserves the `display_label` value

### Requirement: Machine-Readable Template Discovery

The `list` command SHALL support a `--json` flag that outputs template metadata
including all field definitions, enabling programmatic field discovery by agent
skills. Output SHALL be sorted by name. Templates SHALL include `source_url`,
`attribution_text`, and `has_template_md`. Field definitions SHALL include
optional `display_label` values when declared in metadata. Array fields with
nested item schemas SHALL include those nested item definitions in discovery
output. The committed `data/templates-snapshot.json` SHALL be regenerated from
the CLI JSON output so the snapshot carries the same contract. Repo-local
catalog builders MAY derive higher-level capability booleans directly from
template contents instead of consuming the raw `has_template_md` discovery
field.

#### Scenario: [OA-CLI-012] JSON output includes full metadata sorted by name
- **GIVEN** templates are available
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the output is a valid JSON envelope with `schema_version`, `cli_version`, and `items` array sorted by name, where each item includes `name`, `description`, `license`, `source_url`, `source`, `attribution_text`, and `fields`

#### Scenario: [OA-CLI-013] --json-strict exits non-zero on metadata errors
- **GIVEN** a template with invalid metadata exists
- **WHEN** the user runs `open-agreements list --json-strict`
- **THEN** the command prints errors to stderr and exits with non-zero status

#### Scenario: [OA-CLI-024] JSON output preserves array item schemas
- **GIVEN** a template with an array field that declares nested `items`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the matching template entry includes the array field
- **AND** the array field includes its nested item schema in the JSON output

#### Scenario: [OA-CLI-025] JSON discovery projects display labels and markdown availability
- **GIVEN** an internal template with a `template.md` file and fields that declare `display_label`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the matching template entry includes `has_template_md: true`
- **AND** each declared field includes its curated `display_label`
- **AND** templates without a `template.md` file include `has_template_md: false`
