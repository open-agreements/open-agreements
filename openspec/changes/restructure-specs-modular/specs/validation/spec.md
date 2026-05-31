## ADDED Requirements
### Requirement: Template Validation Severity
The template validator MUST produce errors (not warnings) when a required
metadata field has no corresponding `{tag}` placeholder in the template DOCX.
Optional fields missing from the DOCX MUST produce warnings. The `valid` field
MUST be `false` when any required field is missing.

#### Scenario: [OA-TMP-001] Required field missing from DOCX
- **WHEN** metadata lists `party_1_name` in `priority_fields`
- **AND** no `{party_1_name}` placeholder exists in template.docx
- **THEN** validation produces an error (not a warning)
- **AND** `valid` is `false`

#### Scenario: [OA-TMP-002] Optional field missing from DOCX
- **WHEN** metadata defines field `governing_law` but does not include it in `priority_fields`
- **AND** no `{governing_law}` placeholder exists in template.docx
- **THEN** validation produces a warning
- **AND** `valid` remains `true`

### Requirement: Metadata Schema Constraints

The metadata schema MUST enforce type-specific constraints on field
definitions. Fields with `type: enum` or `type: multiselect` MUST have a
non-empty `options` array. Fields with a `default` value MUST have that
default validate against the declared `type`.

For `type: multiselect`, every option SHALL be unique and SHALL match the
identifier pattern `^[A-Za-z_][A-Za-z0-9_]*$`. `derive_booleans` SHALL be
allowed only when `type === "multiselect"`. When a multiselect field
declares a `default`, the value SHALL be a JSON-encoded array of unique
strings, and every entry SHALL appear in `options`.

When a multiselect field sets `derive_booleans: true`, metadata validation
SHALL reject any collision between a derived `<option>_enabled` key and
another top-level field name, and SHALL also reject collisions between
derived keys emitted by multiple multiselect fields. These collision rules
apply to template, external-template, and recipe metadata.


**See**: `FieldDefinitionSchema`, `TemplateMetadataSchema`, `ExternalMetadataSchema`, and `RecipeMetadataSchema` in `src/core/metadata.ts`.
#### Scenario: [OA-TMP-049] Valid multiselect metadata parses

- **GIVEN** metadata with a field
  `{ name: industry_modules, type: multiselect, options: [tech_rider, cross_border_rider], default: "[\"tech_rider\"]" }`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes
- **AND** the parsed field preserves the declared options and default

#### Scenario: [OA-TMP-050] Invalid multiselect metadata is rejected

- **GIVEN** metadata with a multiselect field that omits `options`,
  declares an invalid option identifier, or sets a default outside the
  allowlist
- **WHEN** the system validates the metadata
- **THEN** validation fails with a descriptive schema error

#### Scenario: [OA-TMP-051] Derived boolean collisions are rejected

- **GIVEN** metadata with `derive_booleans: true` on a multiselect field
- **AND** a derived key such as `tech_rider_enabled` would collide with
  another top-level field or another multiselect's derived key
- **WHEN** the system validates the metadata
- **THEN** validation fails before the template can be filled

#### Scenario: [OA-TMP-003] Enum field without options
- **WHEN** metadata defines a field with `type: enum` and no `options` array
- **THEN** schema validation fails with a descriptive error

#### Scenario: [OA-TMP-004] Default value type mismatch
- **WHEN** metadata defines a field with `type: number` and `default: "abc"`
- **THEN** schema validation fails with a descriptive error

### Requirement: Recipe Directory Validation
Recipe validation MUST enforce: no `.docx` files in the recipe directory
(copyrighted content must not be committed), `replacements.json` exists and
contains string-to-string entries, replacement target fields are declared in
`metadata.yaml` (`fields` + `priority_fields`), `metadata.yaml` validates against the schema, and
`clean.json` validates against the clean config schema. Scaffold recipes
(metadata.yaml only) MUST pass validation without requiring other files.

#### Scenario: [OA-RCP-016] DOCX file detected in recipe directory
- **WHEN** a `.docx` file exists in `recipes/nvca-voting-agreement/`
- **THEN** validation fails with an error about copyrighted content

