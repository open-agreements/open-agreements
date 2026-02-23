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
- **GIVEN** the `ToolCommandAdapter` interface is part of the core command-generation contract
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

### Requirement: Recipe Computed Interaction Profiles
The system SHALL support an optional `computed.json` profile in a recipe directory to define deterministic, declarative interaction rules that derive computed values from input values.

#### Scenario: [OA-061] Computed profile is optional and non-breaking
- **WHEN** a recipe does not include `computed.json`
- **THEN** `recipe run` behavior remains unchanged from the existing clean-patch-fill-verify pipeline

#### Scenario: [OA-062] Rule-driven derived values are computed deterministically
- **WHEN** a recipe includes `computed.json` with ordered interaction rules
- **THEN** rules are evaluated in deterministic order across bounded passes
- **AND** derived values are merged into the fill context prior to rendering

### Requirement: Computed Artifact Export
The `recipe run` command SHALL support exporting a machine-readable computed artifact that captures input values, derived values, and rule evaluation trace.

#### Scenario: [OA-063] Computed artifact file is written on request
- **WHEN** the user runs `open-agreements recipe run <id> --computed-out computed.json`
- **THEN** the command writes a JSON artifact containing recipe id, timestamp, inputs, derived values, and pass/rule trace

#### Scenario: [OA-064] Artifact trace includes rule match outcomes and assignments
- **WHEN** rule evaluation runs for a recipe with a computed profile
- **THEN** each pass includes per-rule matched status
- **AND** each matched rule records assignment deltas applied to computed state

### Requirement: Computed Profile Validation
Recipe validation SHALL validate `computed.json` format when present and report errors for invalid predicate operators, malformed rules, or invalid assignment values.

#### Scenario: [OA-065] Invalid computed profile fails recipe validation
- **WHEN** `computed.json` contains an unsupported predicate operator
- **THEN** `validateRecipe` returns invalid with a descriptive computed-profile error

### Requirement: NVCA SPA Interaction Audit Coverage
The NVCA SPA test suite SHALL include interaction-focused coverage that asserts multi-condition derived outputs and their traceability, including Dispute Resolution and Governing Law dependencies.

#### Scenario: [OA-066] Dispute resolution interaction produces required computed outputs
- **WHEN** NVCA SPA computed inputs select courts vs arbitration and include a forum state
- **THEN** computed outputs indicate the selected dispute-resolution track
- **AND** computed outputs include forum vs governing-law alignment status
- **AND** when courts are selected and judicial district is omitted, computed outputs derive judicial district defaults
- **AND** the exported trace shows the dependency chain

### Requirement: Optional Content Root Overrides
The system SHALL support optional content root overrides via the
`OPEN_AGREEMENTS_CONTENT_ROOTS` environment variable. The value MUST be treated
as a path-delimited list of root directories that may contain `templates/`,
`external/`, and `recipes/` subdirectories.

#### Scenario: [OA-067] Default behavior without env var
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` is not set
- **THEN** agreement discovery uses bundled package directories only

#### Scenario: [OA-068] Additional discovery with env var
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` is set to one or more directories
- **THEN** agreement discovery includes matching IDs from those directories
- **AND** bundled package directories remain available as fallback

### Requirement: Content Root Precedence and Dedupe
The system SHALL apply deterministic precedence when duplicate agreement IDs
exist across multiple content roots, and the system SHALL dedupe by first
match.

