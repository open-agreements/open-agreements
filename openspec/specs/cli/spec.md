# cli Specification

## Purpose
Defines the cli capability after restructuring the legacy open-agreements monolith.

## Requirements
### Requirement: Recipe CLI Subcommands
The CLI MUST provide subcommands for running the full recipe pipeline and
for running individual stages independently. Individual stages support
recipe authoring and debugging.

#### Scenario: [OA-RCP-004] Run full pipeline
- **WHEN** `open-agreements recipe run <recipe-id> --data <json> -o <output>`
- **THEN** the full download-clean-patch-fill-verify pipeline executes

#### Scenario: [OA-RCP-005] Run clean stage only
- **WHEN** `open-agreements recipe clean <input> -o <output> --recipe <id>`
- **THEN** only the clean stage runs, using the recipe's `clean.json` config

#### Scenario: [OA-RCP-006] Run patch stage only
- **WHEN** `open-agreements recipe patch <input> -o <output> --recipe <id>`
- **THEN** only the patch stage runs, using the recipe's `replacements.json`

### Requirement: Scan Command
The `scan` command MUST analyze a user-supplied DOCX and report all bracketed
placeholders, classifying them as short (fill-in fields, <=80 chars) or long
(alternative clauses). It MUST detect split-run placeholders and count footnotes.
It MUST optionally output a draft `replacements.json` to bootstrap recipe authoring.

#### Scenario: [OA-CLI-001] Placeholder discovery
- **WHEN** `open-agreements scan input.docx`
- **THEN** all `[bracketed]` content is extracted and classified by length
- **AND** split-run placeholders are identified
- **AND** footnote count is reported

#### Scenario: [OA-CLI-002] Draft replacements output
- **WHEN** `open-agreements scan input.docx --output-replacements replacements.json`
- **THEN** a draft `replacements.json` is written with auto-generated tag names
- **AND** the author can refine the generated map

### Requirement: CLI Interface
The system SHALL expose commands: `fill <template>` (render filled DOCX), `validate [template|recipe]` (run validation pipeline), `list` (show available templates and recipes).

#### Scenario: [OA-CLI-003] Fill command renders output
- **GIVEN** the CLI is installed and a valid template exists
- **WHEN** the user runs `open-agreements fill common-paper-mutual-nda --set company_name="Acme Corp" --set effective_date="2026-03-01"`
- **THEN** the system renders a filled DOCX and writes it to the output path

#### Scenario: [OA-CLI-004] List command shows templates
- **GIVEN** the CLI is installed with internal and external templates
- **WHEN** the user runs `open-agreements list`
- **THEN** the system displays each template with name, license info, field count, source, and source URL

### Requirement: Claude Code Skill
The system SHALL generate a Claude Code slash command that discovers template fields from metadata, interviews the user via AskUserQuestion, and renders the filled DOCX.

#### Scenario: [OA-CLI-005] Skill interviews user for field values
- **GIVEN** the Claude Code skill is invoked with `/open-agreements nda`
- **WHEN** the skill reads the template metadata and finds 8 required fields
- **THEN** the skill asks the user for field values via AskUserQuestion in multiple rounds of up to 4 questions each, grouped by template section

#### Scenario: [OA-CLI-006] Skill renders DOCX after interview
- **GIVEN** the user has answered all required field questions
- **WHEN** the skill has collected all values
- **THEN** the skill invokes the template engine and saves the filled DOCX to the user's working directory

### Requirement: Agent-Agnostic Skill Architecture
The system SHALL define a `ToolCommandAdapter` interface enabling future adapters for other coding agents beyond Claude Code.

#### Scenario: [OA-CLI-007] Claude Code adapter implements interface
- **GIVEN** a `ToolCommandAdapter` interface with methods for field discovery, user interaction, and template rendering
- **WHEN** the Claude Code adapter is instantiated
- **THEN** it implements all interface methods and generates a valid Claude Code slash command file

#### Scenario: [OA-CLI-008] New adapter can be added without modifying core
- **GIVEN** the `ToolCommandAdapter` interface is part of the core command-generation contract
- **WHEN** a developer creates a new adapter (e.g., for Cursor or Windsurf)
- **THEN** they can implement the interface without modifying any existing core or adapter code

### Requirement: Agent Skills Specification Compliance
The system SHALL include a skill directory compliant with the Agent Skills spec
(agentskills.io) with YAML frontmatter containing `name` and `description` fields,
where the directory name matches the `name` field.

