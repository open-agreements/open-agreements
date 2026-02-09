## ADDED Requirements

### Requirement: DOCX Template Rendering
The system SHALL accept a template name, load the corresponding DOCX template, substitute `{tag}` placeholders with provided values, and produce a filled DOCX file preserving all original formatting.

#### Scenario: Successful template fill
- **GIVEN** a template named `common-paper-mutual-nda` exists with placeholders `{company_name}` and `{effective_date}`
- **WHEN** the user invokes `fill common-paper-mutual-nda` with values `company_name=Acme Corp` and `effective_date=2026-03-01`
- **THEN** the system produces a DOCX file with all `{company_name}` placeholders replaced by "Acme Corp" and all `{effective_date}` placeholders replaced by "2026-03-01", preserving the original formatting (bold, italic, headings, tables)

#### Scenario: Missing required field
- **GIVEN** a template with a required field `{governing_law}`
- **WHEN** the user invokes `fill` without providing `governing_law`
- **THEN** the system returns an error listing the missing required fields

### Requirement: Template Metadata Schema
Each template directory SHALL contain a `metadata.yaml` validated by Zod schema with fields: `name`, `source_url`, `version`, `license` (enum: CC-BY-4.0, CC0-1.0), `allow_derivatives` (boolean), `attribution_text`, `fields` (array of field definitions with name, type, description, required).

#### Scenario: Valid metadata passes validation
- **GIVEN** a template directory with a `metadata.yaml` containing all required fields with valid values
- **WHEN** the system validates the metadata
- **THEN** validation passes with no errors

#### Scenario: Missing metadata field fails validation
- **GIVEN** a template directory with a `metadata.yaml` missing the `license` field
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: Invalid license enum fails validation
- **GIVEN** a template directory with `metadata.yaml` containing `license: MIT`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error indicating the license value is not in the allowed enum (CC-BY-4.0, CC0-1.0)

### Requirement: License Compliance Validation
The system SHALL refuse to generate derivatives of templates where `allow_derivatives` is false and SHALL fail CI if a PR modifies content of a CC BY-ND licensed template.

#### Scenario: Derivative blocked for non-derivative license
- **GIVEN** a template with `allow_derivatives: false` in its metadata
- **WHEN** the user invokes `fill` on that template
- **THEN** the system refuses to render the template and returns an error explaining the license restriction

#### Scenario: CI blocks modification of CC BY-ND template
- **GIVEN** a CI workflow running on a PR that modifies a template DOCX file where `allow_derivatives` is false
- **WHEN** the CI validation step runs
- **THEN** the CI check fails with an error indicating that modifying non-derivative templates is prohibited

### Requirement: External Template Support
The system SHALL support external templates -- documents whose licenses (e.g. CC BY-ND 4.0) prohibit redistribution of modified versions. External templates are vendored unchanged under `external/` with a `metadata.yaml` containing `source_sha256` for integrity verification. The `fill` command fills them the same way as internal templates. The filled output is a transient derivative that exists only on the user's machine.

#### Scenario: External template fill
- **GIVEN** an external template `yc-safe-valuation-cap` with `license: CC-BY-ND-4.0` and `allow_derivatives: false`
- **WHEN** the user invokes `fill yc-safe-valuation-cap` with valid field values
- **THEN** the system fills the template and produces a DOCX, printing a license notice that the output must not be redistributed in modified form

#### Scenario: External metadata requires source_sha256
- **GIVEN** an external template directory with `metadata.yaml` missing `source_sha256`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: External template appears in list output
- **GIVEN** external templates exist under `external/`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** external templates appear in the output with `license: CC-BY-ND-4.0` and `source` indicating the originating organization

### Requirement: CLI Interface
The system SHALL expose commands: `fill <template>` (render filled DOCX), `validate [template|recipe]` (run validation pipeline), `list` (show available templates and recipes).

#### Scenario: Fill command renders output
- **GIVEN** the CLI is installed and a valid template exists
- **WHEN** the user runs `open-agreements fill common-paper-mutual-nda --set company_name="Acme Corp" --set effective_date="2026-03-01"`
- **THEN** the system renders a filled DOCX and writes it to the output path

#### Scenario: List command shows templates
- **GIVEN** the CLI is installed with internal and external templates
- **WHEN** the user runs `open-agreements list`
- **THEN** the system displays each template with name, license info, field count, source, and source URL

### Requirement: Claude Code Skill
The system SHALL generate a Claude Code slash command that discovers template fields from metadata, interviews the user via AskUserQuestion, and renders the filled DOCX.

