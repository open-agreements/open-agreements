## ADDED Requirements

### Requirement: Template Engine Sandboxing
The template engine MUST run template expressions in a sandboxed execution
context (Node.js VM) by default. The `noSandbox` option MUST NOT be set to
`true` in production code. This protects against arbitrary code execution
from contributed templates.

#### Scenario: Sandbox enabled by default
- **WHEN** `fillTemplate()` is called with any template
- **THEN** docx-templates runs with sandboxing enabled (default behavior)
- **AND** simple `{field_name}` substitution works correctly

#### Scenario: Malicious template expression blocked
- **WHEN** a template contains `{require('fs').readFileSync('/etc/passwd')}`
- **THEN** the sandbox prevents access to `require` and the expression fails
- **AND** no file system access occurs

### Requirement: Template Validation Severity
The template validator MUST produce errors (not warnings) when a required
metadata field has no corresponding `{tag}` placeholder in the template DOCX.
Optional fields missing from the DOCX MUST produce warnings. The `valid` field
MUST be `false` when any required field is missing.

#### Scenario: Required field missing from DOCX
- **WHEN** metadata defines field `party_1_name` as `required: true`
- **AND** no `{party_1_name}` placeholder exists in template.docx
- **THEN** validation produces an error (not a warning)
- **AND** `valid` is `false`

#### Scenario: Optional field missing from DOCX
- **WHEN** metadata defines field `governing_law` as `required: false`
- **AND** no `{governing_law}` placeholder exists in template.docx
- **THEN** validation produces a warning
- **AND** `valid` remains `true`

### Requirement: DOCX Text Extraction
Text extraction from DOCX files MUST unzip the archive and parse
`word/document.xml` using a proper XML parser or regex on extracted XML.
Raw ZIP binary buffers MUST NOT be scanned directly for XML patterns.
Text from `<w:t>` elements MUST be concatenated per-paragraph to avoid
false matches across element boundaries.

#### Scenario: Output heading validation
- **WHEN** `validateOutput()` compares source and output DOCX heading counts
- **THEN** it extracts `word/document.xml` via AdmZip before scanning
- **AND** counts heading styles from the extracted XML (not raw ZIP bytes)

#### Scenario: Template placeholder extraction
- **WHEN** `extractDocxText()` reads a DOCX for placeholder discovery
- **THEN** `<w:t>` content is concatenated within each `<w:p>` paragraph
- **AND** paragraphs are separated to prevent cross-boundary false matches

### Requirement: Metadata Schema Constraints
The metadata schema MUST enforce type-specific constraints on field definitions.
Fields with `type: enum` MUST have a non-empty `options` array. Fields with a
`default` value MUST have that default validate against the declared `type`.

#### Scenario: Enum field without options
- **WHEN** metadata defines a field with `type: enum` and no `options` array
- **THEN** schema validation fails with a descriptive error

#### Scenario: Default value type mismatch
- **WHEN** metadata defines a field with `type: number` and `default: "abc"`
- **THEN** schema validation fails with a descriptive error

### Requirement: Fill Value Validation
The `fillTemplate()` function MUST warn when provided values contain keys
that do not match any field name in the template metadata. This catches
typos in CLI flags or data files.

#### Scenario: Unknown key in fill values
- **WHEN** fill is called with `{ party_1_nme: "Acme" }` (typo)
- **AND** metadata has no field named `party_1_nme`
- **THEN** a warning is emitted listing the unknown key(s)
- **AND** fill proceeds (warning, not error)

### Requirement: CI License Compliance
The CI license compliance check MUST diff against the PR base SHA for
pull request events. It MUST NOT use `HEAD~1` for PRs, as this only
checks the most recent commit and misses earlier commits in multi-commit PRs.

#### Scenario: Multi-commit PR license check
- **WHEN** a PR has 3 commits and the first modifies a non-derivative template
- **THEN** the CI check detects the modification by diffing against the PR base
- **AND** the check fails appropriately

#### Scenario: Push to main license check
- **WHEN** a commit is pushed directly to main
- **THEN** the CI check diffs against `HEAD~1` (single-commit context)

### Requirement: Recipe Pipeline
The recipe engine MUST support a multi-stage pipeline that transforms a
source DOCX into a filled agreement: download (or accept user-supplied input)
then clean then patch then fill then verify. Each stage MUST read from a file
path and write to a file path. Intermediate files MUST be written to a temp
directory and cleaned up after completion unless `--keep-intermediate` is set.

#### Scenario: Full pipeline with auto-download
- **WHEN** `recipe run nvca-voting-agreement --data values.json -o output.docx`
- **THEN** the engine downloads the source DOCX from `source_url` in metadata
- **AND** runs clean, patch, fill, verify stages in sequence
- **AND** writes the final filled DOCX to `output.docx`

#### Scenario: Full pipeline with user-supplied input
- **WHEN** `recipe run nvca-voting-agreement --input local.docx --data values.json -o output.docx`
- **THEN** the engine uses `local.docx` instead of downloading
- **AND** runs the same clean, patch, fill, verify pipeline

#### Scenario: Keep intermediate files
- **WHEN** `--keep-intermediate` is set
- **THEN** cleaned, patched, and filled intermediate files are preserved in temp dir
- **AND** the temp dir path is reported to the user

### Requirement: Recipe CLI Subcommands
The CLI MUST provide subcommands for running the full recipe pipeline and
for running individual stages independently. Individual stages support
recipe authoring and debugging.

#### Scenario: Run full pipeline
- **WHEN** `open-agreements recipe run <recipe-id> --data <json> -o <output>`
- **THEN** the full download-clean-patch-fill-verify pipeline executes

