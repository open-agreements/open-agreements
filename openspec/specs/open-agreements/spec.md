# open-agreements Specification

## Purpose
TBD - created by archiving change add-recipe-engine. Update Purpose after archive.
## Requirements
### Requirement: Template Engine Sandboxing
The template engine MUST run template expressions in a sandboxed execution
context (Node.js VM) by default. The `noSandbox` option MUST NOT be set to
`true` in production code. This protects against arbitrary code execution
from contributed templates.

#### Scenario: [OA-001] Sandbox enabled by default
- **WHEN** `fillTemplate()` is called with any template
- **THEN** docx-templates runs with sandboxing enabled (default behavior)
- **AND** simple `{field_name}` substitution works correctly

#### Scenario: [OA-002] Malicious template expression blocked
- **WHEN** a template contains `{require('fs').readFileSync('/etc/passwd')}`
- **THEN** the sandbox prevents access to `require` and the expression fails
- **AND** no file system access occurs

### Requirement: Template Validation Severity
The template validator MUST produce errors (not warnings) when a required
metadata field has no corresponding `{tag}` placeholder in the template DOCX.
Optional fields missing from the DOCX MUST produce warnings. The `valid` field
MUST be `false` when any required field is missing.

#### Scenario: [OA-003] Required field missing from DOCX
- **WHEN** metadata lists `party_1_name` in `required_fields`
- **AND** no `{party_1_name}` placeholder exists in template.docx
- **THEN** validation produces an error (not a warning)
- **AND** `valid` is `false`

#### Scenario: [OA-004] Optional field missing from DOCX
- **WHEN** metadata defines field `governing_law` but does not include it in `required_fields`
- **AND** no `{governing_law}` placeholder exists in template.docx
- **THEN** validation produces a warning
- **AND** `valid` remains `true`

### Requirement: DOCX Text Extraction
Text extraction from DOCX files MUST unzip the archive and parse
`word/document.xml` using a proper XML parser or regex on extracted XML.
Raw ZIP binary buffers MUST NOT be scanned directly for XML patterns.
Text from `<w:t>` elements MUST be concatenated per-paragraph to avoid
false matches across element boundaries.

#### Scenario: [OA-005] Output heading validation
- **WHEN** `validateOutput()` compares source and output DOCX heading counts
- **THEN** it extracts `word/document.xml` via AdmZip before scanning
- **AND** counts heading styles from the extracted XML (not raw ZIP bytes)

#### Scenario: [OA-006] Template placeholder extraction
- **WHEN** `extractDocxText()` reads a DOCX for placeholder discovery
- **THEN** `<w:t>` content is concatenated within each `<w:p>` paragraph
- **AND** paragraphs are separated to prevent cross-boundary false matches

### Requirement: Metadata Schema Constraints
The metadata schema MUST enforce type-specific constraints on field definitions.
Fields with `type: enum` MUST have a non-empty `options` array. Fields with a
`default` value MUST have that default validate against the declared `type`.

#### Scenario: [OA-007] Enum field without options
- **WHEN** metadata defines a field with `type: enum` and no `options` array
- **THEN** schema validation fails with a descriptive error

#### Scenario: [OA-008] Default value type mismatch
- **WHEN** metadata defines a field with `type: number` and `default: "abc"`
- **THEN** schema validation fails with a descriptive error

### Requirement: Fill Value Validation
The `fillTemplate()` function MUST warn when provided values contain keys
that do not match any field name in the template metadata. This catches
typos in CLI flags or data files.

#### Scenario: [OA-009] Unknown key in fill values
- **WHEN** fill is called with `{ party_1_nme: "Acme" }` (typo)
- **AND** metadata has no field named `party_1_nme`
- **THEN** a warning is emitted listing the unknown key(s)
- **AND** fill proceeds (warning, not error)

### Requirement: CI License Compliance
The CI license compliance check MUST diff against the PR base SHA for
pull request events. It MUST NOT use `HEAD~1` for PRs, as this only
checks the most recent commit and misses earlier commits in multi-commit PRs.

#### Scenario: [OA-010] Multi-commit PR license check
- **WHEN** a PR has 3 commits and the first modifies a non-derivative template
- **THEN** the CI check detects the modification by diffing against the PR base
- **AND** the check fails appropriately

#### Scenario: [OA-011] Push to main license check
- **WHEN** a commit is pushed directly to main
- **THEN** the CI check diffs against `HEAD~1` (single-commit context)