#### Scenario: [OA-CLI-009] Skill renders DOCX via npx (zero pre-install)
- **GIVEN** Node.js >=20 is available but open-agreements is NOT globally installed
- **WHEN** an agent activates the skill and the user requests to fill a template
- **THEN** the skill runs `npx -y open-agreements@latest fill <template>` to render DOCX

#### Scenario: [OA-CLI-010] Skill renders DOCX via installed CLI
- **GIVEN** the open-agreements CLI IS globally installed
- **WHEN** an agent activates the skill and the user requests to fill a template
- **THEN** the skill renders a DOCX file via the CLI directly

#### Scenario: [OA-CLI-011] Preview-only fallback without Node.js
- **GIVEN** Node.js is NOT available
- **WHEN** an agent activates the skill
- **THEN** the skill produces a preview-only markdown document labeled as such

### Requirement: Machine-Readable Template Discovery
The `list` command SHALL support a `--json` flag that outputs template metadata
including all field definitions, enabling programmatic field discovery by agent skills.
Output SHALL be sorted by name. Templates SHALL include `source_url` and
`attribution_text`. Array fields with nested item schemas SHALL include those
nested item definitions in discovery output. `enum` and `multiselect` fields
SHALL include their `options` array so agents can pick or validate values
without out-of-band metadata access; fields of any other type SHALL omit the
`options` key entirely.

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

#### Scenario: [OA-CLI-025] JSON output exposes option lists for enum and multiselect
- **GIVEN** a template with an `enum` or `multiselect` field declaring an `options` array
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the matching template entry's field includes its `options` array
- **AND** fields of other types in the same template omit the `options` key entirely

### Requirement: Optional Content Root Overrides
The system SHALL support optional content root overrides via the
`OPEN_AGREEMENTS_CONTENT_ROOTS` environment variable. The value MUST be treated
as a path-delimited list of root directories that may contain `templates/`,
`external/`, and `recipes/` subdirectories.

#### Scenario: [OA-CLI-015] Default behavior without env var
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` is not set
- **THEN** agreement discovery uses bundled package directories only

#### Scenario: [OA-CLI-016] Additional discovery with env var
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` is set to one or more directories
- **THEN** agreement discovery includes matching IDs from those directories
- **AND** bundled package directories remain available as fallback

### Requirement: Content Root Precedence and Dedupe
The system SHALL apply deterministic precedence when duplicate agreement IDs
exist across multiple content roots, and the system SHALL dedupe by first
match.

#### Scenario: [OA-CLI-017] Override wins over bundled content
- **GIVEN** agreement ID `x` exists in both an override root and bundled content
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` includes the override root first
- **THEN** commands resolve ID `x` to the override root copy
- **AND** bundled duplicate entries are not listed a second time

### Requirement: Unified Root-Aware Command Resolution
The `fill`, `list`, and `validate` commands SHALL resolve agreements using the
merged root model (override roots first, bundled fallback).

#### Scenario: [OA-CLI-018] Fill from override root
- **WHEN** `fill <id>` is run and `<id>` exists only in an override root
- **THEN** the command resolves and fills that agreement successfully

#### Scenario: [OA-CLI-019] List includes override-only entries
- **WHEN** `list --json` is run with override roots configured
- **THEN** the output includes override-only entries merged into the inventory

#### Scenario: [OA-CLI-020] Validate single ID across tiers with overrides
- **WHEN** `validate <id>` is run for an ID present in templates, external, or recipes under override roots
- **THEN** the command validates the matching entry from the merged root set

### Requirement: CLI Fill for All Template Types
The CLI `fill` command MUST render valid DOCX output for all supported template
types (NDA, employment offer, IP assignment, confidentiality acknowledgement).

#### Scenario: [OA-CLI-021] CLI fill renders all template types
- **WHEN** `fill` is invoked for employment offer, IP assignment, or confidentiality templates
- **THEN** a valid DOCX file is produced for each template

#### Scenario: [OA-CLI-022] CLI employment memo output
- **WHEN** `fill` is invoked with `--emit-memo` for an employment template matching jurisdiction rules
- **THEN** JSON output includes disclaimer, findings, and jurisdiction warnings
- **AND** when no rules match, no jurisdiction warnings are fabricated
- **AND** Markdown output includes mandatory disclaimer

### Requirement: List Command Envelope Structure
The `list --json` output MUST include `schema_version`, `cli_version`, and
typed items with license information.

#### Scenario: [OA-CLI-023] List JSON envelope structure
- **WHEN** `list --json` is invoked
- **THEN** output has `schema_version: 1`, a `cli_version` string, and an `items` array
- **AND** each item contains `name` and either `license` or `license_note`