#### Scenario: [OA-RCP-017] Scaffold recipe validation
- **WHEN** a recipe directory contains only `metadata.yaml`
- **AND** metadata is valid
- **THEN** validation passes (scaffold recipes are allowed)

#### Scenario: [OA-RCP-018] Replacement target not covered by metadata
- **WHEN** `replacements.json` maps `[Tag]` to `{field_x}`
- **AND** `metadata.yaml` does not define `field_x` in `fields`
- **THEN** validation warns about the uncovered replacement target

### Requirement: Template Validation for All Templates
Template validation MUST succeed for all bundled templates (bonterms-mutual-nda,
common-paper-mutual-nda, employment offer, IP assignment, confidentiality) with
no errors. Metadata validation MUST pass independently.

#### Scenario: [OA-TMP-015] All bundled templates pass validation
- **WHEN** `validateTemplate` runs on each bundled template
- **THEN** validation produces zero errors for each template
- **AND** `validateMetadata` passes for each template's metadata independently

#### Scenario: [OA-TMP-016] Declarative replacement coverage validation
- **WHEN** replacements reference metadata tags not declared in the template
- **THEN** validation reports required-field errors for uncovered tags

### Requirement: Recipe Validation for Bundled Recipes
Recipe validation MUST succeed for all bundled full and scaffold recipes.
Metadata validation MUST pass independently.

#### Scenario: [OA-RCP-026] Bundled recipes pass validation
- **WHEN** `validateRecipe` runs on bundled full recipes and scaffold recipes
- **THEN** validation passes for each
- **AND** `validateRecipeMetadata` passes for each recipe's metadata independently

### Requirement: Recipe Negative Validation
Recipe validation MUST reject unsafe non-identifier replacement tags and
invalid normalize.json configurations.

#### Scenario: [OA-RCP-027] Unsafe replacement tags and invalid normalize configs rejected
- **WHEN** a recipe contains non-identifier replacement tags or invalid normalize.json
- **THEN** validation fails with descriptive errors

### Requirement: Metadata Completeness Assessment
The scan-vs-metadata check MUST flag short placeholders discovered by scan that
are not mapped in metadata-backed replacements.

#### Scenario: [OA-TMP-019] Scan metadata completeness assessment
- **WHEN** a scan discovers short placeholders not mapped in recipe metadata
- **THEN** those unmapped placeholders are flagged
- **AND** sampled NVCA placeholders map to metadata-backed replacements

### Requirement: Metadata Field Schema Validation
Field definitions MUST enforce type-specific constraints: enum fields require
non-empty options, default values must match declared type.


**See**: `FieldDefinitionSchema` in `src/core/metadata.ts`.
#### Scenario: [OA-TMP-020] Field definition edge cases
- **WHEN** field definitions include enum with options, enum with empty options, boolean with invalid default, or number with numeric default
- **THEN** valid configurations pass and invalid ones are rejected with descriptive errors

### Requirement: Template Metadata Required Fields
Template metadata MUST reject `priority_fields` entries that reference undeclared
field names and reject duplicate entries in `priority_fields`.


**See**: `TemplateMetadataSchema` and `ExternalMetadataSchema` in `src/core/metadata.ts`.
#### Scenario: [OA-TMP-021] Required fields referential integrity
- **WHEN** `priority_fields` references an undeclared field name or contains duplicates
- **THEN** schema validation fails with descriptive errors

### Requirement: Recipe Metadata Defaults
Recipe metadata MUST default `optional` to `false` when not explicitly set.


**See**: `RecipeMetadataSchema` in `src/core/metadata.ts`.
#### Scenario: [OA-RCP-042] Recipe metadata optional field default
- **WHEN** recipe metadata omits the `optional` field
- **THEN** it defaults to `false`

### Requirement: Clean Configuration Schema
The clean configuration schema MUST accept valid configs and apply sensible
defaults for missing fields.