### Requirement: Recipe Pipeline
The recipe engine MUST support a multi-stage pipeline that transforms a
source DOCX into a filled agreement: download (or accept user-supplied input)
then clean then patch then fill then verify. Each stage MUST read from a file
path and write to a file path. Intermediate files MUST be written to a temp
directory and cleaned up after completion unless `--keep-intermediate` is set.

#### Scenario: [OA-012] Full pipeline with auto-download
- **WHEN** `recipe run nvca-voting-agreement --data values.json -o output.docx`
- **THEN** the engine downloads the source DOCX from `source_url` in metadata
- **AND** runs clean, patch, fill, verify stages in sequence
- **AND** writes the final filled DOCX to `output.docx`

#### Scenario: [OA-013] Full pipeline with user-supplied input
- **WHEN** `recipe run nvca-voting-agreement --input local.docx --data values.json -o output.docx`
- **THEN** the engine uses `local.docx` instead of downloading
- **AND** runs the same clean, patch, fill, verify pipeline

#### Scenario: [OA-014] Keep intermediate files
- **WHEN** `--keep-intermediate` is set
- **THEN** cleaned, patched, and filled intermediate files are preserved in temp dir
- **AND** the temp dir path is reported to the user

### Requirement: Recipe CLI Subcommands
The CLI MUST provide subcommands for running the full recipe pipeline and
for running individual stages independently. Individual stages support
recipe authoring and debugging.

#### Scenario: [OA-015] Run full pipeline
- **WHEN** `open-agreements recipe run <recipe-id> --data <json> -o <output>`
- **THEN** the full download-clean-patch-fill-verify pipeline executes

#### Scenario: [OA-016] Run clean stage only
- **WHEN** `open-agreements recipe clean <input> -o <output> --recipe <id>`
- **THEN** only the clean stage runs, using the recipe's `clean.json` config

#### Scenario: [OA-017] Run patch stage only
- **WHEN** `open-agreements recipe patch <input> -o <output> --recipe <id>`
- **THEN** only the patch stage runs, using the recipe's `replacements.json`

### Requirement: DOCX Cleaner
The cleaner stage MUST remove footnotes and pattern-matched paragraphs from
a DOCX file based on a declarative `clean.json` configuration. Cleaning
operates at the OOXML level to preserve formatting of retained content.

#### Scenario: [OA-018] Remove footnotes
- **WHEN** `clean.json` has `removeFootnotes: true`
- **THEN** all `<w:footnoteReference>` runs are removed from `word/document.xml`
- **AND** all normal footnotes are removed from `word/footnotes.xml`
- **AND** separator and continuationSeparator footnotes are preserved

#### Scenario: [OA-019] Remove paragraph patterns
- **WHEN** `clean.json` has `removeParagraphPatterns: ["^Note to Drafter:"]`
- **THEN** paragraphs whose text matches the regex are removed from the document

### Requirement: Cross-Run Patcher
The patcher stage MUST replace bracketed placeholders with template tags
across Word XML run boundaries. It MUST use a char_map algorithm that maps
each character in the concatenated paragraph text to its source run and offset.
Replacement keys MUST be sorted longest-first to prevent partial matches.

#### Scenario: [OA-020] Single-run replacement
- **WHEN** `[Company Name]` exists entirely within one `<w:r>` element
- **THEN** the text is replaced in-place within that run
- **AND** run formatting (bold, italic, etc.) is preserved

#### Scenario: [OA-021] Cross-run replacement
- **WHEN** `[Company Name]` spans two runs (`[Company` in run 1, ` Name]` in run 2)
- **THEN** the replacement text is placed in the first run
- **AND** consumed text is removed from subsequent runs
- **AND** formatting of the first run is preserved

#### Scenario: [OA-022] Smart quote handling
- **WHEN** the source DOCX uses smart/curly quotes (U+201C, U+201D, U+2019)
- **THEN** the replacement map includes both smart and straight quote variants
- **AND** both variants are matched and replaced correctly

#### Scenario: [OA-023] Table cell processing
- **WHEN** placeholders appear in table cells (e.g., signature blocks)
- **THEN** the patcher processes paragraphs within table cells

### Requirement: Post-Fill Verifier
After filling, the verifier MUST check the output DOCX to confirm that all
context values appear in the document text, no unrendered template tags remain,
and no leftover source placeholders remain.