#### Scenario: Skill interviews user for field values
- **GIVEN** the Claude Code skill is invoked with `/open-agreements nda`
- **WHEN** the skill reads the template metadata and finds 8 required fields
- **THEN** the skill asks the user for field values via AskUserQuestion in multiple rounds of up to 4 questions each, grouped by template section

#### Scenario: Skill renders DOCX after interview
- **GIVEN** the user has answered all required field questions
- **WHEN** the skill has collected all values
- **THEN** the skill invokes the template engine and saves the filled DOCX to the user's working directory

### Requirement: Output Validation
The system SHALL verify that rendered DOCX output preserves the section count and heading structure of the source template.

#### Scenario: Output structure matches source
- **GIVEN** a source template with 5 sections and 12 headings
- **WHEN** the system renders a filled DOCX
- **THEN** the output DOCX contains exactly 5 sections and 12 headings matching the source structure

#### Scenario: Structural drift detected
- **GIVEN** a rendered DOCX where a heading was accidentally removed during substitution
- **WHEN** the system validates the output
- **THEN** validation fails with an error indicating the structural mismatch (expected vs actual heading count)

### Requirement: Agent-Agnostic Skill Architecture
The system SHALL define a `ToolCommandAdapter` interface enabling future adapters for other coding agents beyond Claude Code.

#### Scenario: Claude Code adapter implements interface
- **GIVEN** a `ToolCommandAdapter` interface with methods for field discovery, user interaction, and template rendering
- **WHEN** the Claude Code adapter is instantiated
- **THEN** it implements all interface methods and generates a valid Claude Code slash command file

#### Scenario: New adapter can be added without modifying core
- **GIVEN** the `ToolCommandAdapter` interface is defined in `src/core/command-generation/types.ts`
- **WHEN** a developer creates a new adapter (e.g., for Cursor or Windsurf)
- **THEN** they can implement the interface without modifying any existing core or adapter code

### Requirement: Agent Skills Specification Compliance
The system SHALL include a skill directory compliant with the Agent Skills spec
(agentskills.io) with YAML frontmatter containing `name` and `description` fields,
where the directory name matches the `name` field.

#### Scenario: Skill renders DOCX via npx (zero pre-install)
- **GIVEN** Node.js >=20 is available but open-agreements is NOT globally installed
- **WHEN** an agent activates the skill and the user requests to fill a template
- **THEN** the skill runs `npx -y open-agreements@latest fill <template>` to render DOCX

#### Scenario: Skill renders DOCX via installed CLI
- **GIVEN** the open-agreements CLI IS globally installed
- **WHEN** an agent activates the skill and the user requests to fill a template
- **THEN** the skill renders a DOCX file via the CLI directly

#### Scenario: Preview-only fallback without Node.js
- **GIVEN** Node.js is NOT available
- **WHEN** an agent activates the skill
- **THEN** the skill produces a preview-only markdown document labeled as such

### Requirement: Machine-Readable Template Discovery
The `list` command SHALL support a `--json` flag that outputs template metadata
including all field definitions, enabling programmatic field discovery by agent skills.
Output SHALL be sorted by name. Templates SHALL include `source_url` and `attribution_text`.

#### Scenario: JSON output includes full metadata sorted by name
- **GIVEN** templates are available
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the output is a valid JSON envelope with `schema_version`, `cli_version`, and `items` array sorted by name, where each item includes `name`, `description`, `license`, `source_url`, `source`, `attribution_text`, and `fields`

#### Scenario: --json-strict exits non-zero on metadata errors
- **GIVEN** a template with invalid metadata exists
- **WHEN** the user runs `open-agreements list --json-strict`
- **THEN** the command prints errors to stderr and exits with non-zero status

#### Scenario: --templates-only filters to templates
- **GIVEN** internal and external templates are available
- **WHEN** the user runs `open-agreements list --json --templates-only`
- **THEN** the output contains only template entries (no recipes)

### Requirement: npm Package Integrity
The npm tarball SHALL include `dist/`, `bin/`, `templates/`, `recipes/`, and `skills/`
directories. The `prepack` script SHALL run the build before packing. The tarball
SHALL NOT include `src/` or `node_modules/`.

#### Scenario: Clean install from registry works
- **GIVEN** the package is published to npm
- **WHEN** a user runs `npm install open-agreements` in a fresh directory
- **THEN** `npx open-agreements list --json` produces valid JSON output
