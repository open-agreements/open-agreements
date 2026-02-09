## ADDED Requirements

### Requirement: External Template Support
The system SHALL support an "external" template category for documents that are redistributable but licensed under terms that prohibit derivative distribution (e.g., CC-BY-ND 4.0). External templates MUST ship the original unmodified DOCX file in the `external/` directory and apply bracket-to-tag replacement at runtime via the existing recipe engine stages (clean, patch, fill, verify). The committed DOCX file MUST NOT be modified from the original source.

#### Scenario: Fill an external template end-to-end
- **GIVEN** an external template `yc-safe-valuation-cap` exists in `external/yc-safe-valuation-cap/` with an unmodified `template.docx`, `metadata.yaml`, `replacements.json`, and field values are provided
- **WHEN** the user runs `open-agreements fill yc-safe-valuation-cap -d values.json -o output.docx`
- **THEN** the system reads the external DOCX, applies cleaning, patches brackets to tags at runtime in a temp directory, fills with provided values, runs verification, and writes the output DOCX
- **AND** the original `template.docx` in `external/` is not modified

#### Scenario: Template not found in any directory
- **WHEN** the user runs `open-agreements fill nonexistent-template`
- **THEN** the system reports an error that the agreement was not found in templates or external agreements

#### Scenario: Template ID searched in order
- **GIVEN** a template ID `example` exists in both `templates/example/` and `external/example/`
- **WHEN** the user runs `open-agreements fill example`
- **THEN** the system uses the template from `templates/` (first match wins)

### Requirement: Unified List Output
The `list` command SHALL display all agreements (templates and external) in a single unified table. The output MUST include a "Source" column showing the originating organization (e.g., "Common Paper", "Bonterms", "Y Combinator"). The `--json` output MUST include external templates alongside regular templates with full field definitions for agent discovery.

#### Scenario: Unified list includes both template types
- **WHEN** the user runs `open-agreements list`
- **THEN** the output shows a single table containing both regular templates (e.g., `bonterms-mutual-nda`) and external templates (e.g., `yc-safe-valuation-cap`) with their respective sources, licenses, and field counts

#### Scenario: JSON output includes external template fields
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the JSON output includes external templates with `name`, `license`, `source_url`, `fields[]`, and all other metadata properties needed for agent discovery

### Requirement: External Template Metadata Schema
The system SHALL validate external template metadata using `ExternalMetadataSchema` which MUST include all fields from `TemplateMetadataSchema` plus `source_sha256`. The `license` field MUST accept `CC-BY-ND-4.0`. Each field in `fields[]` MUST conform to the existing `FieldDefinitionSchema`.

#### Scenario: Valid external metadata
- **GIVEN** an external template directory with a `metadata.yaml` containing all required fields, `license: CC-BY-ND-4.0`, `allow_derivatives: false`, and a valid `source_sha256`
- **WHEN** the metadata is validated
- **THEN** validation passes

#### Scenario: Missing source hash
- **GIVEN** an external template directory with `metadata.yaml` that omits `source_sha256`
- **WHEN** the metadata is validated
- **THEN** validation fails with an error indicating the SHA-256 hash is required

### Requirement: DOCX Integrity Verification
The system SHALL verify the SHA-256 hash of the committed external DOCX file against the `source_sha256` value in `metadata.yaml` before filling and during validation. This ensures the file has not been accidentally modified, maintaining CC-BY-ND compliance. On hash mismatch, the system MUST print both the expected and actual hash values.

#### Scenario: Hash matches — fill proceeds
- **GIVEN** an external template with `source_sha256` in metadata matching the committed `template.docx`
- **WHEN** the fill command is run
- **THEN** the integrity check passes and the fill pipeline proceeds

#### Scenario: Hash mismatch — fill blocked with diagnostic
- **GIVEN** an external template where `template.docx` has been modified (hash differs from `source_sha256`)
- **WHEN** the fill command is run
- **THEN** the system prints the expected hash, the actual hash, and aborts the fill

### Requirement: Redefined allow_derivatives Semantics
The `allow_derivatives` field in metadata SHALL mean "the committed source DOCX must not be modified" when `false`. It SHALL NOT prevent the tool from rendering filled output. The fill command SHALL use directory context (templates/ vs external/) to determine the fill strategy rather than blocking on `allow_derivatives: false`.