#### Scenario: [OA-024] All values present
- **WHEN** fill values include `company_name: "Acme Corp"`
- **THEN** the verifier confirms "Acme Corp" appears in the output text

#### Scenario: [OA-025] Unrendered tags detected
- **WHEN** a `{template_tag}` remains in the output (unfilled)
- **THEN** the verifier reports it as a failure

#### Scenario: [OA-026] Leftover brackets detected
- **WHEN** a `[bracketed placeholder]` from the replacement map remains
- **THEN** the verifier reports it as a failure

### Requirement: Scan Command
The `scan` command MUST analyze a user-supplied DOCX and report all bracketed
placeholders, classifying them as short (fill-in fields, <=80 chars) or long
(alternative clauses). It MUST detect split-run placeholders and count footnotes.
It MUST optionally output a draft `replacements.json` to bootstrap recipe authoring.

#### Scenario: [OA-027] Placeholder discovery
- **WHEN** `open-agreements scan input.docx`
- **THEN** all `[bracketed]` content is extracted and classified by length
- **AND** split-run placeholders are identified
- **AND** footnote count is reported

#### Scenario: [OA-028] Draft replacements output
- **WHEN** `open-agreements scan input.docx --output-replacements replacements.json`
- **THEN** a draft `replacements.json` is written with auto-generated tag names
- **AND** the author can refine the generated map

### Requirement: Recipe Metadata Schema
Recipe metadata MUST be defined in `metadata.yaml` and validate against a Zod
schema. Required fields: `name`, `source_url` (valid URL), `source_version`,
`license_note`, `fields` (array of field definitions, reusing template field
schema). Optional fields: `description`, `optional` (boolean, default false).

#### Scenario: [OA-029] Valid recipe metadata
- **WHEN** a recipe has `metadata.yaml` with all required fields
- **THEN** schema validation passes

#### Scenario: [OA-030] Missing source_url
- **WHEN** a recipe metadata omits `source_url`
- **THEN** schema validation fails with a descriptive error

### Requirement: Recipe Directory Validation
Recipe validation MUST enforce: no `.docx` files in the recipe directory
(copyrighted content must not be committed), `replacements.json` exists and
contains string-to-string entries, replacement target fields are declared in
`metadata.yaml` (`fields` + `required_fields`), `metadata.yaml` validates against the schema, and
`clean.json` validates against the clean config schema. Scaffold recipes
(metadata.yaml only) MUST pass validation without requiring other files.

#### Scenario: [OA-031] DOCX file detected in recipe directory
- **WHEN** a `.docx` file exists in `recipes/nvca-voting-agreement/`
- **THEN** validation fails with an error about copyrighted content

#### Scenario: [OA-032] Scaffold recipe validation
- **WHEN** a recipe directory contains only `metadata.yaml`
- **AND** metadata is valid
- **THEN** validation passes (scaffold recipes are allowed)

#### Scenario: [OA-033] Replacement target not covered by metadata
- **WHEN** `replacements.json` maps `[Tag]` to `{field_x}`
- **AND** `metadata.yaml` does not define `field_x` in `fields`
- **THEN** validation warns about the uncovered replacement target

### Requirement: DOCX Template Rendering
The system SHALL accept a template name, load the corresponding DOCX template, substitute `{tag}` placeholders with provided values, and produce a filled DOCX file preserving all original formatting.

#### Scenario: [OA-034] Successful template fill
- **GIVEN** a template named `common-paper-mutual-nda` exists with placeholders `{company_name}` and `{effective_date}`
- **WHEN** the user invokes `fill common-paper-mutual-nda` with values `company_name=Acme Corp` and `effective_date=2026-03-01`
- **THEN** the system produces a DOCX file with all `{company_name}` placeholders replaced by "Acme Corp" and all `{effective_date}` placeholders replaced by "2026-03-01", preserving the original formatting (bold, italic, headings, tables)

#### Scenario: [OA-035] Missing required field
- **GIVEN** a template where `governing_law` appears in `required_fields`
- **WHEN** the user invokes `fill` without providing `governing_law`
- **THEN** the system returns an error listing the missing required fields

### Requirement: Mutual NDA Selection Semantics
The `common-paper-mutual-nda` fill flow SHALL preserve only selected option
text for checkbox-style MNDA term and confidentiality term choices, while
marking selected choices with `[ x ]`.