#### Scenario: Run clean stage only
- **WHEN** `open-agreements recipe clean <input> -o <output> --recipe <id>`
- **THEN** only the clean stage runs, using the recipe's `clean.json` config

#### Scenario: Run patch stage only
- **WHEN** `open-agreements recipe patch <input> -o <output> --recipe <id>`
- **THEN** only the patch stage runs, using the recipe's `replacements.json`

### Requirement: DOCX Cleaner
The cleaner stage MUST remove footnotes and pattern-matched paragraphs from
a DOCX file based on a declarative `clean.json` configuration. Cleaning
operates at the OOXML level to preserve formatting of retained content.

#### Scenario: Remove footnotes
- **WHEN** `clean.json` has `removeFootnotes: true`
- **THEN** all `<w:footnoteReference>` runs are removed from `word/document.xml`
- **AND** all normal footnotes are removed from `word/footnotes.xml`
- **AND** separator and continuationSeparator footnotes are preserved

#### Scenario: Remove paragraph patterns
- **WHEN** `clean.json` has `removeParagraphPatterns: ["^Note to Drafter:"]`
- **THEN** paragraphs whose text matches the regex are removed from the document

### Requirement: Cross-Run Patcher
The patcher stage MUST replace bracketed placeholders with template tags
across Word XML run boundaries. It MUST use a char_map algorithm that maps
each character in the concatenated paragraph text to its source run and offset.
Replacement keys MUST be sorted longest-first to prevent partial matches.

#### Scenario: Single-run replacement
- **WHEN** `[Company Name]` exists entirely within one `<w:r>` element
- **THEN** the text is replaced in-place within that run
- **AND** run formatting (bold, italic, etc.) is preserved

#### Scenario: Cross-run replacement
- **WHEN** `[Company Name]` spans two runs (`[Company` in run 1, ` Name]` in run 2)
- **THEN** the replacement text is placed in the first run
- **AND** consumed text is removed from subsequent runs
- **AND** formatting of the first run is preserved

#### Scenario: Smart quote handling
- **WHEN** the source DOCX uses smart/curly quotes (U+201C, U+201D, U+2019)
- **THEN** the replacement map includes both smart and straight quote variants
- **AND** both variants are matched and replaced correctly

#### Scenario: Table cell processing
- **WHEN** placeholders appear in table cells (e.g., signature blocks)
- **THEN** the patcher processes paragraphs within table cells

### Requirement: Post-Fill Verifier
After filling, the verifier MUST check the output DOCX to confirm that all
context values appear in the document text, no unrendered template tags remain,
and no leftover source placeholders remain.

#### Scenario: All values present
- **WHEN** fill values include `company_name: "Acme Corp"`
- **THEN** the verifier confirms "Acme Corp" appears in the output text

#### Scenario: Unrendered tags detected
- **WHEN** a `{template_tag}` remains in the output (unfilled)
- **THEN** the verifier reports it as a failure

#### Scenario: Leftover brackets detected
- **WHEN** a `[bracketed placeholder]` from the replacement map remains
- **THEN** the verifier reports it as a failure

### Requirement: Scan Command
The `scan` command MUST analyze a user-supplied DOCX and report all bracketed
placeholders, classifying them as short (fill-in fields, <=80 chars) or long
(alternative clauses). It MUST detect split-run placeholders and count footnotes.
It MUST optionally output a draft `replacements.json` to bootstrap recipe authoring.

#### Scenario: Placeholder discovery
- **WHEN** `open-agreements scan input.docx`
- **THEN** all `[bracketed]` content is extracted and classified by length
- **AND** split-run placeholders are identified
- **AND** footnote count is reported

#### Scenario: Draft replacements output
- **WHEN** `open-agreements scan input.docx --output-replacements replacements.json`
- **THEN** a draft `replacements.json` is written with auto-generated tag names
- **AND** the author can refine the generated map

### Requirement: Recipe Metadata Schema
Recipe metadata MUST be defined in `metadata.yaml` and validate against a Zod
schema. Required fields: `name`, `source_url` (valid URL), `source_version`,
`license_note`, `fields` (array of field definitions, reusing template field
schema). Optional fields: `description`, `optional` (boolean, default false).

#### Scenario: Valid recipe metadata
- **WHEN** a recipe has `metadata.yaml` with all required fields
- **THEN** schema validation passes

#### Scenario: Missing source_url
- **WHEN** a recipe metadata omits `source_url`
- **THEN** schema validation fails with a descriptive error

### Requirement: Recipe Directory Validation
Recipe validation MUST enforce: no `.docx` files in the recipe directory
(copyrighted content must not be committed), `replacements.json` exists and
contains string-to-string entries, `schema.json` field names cover all
replacement targets, `metadata.yaml` validates against the schema, and
`clean.json` validates against the clean config schema. Scaffold recipes
(metadata.yaml only) MUST pass validation without requiring other files.

#### Scenario: DOCX file detected in recipe directory
- **WHEN** a `.docx` file exists in `recipes/nvca-voting-agreement/`
- **THEN** validation fails with an error about copyrighted content

#### Scenario: Scaffold recipe validation
- **WHEN** a recipe directory contains only `metadata.yaml`
- **AND** metadata is valid
- **THEN** validation passes (scaffold recipes are allowed)

#### Scenario: Replacement target not covered by schema
- **WHEN** `replacements.json` maps `[Tag]` to `{field_x}`
- **AND** `schema.json` does not define `field_x`
- **THEN** validation warns about the uncovered replacement target