**See**: `CleanConfigSchema` in `src/core/metadata.ts`.
#### Scenario: [OA-ENG-010] Clean config validation and defaults
- **WHEN** a clean configuration is validated
- **THEN** valid configs pass and missing optional fields receive defaults

### Requirement: Guidance Output Schema
The guidance output schema MUST validate extracted guidance structure including
`extractedFrom` metadata and source type.


**See**: `GuidanceOutputSchema` in `src/core/metadata.ts`.
#### Scenario: [OA-RCP-043] Guidance output validation
- **WHEN** guidance output is validated
- **THEN** valid output with proper extractedFrom metadata passes
- **AND** missing extractedFrom or invalid source types are rejected

### Requirement: Checklist Schema Structural Rules
The checklist schema MUST enforce parent-stage consistency, related document
reference validity, status enum values, signature artifact requirements, and
default arrays for related documents.

#### Scenario: [OA-CKL-030] Checklist structural validation rules
- **WHEN** checklist entries reference parent entries in different stages, unknown document IDs in action items or issues, or invalid status values
- **THEN** validation rejects with structured errors
- **AND** valid stage, entry status, action item status, and signatory status values are accepted
- **AND** signature artifacts require uri or path
- **AND** related_document_ids defaults to empty array on action items and issues

#### Scenario: [OA-CKL-031] Checklist citation evidence validation
- **WHEN** checklist entries include citation text-only evidence payloads
- **THEN** validation accepts them

### Requirement: Patch Schema Validation Rules
Patch schemas MUST reject empty operation arrays, invalid JSON pointer paths,
and enforce operation/value compatibility.

#### Scenario: [OA-CKL-032] Patch schema structural validation
- **WHEN** a patch envelope has empty operations, invalid JSON pointer paths, or incompatible operation/value pairs
- **THEN** validation rejects with structured errors
- **AND** valid patch envelopes with default APPLY mode are accepted

### Requirement: Patch Validator Artifact Expiry
Validation artifacts MUST expire after a configured TTL.

#### Scenario: [OA-CKL-033] Validation artifact TTL expiry
- **WHEN** a validation artifact exceeds its TTL
- **THEN** it is no longer valid for apply requests

### Requirement: Recipe Verifier Edge Cases
The verifier MUST normalize text (non-breaking spaces, smart quotes, whitespace)
and skip empty/whitespace-only values during output verification.

#### Scenario: [OA-RCP-040] Verifier text normalization
- **WHEN** output text contains non-breaking spaces, smart quotes, or excess whitespace
- **THEN** normalization converts them for matching purposes
- **AND** newlines are preserved and text is trimmed

#### Scenario: [OA-RCP-041] Verifier skips empty and whitespace-only values
- **WHEN** fill values include empty strings or whitespace-only strings
- **THEN** those values are skipped during verification (not flagged as missing)
- **AND** values present only in header text are found via auxiliary part scanning

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

#### Scenario: [OA-TMP-036] Valid credits and derived_from parse

- **GIVEN** a template `metadata.yaml` with
  `credits: [{ name: "Joey Tsang", role: "drafting_editor", profile_url: "https://www.linkedin.com/in/joey-t-b90912b1/" }]`
  and `derived_from: "Publicly available Series Seed SAFE board consent materials"`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes with no errors
- **AND** the parsed metadata contains the full credits array and `derived_from` string

#### Scenario: [OA-TMP-037] Missing credits defaults to empty array

- **GIVEN** a template `metadata.yaml` that does not declare `credits`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes with no errors
- **AND** the parsed metadata exposes `credits` as an empty array

#### Scenario: [OA-TMP-038] Invalid credit role is rejected

- **GIVEN** a template `metadata.yaml` with a credit entry whose `role` is `"author"`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error indicating the role value is not in the allowed enum

#### Scenario: [OA-TMP-039] list --json projects credits and derived_from on templates

- **GIVEN** templates and recipes exist, and two templates declare non-empty `credits` and `derived_from`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the two templates' JSON entries include a populated `credits` array and a `derived_from` string
- **AND** every other internal and external template entry includes `credits: []` and omits `derived_from`
- **AND** no recipe entry includes `credits` or `derived_from`