#### Scenario: [OA-036] Fixed term selection removes non-selected options
- **GIVEN** the user sets `mnda_term` to a fixed duration
- **AND** sets `confidentiality_term` to fixed-term language
- **WHEN** the template is filled
- **THEN** fixed-term options are marked with `[ x ]`
- **AND** conflicting alternatives (for example "until terminated" or "in perpetuity") are removed

#### Scenario: [OA-037] Perpetual selection marks selected options
- **GIVEN** the user sets `mnda_term` to `until terminated`
- **AND** sets `confidentiality_term` to `In perpetuity`
- **WHEN** the template is filled
- **THEN** the selected until-terminated and perpetuity options are marked with `[ x ]`
- **AND** non-selected fixed-term alternatives are removed

### Requirement: Template Metadata Schema
Each template directory SHALL contain a `metadata.yaml` validated by Zod schema with fields: `name`, `source_url`, `version`, `license` (enum: CC-BY-4.0, CC0-1.0), `allow_derivatives` (boolean), `attribution_text`, `fields` (array of field definitions with name, type, description, required).

#### Scenario: [OA-038] Valid metadata passes validation
- **GIVEN** a template directory with a `metadata.yaml` containing all required fields with valid values
- **WHEN** the system validates the metadata
- **THEN** validation passes with no errors

#### Scenario: [OA-039] Missing metadata field fails validation
- **GIVEN** a template directory with a `metadata.yaml` missing the `license` field
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: [OA-040] Invalid license enum fails validation
- **GIVEN** a template directory with `metadata.yaml` containing `license: MIT`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error indicating the license value is not in the allowed enum (CC-BY-4.0, CC0-1.0)

### Requirement: License Compliance Validation
The system SHALL refuse to generate derivatives of templates where `allow_derivatives` is false and SHALL fail CI if a PR modifies content of a CC BY-ND licensed template.

#### Scenario: [OA-041] Derivative blocked for non-derivative license
- **GIVEN** a template with `allow_derivatives: false` in its metadata
- **WHEN** the user invokes `fill` on that template
- **THEN** the system refuses to render the template and returns an error explaining the license restriction

#### Scenario: [OA-042] CI blocks modification of CC BY-ND template
- **GIVEN** a CI workflow running on a PR that modifies a template DOCX file where `allow_derivatives` is false
- **WHEN** the CI validation step runs
- **THEN** the CI check fails with an error indicating that modifying non-derivative templates is prohibited

### Requirement: External Template Support
The system SHALL support external templates -- documents whose licenses (e.g. CC BY-ND 4.0) prohibit redistribution of modified versions. External templates are vendored unchanged under `external/` with a `metadata.yaml` containing `source_sha256` for integrity verification. The `fill` command fills them the same way as internal templates. The filled output is a transient derivative that exists only on the user's machine.

#### Scenario: [OA-043] External template fill
- **GIVEN** an external template `yc-safe-valuation-cap` with `license: CC-BY-ND-4.0` and `allow_derivatives: false`
- **WHEN** the user invokes `fill yc-safe-valuation-cap` with valid field values
- **THEN** the system fills the template and produces a DOCX, printing a license notice that the output must not be redistributed in modified form

#### Scenario: [OA-044] External metadata requires source_sha256
- **GIVEN** an external template directory with `metadata.yaml` missing `source_sha256`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: [OA-045] External template appears in list output
- **GIVEN** external templates exist under `external/`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** external templates appear in the output with `license: CC-BY-ND-4.0` and `source` indicating the originating organization

### Requirement: CLI Interface
The system SHALL expose commands: `fill <template>` (render filled DOCX), `validate [template|recipe]` (run validation pipeline), `list` (show available templates and recipes).

#### Scenario: [OA-046] Fill command renders output
- **GIVEN** the CLI is installed and a valid template exists
- **WHEN** the user runs `open-agreements fill common-paper-mutual-nda --set company_name="Acme Corp" --set effective_date="2026-03-01"`
- **THEN** the system renders a filled DOCX and writes it to the output path

#### Scenario: [OA-047] List command shows templates
- **GIVEN** the CLI is installed with internal and external templates
- **WHEN** the user runs `open-agreements list`
- **THEN** the system displays each template with name, license info, field count, source, and source URL

### Requirement: Claude Code Skill
The system SHALL generate a Claude Code slash command that discovers template fields from metadata, interviews the user via AskUserQuestion, and renders the filled DOCX.

