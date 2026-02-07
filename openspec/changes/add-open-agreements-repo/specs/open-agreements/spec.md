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

### Requirement: Recipe Engine
The system SHALL support a recipe tier for documents whose licenses prohibit redistribution. A recipe SHALL contain a replacement map, context schema, cleaning rules, and source URL — but never the source DOCX itself. The recipe engine SHALL download the source DOCX from the URL specified in recipe metadata, clean it (remove footnotes and drafting notes), patch bracketed placeholders into template tags using cross-run replacement, fill with user-provided values, and verify the output.

#### Scenario: Successful recipe execution with auto-download
- **GIVEN** a recipe named `nvca-voting-agreement` with `source_url: https://nvca.org/wp-content/uploads/2019/06/NVCA-Model-Document-Voting-Agreement.docx` in its metadata
- **WHEN** the user invokes `recipe nvca-voting-agreement` with values `company_name=Acme Corp` and `effective_date=January 15, 2025`
- **THEN** the system downloads the source DOCX from the URL, removes all explanatory footnotes and drafting notes, replaces `[Insert Company Name]` with `{company_name}` (handling cross-run splits), fills the template, and produces a DOCX with "Acme Corp" in all company name positions

#### Scenario: Recipe execution with user-supplied input
- **GIVEN** a recipe named `nvca-voting-agreement` and a user who has already downloaded the source DOCX
- **WHEN** the user invokes `recipe nvca-voting-agreement --input ~/Downloads/NVCA-Voting-Agreement.docx`
- **THEN** the system uses the user-supplied file instead of downloading, and proceeds with clean → patch → fill → verify

#### Scenario: Cross-run placeholder replacement
- **GIVEN** a source DOCX where `[Company Name]` is split across two XML runs (run 1: `"by [Company"`, run 2: `" Name] on"`)
- **WHEN** the recipe engine patches the document
- **THEN** the placeholder is correctly replaced with `{company_name}` preserving the formatting of the first run, and the output contains no leftover `[Company Name]` fragments

#### Scenario: Smart quote handling
- **GIVEN** a source DOCX containing `[\u201cName of Investor Designee\u201d]` (Unicode curly quotes)
- **WHEN** the recipe engine patches the document
- **THEN** the placeholder is matched and replaced, regardless of whether the quotes are smart (curly) or straight

#### Scenario: Footnote and drafting note removal
- **GIVEN** a source DOCX with 53 explanatory footnotes and a "Note to Drafter" paragraph
- **WHEN** the recipe engine cleans the document
- **THEN** all footnote content and reference marks are removed from the document body, and the "Note to Drafter" paragraph is deleted

#### Scenario: Post-fill verification
- **GIVEN** a recipe has completed the fill phase
- **WHEN** the system verifies the output
- **THEN** all context values are present in the document text, no unrendered `{template_tags}` remain, and no `[bracketed placeholders]` from the replacement map remain

#### Scenario: Recipe directory contains no copyrighted content
- **GIVEN** a recipe directory under `recipes/`
- **WHEN** CI validation runs
- **THEN** the check fails if any `.docx` file is found in the recipe directory

#### Scenario: Recipe with XML special characters in context
- **GIVEN** a context value containing `&` (e.g., company_counsel = "Goodrich & Rosati")
- **WHEN** the recipe engine fills the template
- **THEN** the `&` is correctly preserved in the output DOCX without corrupting the underlying XML

### Requirement: Recipe Metadata Schema
Each recipe directory SHALL contain a `metadata.yaml` with fields: `name`, `source_url` (URL where user can obtain or system can download the source DOCX), `source_version`, `license_note` (human-readable explanation), `download_instructions`, `fields` (array of field definitions).

#### Scenario: Valid recipe metadata
- **GIVEN** a recipe with metadata containing `source_url`, `source_version`, `license_note`, and `fields`
- **WHEN** the system validates the metadata
- **THEN** validation passes

#### Scenario: Missing source_url fails validation
- **GIVEN** a recipe with metadata missing the `source_url` field
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

### Requirement: CLI Interface
The system SHALL expose commands: `fill <template>` (render filled DOCX), `recipe <name>` (run recipe pipeline), `scan <docx>` (discover placeholders), `validate [template|recipe]` (run validation pipeline), `list` (show available templates and recipes).

#### Scenario: Fill command renders output
- **GIVEN** the CLI is installed and a valid template exists
- **WHEN** the user runs `open-agreements fill common-paper-mutual-nda --company-name "Acme Corp" --effective-date "2026-03-01"`
- **THEN** the system renders a filled DOCX and writes it to the output path

#### Scenario: Recipe command runs pipeline
- **GIVEN** the CLI is installed and a recipe `nvca-voting-agreement` exists
- **WHEN** the user runs `open-agreements recipe nvca-voting-agreement --company-name "Acme Corp"`
- **THEN** the system downloads the source DOCX from the recipe's `source_url`, runs clean → patch → fill → verify, and writes the filled DOCX to the output path

#### Scenario: Recipe command with user-supplied input
- **GIVEN** the CLI is installed and a recipe exists
- **WHEN** the user runs `open-agreements recipe nvca-voting-agreement --input ./NVCA-Voting.docx --company-name "Acme Corp"`
- **THEN** the system uses the supplied file instead of downloading

#### Scenario: Scan command discovers placeholders
- **GIVEN** the CLI is installed and the user has a DOCX file
- **WHEN** the user runs `open-agreements scan ./document.docx`
- **THEN** the system reports all bracketed placeholders found, classified as short (likely fill-in-the-blank) vs. long (likely alternative clauses), with any existing recipe mappings shown

#### Scenario: Validate command checks all templates and recipes
- **GIVEN** the CLI is installed with templates and recipes
- **WHEN** the user runs `open-agreements validate`
- **THEN** the system validates all templates (metadata, field matching, license compliance) and all recipes (metadata, replacement map, no .docx files) and reports results

#### Scenario: List command shows templates and recipes
- **GIVEN** the CLI is installed with 3 templates and 1 recipe
- **WHEN** the user runs `open-agreements list`
- **THEN** the system displays each template and recipe with name, description, type (template/recipe), license info, and field count

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