#### Scenario: [OA-069] Override wins over bundled content
- **GIVEN** agreement ID `x` exists in both an override root and bundled content
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` includes the override root first
- **THEN** commands resolve ID `x` to the override root copy
- **AND** bundled duplicate entries are not listed a second time

### Requirement: Unified Root-Aware Command Resolution
The `fill`, `list`, and `validate` commands SHALL resolve agreements using the
merged root model (override roots first, bundled fallback).

#### Scenario: [OA-070] Fill from override root
- **WHEN** `fill <id>` is run and `<id>` exists only in an override root
- **THEN** the command resolves and fills that agreement successfully

#### Scenario: [OA-071] List includes override-only entries
- **WHEN** `list --json` is run with override roots configured
- **THEN** the output includes override-only entries merged into the inventory

#### Scenario: [OA-072] Validate single ID across tiers with overrides
- **WHEN** `validate <id>` is run for an ID present in templates, external, or recipes under override roots
- **THEN** the command validates the matching entry from the merged root set

### Requirement: Public Trust Signal Surfaces
The project SHALL expose trust signals that help users and AI agents quickly verify maintenance quality and testing posture from public surfaces.

#### Scenario: [OA-073] README exposes trust evidence at first glance
- **WHEN** a visitor opens the repository README
- **THEN** the top section shows trust signals for CI status and coverage
- **AND** identifies the active JavaScript test framework (Vitest or Jest)

#### Scenario: [OA-074] Landing page exposes trust evidence without scrolling deep
- **WHEN** a visitor opens the landing page
- **THEN** the Trust section links to npm package, CI status, coverage dashboard, and source repository
- **AND** includes an explicit signal for the active JavaScript test framework (Vitest or Jest)

### Requirement: CI-Published Coverage and Test Results
The CI pipeline SHALL publish both code coverage and machine-readable unit test results to external trust surfaces.

#### Scenario: [OA-075] Coverage uploads to Codecov
- **WHEN** CI runs on pull requests or pushes to main
- **THEN** coverage output is generated from the active test runner
- **AND** an `lcov` report is uploaded to Codecov

#### Scenario: [OA-076] Unit test results upload in machine-readable format
- **WHEN** CI runs unit tests
- **THEN** the active test runner emits a JUnit XML report
- **AND** CI uploads that test result report to Codecov test-results ingestion

#### Scenario: [OA-077] Tokenless-first test result upload
- **WHEN** repository-level Codecov settings allow tokenless uploads
- **THEN** CI test result upload succeeds without a hard dependency on `CODECOV_TOKEN`
- **AND** repository docs or workflow comments explain the expected auth mode

### Requirement: Repository-Defined Coverage Gate Policy
Coverage gate policy SHALL be versioned in-repo so trust thresholds are explicit, reviewable, and ratchetable over time.

#### Scenario: [OA-078] Initial patch and project gates are codified
- **WHEN** coverage policy is configured
- **THEN** patch coverage uses target `85%` with `5%` threshold
- **AND** project coverage uses target `auto` with `0.5%` threshold

#### Scenario: [OA-079] Coverage policy prevents regressions while allowing staged hardening
- **WHEN** coverage is uploaded for new commits
- **THEN** the project gate blocks material regression relative to baseline
- **AND** policy notes define staged increases toward explicit project floors as coverage grows

#### Scenario: [OA-080] Coverage denominator is scoped to implementation sources
- **WHEN** coverage runs in CI
- **THEN** denominator scope is limited to implementation source trees configured in coverage settings
- **AND** tooling/support paths (for example scripts, generated output, docs/site content, and test files) are excluded from gate calculations

### Requirement: Spec-Backed Allure Coverage Expansion
Trust-oriented test coverage SHALL include executable Allure tests keyed to canonical OpenSpec scenarios, including retroactive scenario additions for already-implemented behavior.

#### Scenario: [OA-081] Retroactive specs are added for implemented behavior
- **WHEN** maintainers identify implemented behavior not represented in canonical scenarios
- **THEN** canonical OpenSpec scenarios are added or clarified before claiming coverage
- **AND** scenario names remain stable enough for traceability mapping

#### Scenario: [OA-082] Behavior-level Allure tests are linked to canonical scenarios
- **WHEN** canonical scenarios exist for an implemented behavior
- **THEN** at least one Allure-reported test asserts that behavior and maps to the scenario
- **AND** `npm run check:spec-coverage` remains green for missing/extra/pending mappings

### Requirement: Canonical Evidence Story
The trust surface SHALL include a reproducible evidence story demonstrating the fill pipeline from structured JSON input to valid DOCX output, with pre-generated page renders committed at stable paths.

#### Scenario: [OA-132] Canonical evidence story fills template from JSON payload
- **WHEN** the evidence story JSON payload is passed to the fill pipeline for the Common Paper Mutual NDA template
- **THEN** the CLI produces a valid DOCX file with correct placeholder substitution
- **AND** the JSON payload and rendered page PNG are attached as Allure evidence artifacts

### Requirement: Opaque Download Links for Hosted Fill
The hosted OpenAgreements fill flow SHALL issue download URLs using opaque
download identifiers instead of embedding full fill payload values in the URL.

#### Scenario: [OA-083] fill_template url mode returns id-based download metadata
- **WHEN** a client calls `fill_template` with `return_mode: "url"`
- **THEN** the response includes a `download_id` and `download_url`
- **AND** `download_url` uses an opaque identifier parameter (`id`) rather than serialized fill values

#### Scenario: [OA-084] download endpoint resolves a valid opaque identifier
- **WHEN** a client requests `/api/download` with a valid non-expired `id`
- **THEN** the endpoint returns `200` and a DOCX attachment

### Requirement: Download Endpoint Supports HEAD Probing
The hosted download endpoint SHALL support `HEAD` requests so clients can probe
link viability without downloading the document body.

#### Scenario: [OA-085] head request for valid id-based link
- **WHEN** a client sends `HEAD /api/download?id=<valid_id>`
- **THEN** the endpoint returns `200`
- **AND** the response omits the document body

### Requirement: Download Errors Are Machine-Actionable
The hosted download endpoint SHALL return machine-readable error codes that
distinguish missing parameters, malformed links, invalid signatures, and expiry.

#### Scenario: [OA-086] malformed or tampered link returns explicit code
- **WHEN** a client sends a download request with a malformed or tampered identifier
- **THEN** the endpoint returns an error response with a specific error code describing the failure class
- **AND** the response does not collapse all failures into one generic message

#### Scenario: [OA-087] expired link returns explicit expiry code
- **WHEN** a client sends a request with an expired identifier
- **THEN** the endpoint returns an error response with an explicit expiry error code

### Requirement: Document-First Closing Checklist Data Model
The system SHALL model closing checklists with canonical documents as the primary records and stage-scoped checklist entries as render rows. IDs SHALL be stable string identifiers and SHALL NOT require UUID format.

#### Scenario: [OA-088] Document and checklist entry use stable string IDs
- **WHEN** a checklist payload defines `document_id: "escrow-agreement-executed"` and `entry_id: "entry-escrow-closing"`
- **THEN** validation accepts those IDs as valid stable strings
- **AND** validation does not require UUID-only formats

#### Scenario: [OA-089] Checklist entry references unknown document ID
- **WHEN** a checklist entry references a `document_id` not present in canonical documents
- **THEN** validation fails with a structured error identifying the missing reference

#### Scenario: [OA-090] One document maps to at most one checklist entry
- **WHEN** two checklist entries reference the same `document_id`
- **THEN** validation fails with a structured duplicate-mapping error

### Requirement: Stage-First Nested Lawyer Rendering
The system SHALL render closing checklists grouped by stage (`PRE_SIGNING`, `SIGNING`, `CLOSING`, `POST_CLOSING`) with nested rows based on parent entry relationships.

#### Scenario: [OA-091] Checklist renders in canonical stage order
- **WHEN** checklist entries are provided across all four stages
- **THEN** rendered output groups rows under those stage headers in canonical order

#### Scenario: [OA-092] Child entry is rendered beneath parent entry
- **WHEN** an entry includes `parent_entry_id` referencing another entry in the same stage
- **THEN** rendered output displays the child row indented beneath the parent row

### Requirement: Stable Sort Key and Computed Display Numbering
Checklist entries SHALL include a stable non-positional `sort_key`. Rendered row numbering (`1`, `1.1`, `1.1.1`) SHALL be computed at render time from the sorted nested tree.

#### Scenario: [OA-093] Inserting an entry does not require renumbering stored IDs
- **WHEN** a new entry is inserted between existing entries by assigning an intermediate `sort_key`
- **THEN** existing `entry_id` and `document_id` values remain unchanged
- **AND** rendered numbering updates to reflect the new order

### Requirement: Optional Document Labels
Canonical documents SHALL support optional freeform `labels[]` metadata.

#### Scenario: [OA-094] Document carries optional labels
- **WHEN** a document includes labels like `phase:closing` and `priority:high`
- **THEN** validation accepts the labels
- **AND** checklist rendering remains valid whether labels are present or absent

### Requirement: Named Signatory Tracking with Signature Artifacts
The system SHALL track signatories as explicit named entries with per-signatory status on checklist entries. The renderer SHALL display signer identity and signer status, not only aggregate counts. Signatories SHALL support optional signature artifact locations.

#### Scenario: [OA-095] Partially signed document shows missing signer identity
- **WHEN** one checklist entry has three expected signatories and one has not signed
- **THEN** rendered output identifies the specific signatory marked pending
- **AND** rendered output does not collapse the state to only a numeric fraction

#### Scenario: [OA-096] Signatory stores signature artifact location
- **WHEN** a signatory includes a signature artifact with `uri` or `path` and optional `received_at`
- **THEN** validation accepts the artifact metadata
- **AND** rendered output can include the artifact location context

### Requirement: Minimal Citation Support
Checklist entries SHALL support optional minimal citation metadata as a list of reference objects.

#### Scenario: [OA-097] Entry includes simple citation reference
- **WHEN** an entry includes `citations: [{ "ref": "SPA §6.2(b)" }]`
- **THEN** rendered output includes that citation with the corresponding row

### Requirement: Document-Linked and Document-Less Checklist Entries
Checklist entries MAY exist without `document_id` to support pre-document or administrative tasks. Action items and issues SHALL link to zero or more canonical documents via `related_document_ids`.

#### Scenario: [OA-098] Checklist entry with no document for pre-document task
- **WHEN** an entry is created for a task like ordering a good standing certificate and omits `document_id`
- **THEN** validation succeeds
- **AND** the entry renders normally in its stage section

#### Scenario: [OA-099] Unlinked action item is rendered in fallback section
- **WHEN** an action item has no related document IDs
- **THEN** rendered output includes the item in a dedicated unlinked section

### Requirement: Simplified Issue Lifecycle
Issues SHALL use a simplified lifecycle with only `OPEN` and `CLOSED` statuses.

#### Scenario: [OA-100] Issue with unsupported granular status is rejected
- **WHEN** an issue status is provided as `AGREED_IN_PRINCIPLE`
- **THEN** validation fails with a status-enum error

### Requirement: Standalone Working Group Document
The system SHALL treat the working group roster as a standalone document flow rather than an embedded closing checklist table.

#### Scenario: [OA-101] Checklist references working group roster document
- **WHEN** a user includes a working group list in the deal packet
- **THEN** the closing checklist represents it as a document row with link/reference metadata
- **AND** the checklist renderer does not require an embedded working-group table block

### Requirement: Legacy Checklist Payload Rejection
The system SHALL reject the previous flat checklist payload shape once the document-first model is enabled.

#### Scenario: [OA-102] Legacy flat payload submitted to checklist creation
- **WHEN** input includes only top-level legacy flat arrays and omits required document-first checklist entry structures
- **THEN** validation fails with machine-readable contract errors


### Requirement: Atomic Checklist JSON Patch Transactions
The system SHALL support checklist updates via JSON patch envelopes applied atomically. If any operation in a patch is invalid, the system SHALL apply none of the operations.

#### Scenario: [OA-103] Apply valid multi-operation patch atomically
- **WHEN** a patch contains valid operations that update multiple checklist targets
- **THEN** the system applies all operations in one transaction
- **AND** checklist revision increments exactly once

#### Scenario: [OA-104] Reject invalid patch without partial mutation
- **WHEN** one operation in a patch is invalid
- **THEN** the patch is rejected
- **AND** no checklist state mutation is committed

### Requirement: Optimistic Concurrency for Patch Apply
Patch apply SHALL require `expected_revision` and SHALL reject apply when current revision differs.

#### Scenario: [OA-105] Expected revision mismatch
- **WHEN** a patch is submitted with stale `expected_revision`
- **THEN** apply fails with revision conflict
- **AND** no state mutation is committed

### Requirement: Dry-Run Patch Validation
The system SHALL provide dry-run patch validation that parses patch JSON, resolves targets, and validates post-patch checklist state without committing changes. Successful validation SHALL return a short-lived `validation_id` bound to the validated patch hash, checklist, and expected revision.

#### Scenario: [OA-106] Dry-run returns resolved plan without mutation
- **WHEN** a valid patch is submitted to validation
- **THEN** the response includes resolved operations, resulting-state validity, and `validation_id`
- **AND** checklist revision remains unchanged

### Requirement: Apply Requires Prior Successful Validation
The system SHALL require apply requests to include a valid, unexpired `validation_id` from a successful validation run for the same patch payload and checklist revision.

#### Scenario: [OA-107] Apply without validation_id is rejected
- **WHEN** an apply request omits `validation_id`
- **THEN** apply fails with a validation-required error
- **AND** no checklist state mutation is committed

#### Scenario: [OA-108] Apply with mismatched validation artifact is rejected
- **WHEN** an apply request includes a `validation_id` that does not match the submitted patch payload hash or expected revision
- **THEN** apply fails with a validation mismatch error
- **AND** no checklist state mutation is committed

### Requirement: Strict Target Resolution Without Guessing
Patch operations that require existing targets (for example replace/remove) SHALL fail when target paths or IDs do not resolve exactly.

#### Scenario: [OA-109] Unknown target path is rejected
- **WHEN** a replace operation references a non-existent issue ID path
- **THEN** validation fails with a structured target-resolution error

### Requirement: Patch-Level Idempotency
The system SHALL enforce patch-level idempotency using `patch_id`.

#### Scenario: [OA-110] Replay same patch_id does not duplicate effects
- **WHEN** the same patch payload is applied again with the same `patch_id`
- **THEN** the system returns an idempotent replay response
- **AND** checklist revision does not increment a second time

#### Scenario: [OA-111] Reused patch_id with different payload is rejected
- **WHEN** a patch is submitted with a previously used `patch_id` but different operations
- **THEN** apply fails with a patch-id conflict error

### Requirement: Flexible Evidence Citations in Patch Updates
Checklist updates SHALL support citations with required raw evidence text and optional link/filepath.

#### Scenario: [OA-112] Citation with text only
- **WHEN** a patch adds a citation containing only `text`
- **THEN** validation succeeds

#### Scenario: [OA-113] Citation with link and filepath
- **WHEN** a patch adds a citation containing `text`, `link`, and `filepath`
- **THEN** validation succeeds

### Requirement: Optional Proposed Patch Mode
Patch envelopes SHALL support optional `mode` with `APPLY` and `PROPOSED` values. `PROPOSED` mode SHALL not require approval workflow in v1.

#### Scenario: [OA-114] Proposed patch is stored but not applied
- **WHEN** a valid patch is submitted with `mode: PROPOSED`
- **THEN** the system stores the proposal and validation output
- **AND** checklist state revision remains unchanged