#### Scenario: [OA-048] Skill interviews user for field values
- **GIVEN** the Claude Code skill is invoked with `/open-agreements nda`
- **WHEN** the skill reads the template metadata and finds 8 required fields
- **THEN** the skill asks the user for field values via AskUserQuestion in multiple rounds of up to 4 questions each, grouped by template section

#### Scenario: [OA-049] Skill renders DOCX after interview
- **GIVEN** the user has answered all required field questions
- **WHEN** the skill has collected all values
- **THEN** the skill invokes the template engine and saves the filled DOCX to the user's working directory

### Requirement: Output Validation
The system SHALL verify that rendered DOCX output preserves the section count and heading structure of the source template.

#### Scenario: [OA-050] Output structure matches source
- **GIVEN** a source template with 5 sections and 12 headings
- **WHEN** the system renders a filled DOCX
- **THEN** the output DOCX contains exactly 5 sections and 12 headings matching the source structure

#### Scenario: [OA-051] Structural drift detected
- **GIVEN** a rendered DOCX where a heading was accidentally removed during substitution
- **WHEN** the system validates the output
- **THEN** validation fails with an error indicating the structural mismatch (expected vs actual heading count)

### Requirement: Agent-Agnostic Skill Architecture
The system SHALL define a `ToolCommandAdapter` interface enabling future adapters for other coding agents beyond Claude Code.

#### Scenario: [OA-052] Claude Code adapter implements interface
- **GIVEN** a `ToolCommandAdapter` interface with methods for field discovery, user interaction, and template rendering
- **WHEN** the Claude Code adapter is instantiated
- **THEN** it implements all interface methods and generates a valid Claude Code slash command file

#### Scenario: [OA-053] New adapter can be added without modifying core
- **GIVEN** the `ToolCommandAdapter` interface is defined in `src/core/command-generation/types.ts`
- **WHEN** a developer creates a new adapter (e.g., for Cursor or Windsurf)
- **THEN** they can implement the interface without modifying any existing core or adapter code

### Requirement: Agent Skills Specification Compliance
The system SHALL include a skill directory compliant with the Agent Skills spec
(agentskills.io) with YAML frontmatter containing `name` and `description` fields,
where the directory name matches the `name` field.

#### Scenario: [OA-054] Skill renders DOCX via npx (zero pre-install)
- **GIVEN** Node.js >=20 is available but open-agreements is NOT globally installed
- **WHEN** an agent activates the skill and the user requests to fill a template
- **THEN** the skill runs `npx -y open-agreements@latest fill <template>` to render DOCX

#### Scenario: [OA-055] Skill renders DOCX via installed CLI
- **GIVEN** the open-agreements CLI IS globally installed
- **WHEN** an agent activates the skill and the user requests to fill a template
- **THEN** the skill renders a DOCX file via the CLI directly

#### Scenario: [OA-056] Preview-only fallback without Node.js
- **GIVEN** Node.js is NOT available
- **WHEN** an agent activates the skill
- **THEN** the skill produces a preview-only markdown document labeled as such

### Requirement: Machine-Readable Template Discovery
The `list` command SHALL support a `--json` flag that outputs template metadata
including all field definitions, enabling programmatic field discovery by agent skills.
Output SHALL be sorted by name. Templates SHALL include `source_url` and `attribution_text`.

#### Scenario: [OA-057] JSON output includes full metadata sorted by name
- **GIVEN** templates are available
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the output is a valid JSON envelope with `schema_version`, `cli_version`, and `items` array sorted by name, where each item includes `name`, `description`, `license`, `source_url`, `source`, `attribution_text`, and `fields`

#### Scenario: [OA-058] --json-strict exits non-zero on metadata errors
- **GIVEN** a template with invalid metadata exists
- **WHEN** the user runs `open-agreements list --json-strict`
- **THEN** the command prints errors to stderr and exits with non-zero status

#### Scenario: [OA-059] --templates-only filters to templates
- **GIVEN** internal and external templates are available
- **WHEN** the user runs `open-agreements list --json --templates-only`
- **THEN** the output contains only template entries (no recipes)

### Requirement: npm Package Integrity
The npm tarball SHALL include `dist/`, `bin/`, `templates/`, `recipes/`, and `skills/`
directories. The `prepack` script SHALL run the build before packing. The tarball
SHALL NOT include `src/` or `node_modules/`.

#### Scenario: [OA-060] Clean install from registry works
- **GIVEN** the package is published to npm
- **WHEN** a user runs `npm install open-agreements` in a fresh directory
- **THEN** `npx open-agreements list --json` produces valid JSON output
