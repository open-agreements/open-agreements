## MODIFIED Requirements
### Requirement: Template Metadata Schema
Each template directory SHALL contain a `metadata.yaml` validated by Zod schema with fields: `name`, `source_url`, `version`, `license` (enum: CC-BY-4.0, CC0-1.0), `allow_derivatives` (boolean), `attribution_text`, `fields` (array of field definitions with name, type, description, required). Template metadata MAY also include an `authors` array of structured author records with `name` and optional `slug`, `role`, and `profile_url`.

#### Scenario: [OA-TMP-009] Valid metadata passes validation
- **GIVEN** a template directory with a `metadata.yaml` containing all required fields with valid values
- **WHEN** the system validates the metadata
- **THEN** validation passes with no errors

#### Scenario: [OA-TMP-024] Structured authors pass validation
- **GIVEN** a template directory with `metadata.yaml` containing an `authors` array with author names and optional author metadata
- **WHEN** the system validates the metadata
- **THEN** validation passes
- **AND** each author record preserves `name`, `slug`, `role`, and `profile_url` when provided

### Requirement: Machine-Readable Template Discovery
The `list` command SHALL support a `--json` flag that outputs template metadata including all field definitions, enabling programmatic field discovery by agent skills. Output SHALL be sorted by name. Templates SHALL include `source_url` and `attribution_text`. Templates with structured author metadata SHALL include an `authors` array in the JSON output.

#### Scenario: [OA-CLI-012] JSON output includes full metadata sorted by name
- **GIVEN** templates are available
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the output is a valid JSON envelope with `schema_version`, `cli_version`, and `items` array sorted by name, where each item includes `name`, `description`, `license`, `source_url`, `source`, `attribution_text`, and `fields`

#### Scenario: [OA-CLI-024] JSON output includes template authors when present
- **GIVEN** a template metadata file provides structured author metadata
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the corresponding item includes an `authors` array
- **AND** each author preserves `name`, `slug`, `role`, and `profile_url` when provided