#### Scenario: External template with allow_derivatives false is fillable
- **GIVEN** an external template with `allow_derivatives: false` in metadata
- **WHEN** the user runs `open-agreements fill <id> -d values.json -o output.docx`
- **THEN** the fill command proceeds using the external fill pipeline (runtime patching)
- **AND** the system does NOT block rendering

#### Scenario: allow_derivatives true still uses direct fill
- **GIVEN** a regular template in `templates/` with `allow_derivatives: true`
- **WHEN** the user runs `open-agreements fill <id> -d values.json -o output.docx`
- **THEN** the fill command uses the existing direct template fill (no runtime patching)

### Requirement: External Template Validation
The `validate` command SHALL validate external template directories alongside regular templates and recipes. Validation MUST check: metadata schema compliance, DOCX SHA-256 integrity, `replacements.json` format, `clean.json` format (if present), and field coverage between `metadata.yaml` and `replacements.json` replacement targets.

#### Scenario: Full external template passes validation
- **GIVEN** an external template directory with valid `metadata.yaml`, matching DOCX hash, valid `replacements.json`, and all replacement targets covered by field definitions
- **WHEN** `open-agreements validate` is run
- **THEN** the external template passes validation

#### Scenario: Uncovered replacement target warns
- **GIVEN** an external template where `replacements.json` maps a bracket to `{field_name}` but `field_name` is not defined in `metadata.yaml` fields
- **WHEN** `open-agreements validate` is run
- **THEN** validation reports a warning about the uncovered replacement target

#### Scenario: Container directory not treated as template
- **WHEN** `open-agreements list` or `open-agreements validate` is run
- **THEN** the `external/` directory itself is NOT listed or validated as a template ID

### Requirement: CLI Redistribution Warning
The system SHALL print a redistribution notice when filling external templates. The notice MUST inform the user that the document is licensed under CC-BY-ND 4.0, that they may fill it for their own use, and that they should not redistribute modified versions. The notice MUST include the source URL for the license terms.

#### Scenario: Warning printed on external fill
- **WHEN** the user runs `open-agreements fill yc-safe-valuation-cap -d values.json -o output.docx`
- **THEN** the CLI prints a notice including "CC-BY-ND 4.0", "do not redistribute modified versions", and the YC source URL
- **AND** the fill proceeds without requiring user confirmation

### Requirement: YC Post-Money SAFE Templates
The system SHALL include four external YC Post-Money SAFE templates: Valuation Cap (no discount), Discount (no valuation cap), MFN (no valuation cap, no discount), and Pro Rata Side Letter. Each template MUST use the unmodified DOCX from Y Combinator's official source, include correct CC-BY-ND 4.0 attribution, and define all fillable fields with appropriate types and sections.

#### Scenario: All four YC SAFE variants are listed
- **WHEN** the user runs `open-agreements list`
- **THEN** the output includes `yc-safe-valuation-cap`, `yc-safe-discount`, `yc-safe-mfn`, and `yc-safe-pro-rata-side-letter`
- **AND** each shows `CC-BY-ND-4.0` as the license and "Y Combinator" as the source

#### Scenario: Fill YC SAFE Valuation Cap with all required fields
- **GIVEN** the external template `yc-safe-valuation-cap` and a data file with all required fields (company name, investor name, purchase amount, valuation cap, etc.)
- **WHEN** the user runs `open-agreements fill yc-safe-valuation-cap -d values.json -o safe.docx`
- **THEN** the output DOCX contains the provided values in place of the original bracket placeholders
- **AND** no unrendered `{tags}` or `[brackets]` remain in the output

### Requirement: External Template Attribution and Licensing
The `external/` directory SHALL contain a `LICENSE` file and `README.md` that clearly state: the included documents are copyright their respective owners (Y Combinator), are included under CC-BY-ND 4.0 for convenience and programmatic access, and that OpenAgreements makes no claim of ownership. Each individual external template directory SHALL also include attribution in its `README.md` with the official source URL, version, and license information.

#### Scenario: External LICENSE file exists with correct attribution
- **GIVEN** the `external/` directory
- **WHEN** a user or CI inspects the directory
- **THEN** a `LICENSE` file exists stating the CC-BY-ND 4.0 terms and Y Combinator copyright attribution

#### Scenario: Individual template README includes source link
- **GIVEN** an external template directory like `external/yc-safe-valuation-cap/`
- **WHEN** a user inspects the directory
- **THEN** a `README.md` exists with the official YC source URL, version, and license information
