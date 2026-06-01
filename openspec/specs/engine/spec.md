# engine Specification

## Purpose
Defines the engine capability after restructuring the legacy open-agreements monolith.

## Requirements
### Requirement: Template Engine Sandboxing
The template engine MUST run template expressions in a sandboxed execution
context (Node.js VM) by default. The `noSandbox` option MUST NOT be set to
`true` in production code. This protects against arbitrary code execution
from contributed templates.

#### Scenario: [OA-ENG-001] Sandbox enabled by default
- **WHEN** `fillTemplate()` is called with any template
- **THEN** docx-templates runs with sandboxing enabled (default behavior)
- **AND** simple `{field_name}` substitution works correctly

#### Scenario: [OA-ENG-002] Malicious template expression blocked
- **WHEN** a template contains `{require('fs').readFileSync('/etc/passwd')}`
- **THEN** the sandbox prevents access to `require` and the expression fails
- **AND** no file system access occurs

### Requirement: DOCX Text Extraction
Text extraction from DOCX files MUST unzip the archive and parse
`word/document.xml` using a proper XML parser or regex on extracted XML.
Raw ZIP binary buffers MUST NOT be scanned directly for XML patterns.
Text from `<w:t>` elements MUST be concatenated per-paragraph to avoid
false matches across element boundaries.

#### Scenario: [OA-ENG-003] Output heading validation
- **WHEN** `validateOutput()` compares source and output DOCX heading counts
- **THEN** it extracts `word/document.xml` via AdmZip before scanning
- **AND** counts heading styles from the extracted XML (not raw ZIP bytes)

#### Scenario: [OA-ENG-004] Template placeholder extraction
- **WHEN** `extractDocxText()` reads a DOCX for placeholder discovery
- **THEN** `<w:t>` content is concatenated within each `<w:p>` paragraph
- **AND** paragraphs are separated to prevent cross-boundary false matches

### Requirement: Fill Value Validation
The `fillTemplate()` function MUST warn when provided values contain keys
that do not match any field name in the template metadata. This catches
typos in CLI flags or data files.

#### Scenario: [OA-FIL-001] Unknown key in fill values
- **WHEN** fill is called with `{ party_1_nme: "Acme" }` (typo)
- **AND** metadata has no field named `party_1_nme`
- **THEN** a warning is emitted listing the unknown key(s)
- **AND** fill proceeds (warning, not error)

### Requirement: DOCX Template Rendering
The system SHALL accept a template name, load the corresponding DOCX template, substitute `{tag}` placeholders with provided values, and produce a filled DOCX file preserving all original formatting.

#### Scenario: [OA-TMP-005] Successful template fill
- **GIVEN** a template named `common-paper-mutual-nda` exists with placeholders `{company_name}` and `{effective_date}`
- **WHEN** the user invokes `fill common-paper-mutual-nda` with values `company_name=Acme Corp` and `effective_date=2026-03-01`
- **THEN** the system produces a DOCX file with all `{company_name}` placeholders replaced by "Acme Corp" and all `{effective_date}` placeholders replaced by "2026-03-01", preserving the original formatting (bold, italic, headings, tables)

#### Scenario: [OA-TMP-006] Missing required field
- **GIVEN** a template where `governing_law` appears in `priority_fields`
- **WHEN** the user invokes `fill` without providing `governing_law`
- **THEN** the system returns an error listing the missing required fields

### Requirement: Signature Block Fields
All Common Paper templates SHALL support per-party signatory fields with
entity/individual toggle. The engine auto-discovers `*_signatory_type` prefixes
(role-based) plus legacy `party_N_type` (mutual NDA). Title and company cells
use derived display fields that resolve to empty string for individuals,
respecting the one-IF-per-row constraint in docx-templates.

#### Scenario: [OA-NDA-001] Entity mode fills all signature fields
- **GIVEN** both parties have `party_N_type` set to `entity`
- **AND** all signatory fields (name, title, company, email) are provided
- **WHEN** the template is filled
- **THEN** all signatory values appear in the output
- **AND** no unrendered template tags remain

#### Scenario: [OA-NDA-002] Individual mode suppresses title and company
- **GIVEN** one party has `party_N_type` set to `individual`
- **AND** title and company values are provided for that party
- **WHEN** the template is filled
- **THEN** the individual party's title and company cells are blank
- **AND** entity-only sentinel values do not appear in output

#### Scenario: [OA-NDA-003] Warning emitted for conflicting individual fields
- **GIVEN** a party has `party_N_type` set to `individual`
- **AND** `party_N_title` is also set to a non-empty value
- **WHEN** display fields are computed
- **THEN** a console warning is emitted identifying the conflicting field

#### Scenario: [OA-NDA-004] Standard 2-party entity mode (pilot agreement)
- **GIVEN** the `common-paper-pilot-agreement` template with `provider_signatory_*` and `customer_signatory_*` fields
- **AND** both signatory types set to `entity` with all fields provided
- **WHEN** the template is filled
- **THEN** all signatory values appear in the output
- **AND** no unrendered template tags remain

#### Scenario: [OA-NDA-005] Individual mode suppression (contractor agreement)
- **GIVEN** the `common-paper-independent-contractor-agreement` template
- **AND** `contractor_signatory_type` set to `individual`
- **WHEN** the template is filled
- **THEN** the contractor's title and company display cells are blank
- **AND** name and email still render

#### Scenario: [OA-NDA-006] One-way NDA single party
- **GIVEN** the `common-paper-one-way-nda` template with `recipient_signatory_*` fields
- **AND** all signatory fields provided in entity mode
- **WHEN** the template is filled
- **THEN** all signatory values render including company display
- **AND** no unrendered template tags remain

#### Scenario: [OA-NDA-007] Dual sig block (CSA)
- **GIVEN** the `common-paper-cloud-service-agreement` with two signature tables
- **AND** provider and customer signatory fields provided
- **WHEN** the template is filled
- **THEN** both signature tables are filled from the same fields
- **AND** no unrendered template tags remain

#### Scenario: [OA-NDA-008] Parametric smoke test (all templates)
- **GIVEN** each of the 19 Common Paper templates with signatory fields
- **AND** sample entity-mode data provided for all signatory fields
- **WHEN** the template is filled
- **THEN** no unrendered `{field}` tags remain in the output
- **AND** individual-mode fill also produces clean output

### Requirement: External Template Support
The system SHALL support external templates. External templates are vendored
unchanged under `external/` with `metadata.yaml`. The `fill` command fills them
the same way as internal templates; license-specific redistribution,
integrity, and notice rules are owned by the ip-license capability.

#### Scenario: [OA-TMP-012] External template fill
- **GIVEN** an external template `yc-safe-valuation-cap` with `license: CC-BY-ND-4.0` and `allow_derivatives: false`
- **WHEN** the user invokes `fill yc-safe-valuation-cap` with valid field values
- **THEN** the system fills the template and produces a DOCX using the same fill mechanics as internal templates

#### Scenario: [OA-TMP-013] External metadata requires source_sha256
- **GIVEN** an external template directory with `metadata.yaml` missing `source_sha256`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: [OA-TMP-014] External template appears in list output
- **GIVEN** external templates exist under `external/`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** external templates appear in the output with `license: CC-BY-ND-4.0` and `source` indicating the originating organization

### Requirement: Output Validation
The system SHALL verify that rendered DOCX output preserves the section count and heading structure of the source template.

#### Scenario: [OA-RCP-019] Output structure matches source
- **GIVEN** a source template with 5 sections and 12 headings
- **WHEN** the system renders a filled DOCX
- **THEN** the output DOCX contains exactly 5 sections and 12 headings matching the source structure

#### Scenario: [OA-RCP-020] Structural drift detected
- **GIVEN** a rendered DOCX where a heading was accidentally removed during substitution
- **WHEN** the system validates the output
- **THEN** validation fails with an error indicating the structural mismatch (expected vs actual heading count)

### Requirement: Recipe Computed Interaction Profiles
The system SHALL support an optional `computed.json` profile in a recipe directory to define deterministic, declarative interaction rules that derive computed values from input values.

#### Scenario: [OA-RCP-021] Computed profile is optional and non-breaking
- **WHEN** a recipe does not include `computed.json`
- **THEN** `recipe run` behavior remains unchanged from the existing clean-patch-fill-verify pipeline

#### Scenario: [OA-RCP-022] Rule-driven derived values are computed deterministically
- **WHEN** a recipe includes `computed.json` with ordered interaction rules
- **THEN** rules are evaluated in deterministic order across bounded passes
- **AND** derived values are merged into the fill context prior to rendering

### Requirement: Computed Artifact Export
The `recipe run` command SHALL support exporting a machine-readable computed artifact that captures input values, derived values, and rule evaluation trace.

#### Scenario: [OA-RCP-023] Computed artifact file is written on request
- **WHEN** the user runs `open-agreements recipe run <id> --computed-out computed.json`
- **THEN** the command writes a JSON artifact containing recipe id, timestamp, inputs, derived values, and pass/rule trace

#### Scenario: [OA-RCP-024] Artifact trace includes rule match outcomes and assignments
- **WHEN** rule evaluation runs for a recipe with a computed profile
- **THEN** each pass includes per-rule matched status
- **AND** each matched rule records assignment deltas applied to computed state

### Requirement: Computed Profile Validation
Recipe validation SHALL validate `computed.json` format when present and report errors for invalid predicate operators, malformed rules, or invalid assignment values.

#### Scenario: [OA-RCP-025] Invalid computed profile fails recipe validation
- **WHEN** `computed.json` contains an unsupported predicate operator
- **THEN** `validateRecipe` returns invalid with a descriptive computed-profile error

### Requirement: Currency Field Detection and Sanitization
The fill pipeline MUST detect dollar-prefixed template fields (`${field}`) across
all DOCX parts (body, headers, footers, endnotes) and strip leading `$` from
string fill values for those fields to prevent double-dollar output (`$$`).

#### Scenario: [OA-FIL-003] Currency field detection across DOCX parts
- **WHEN** a DOCX template contains `${field_name}` patterns in body, headers, footers, or endnotes
- **THEN** `detectCurrencyFields` identifies all such fields including split-run cases
- **AND** non-currency `{field}` patterns are not flagged

#### Scenario: [OA-FIL-004] Currency value sanitization strips leading dollar sign
- **WHEN** fill values include dollar-prefixed strings for detected currency fields
- **THEN** the leading `$` is stripped from those values only
- **AND** non-currency fields retain their original values including any `$` prefix
- **AND** non-string values (booleans) are passed through unchanged

### Requirement: Post-Fill Verification Checks
The verifier MUST detect double dollar signs (`$$`), dollar-space-dollar (`$ $`),
and unrendered template tags in the filled DOCX output across all parts including
headers and footers.

#### Scenario: [OA-FIL-005] Double dollar sign detection in filled output
- **WHEN** a filled DOCX contains `$$` or `$ $` patterns in body text
- **THEN** verification fails with details identifying the offending text
- **AND** legitimate single `$` amounts pass verification

#### Scenario: [OA-FIL-006] Verification passes for clean output
- **WHEN** a filled DOCX has no double-dollar, unrendered tags, or leftover placeholders
- **THEN** verification passes with all checks marked as passed

#### Scenario: [OA-FIL-007] Verification scans headers and footers
- **WHEN** an unrendered template tag exists in a header or footer part
- **THEN** verification detects the tag and reports failure

### Requirement: Fill Data Preparation
The `prepareFillData` function MUST apply default values for optional fields,
coerce boolean string values when configured, and warn on missing required fields.
The `computeDisplayFields` callback MUST be invoked when provided. Explicit
field-level defaults MUST override the template-path blank placeholder behavior.

#### Scenario: [OA-FIL-008] Optional field defaulting and blank placeholder
- **WHEN** optional fields are not provided in fill values
- **THEN** they default to empty string (useBlankPlaceholder=false) or BLANK_PLACEHOLDER (useBlankPlaceholder=true)
- **AND** user-provided values override defaults
- **AND** field-level defaults from metadata are respected

#### Scenario: [OA-FIL-009] Boolean coercion and required field warnings
- **WHEN** boolean coercion is configured and string boolean values are provided
- **THEN** string "true"/"false" values for boolean fields are coerced to native booleans when enabled
- **AND** string values pass through unchanged when coercion is disabled
- **AND** missing required fields emit a warning
- **AND** computeDisplayFields callback is invoked when provided

#### Scenario: [OA-FIL-023] Explicit empty-string defaults support conditional block pruning
- **WHEN** an optional signer-slot anchor field declares `default: ""`
- **AND** the template wraps that signer block in `{IF field}` / `{END-IF}`
- **AND** the field is omitted from fill values
- **THEN** `prepareFillData` preserves the explicit empty-string default
- **AND** the signer block is removed cleanly during DOCX rendering

### Requirement: Multiselect Derived Boolean Fill Behavior

When a field has `type: multiselect`, the fill pipeline SHALL normalize
its runtime value to a real array of strings before priority-field checks,
boolean coercion, or template-specific display-field computation. The
pipeline SHALL accept either an array value or a JSON-string value and
SHALL throw a clear error when the provided JSON is malformed or does not
decode to an array.

The fill pipeline SHALL reject runtime multiselect input that contains
non-string entries or values not present in the declared `options`
allowlist. The closed allowlist applies symmetrically to schema-validated
defaults and to runtime input.

When a multiselect field also sets `derive_booleans: true`, the fill
pipeline SHALL emit `<option>_enabled` boolean keys for every declared
option based on membership in the normalized selection array. These
derived booleans SHALL be available to later fill-pipeline steps, but the
synthetic keys SHALL NOT be reported in `fieldsUsed`; that output remains
limited to user-facing inputs.

Templates SHALL NOT reference a multiselect field directly in
`{IF <field>}` because empty arrays are truthy in the template runtime.
Validation SHALL reject such direct conditional references. A multiselect
field with `derive_booleans: true` MAY be absent from raw DOCX placeholder
coverage ONLY when at least one derived `<option>_enabled` key for that
field is actually referenced in the template. A `derive_booleans`
multiselect whose field name is absent AND whose derived keys are all
absent SHALL still trigger the standard missing-placeholder warning (or
error if priority-listed), because the field is genuinely unused.

#### Scenario: [OA-FIL-025] Multiselect selections derive booleans before display-field computation

- **GIVEN** fill input `{ industry_modules: ["tech_rider", "cross_border_rider"] }`
- **AND** metadata declares `industry_modules` as a multiselect with
  `derive_booleans: true`
- **WHEN** the fill pipeline prepares the data
- **THEN** the normalized `industry_modules` value is an array
- **AND** `tech_rider_enabled === true`
- **AND** `cross_border_rider_enabled === true`
- **AND** unselected options derive to `false`
- **AND** later display-field computation can read those booleans

#### Scenario: [OA-FIL-026] Malformed multiselect JSON input is rejected

- **GIVEN** fill input where a multiselect field is provided as malformed
  JSON text
- **WHEN** the fill pipeline prepares the data
- **THEN** it throws a clear error identifying the multiselect field

#### Scenario: [OA-FIL-027] fieldsUsed excludes synthetic derived keys

- **GIVEN** a fill run with a multiselect field that derives booleans
- **WHEN** the unified fill pipeline returns its result
- **THEN** `fieldsUsed` contains the multiselect field name
- **AND** `fieldsUsed` does NOT contain any derived `<option>_enabled`
  keys

#### Scenario: [OA-TMP-052] Validator rejects direct multiselect IF references

- **GIVEN** template metadata with a multiselect field named
  `industry_modules`
- **WHEN** the template contains `{IF industry_modules}`
- **THEN** validation fails with an error telling the author not to
  reference a multiselect directly in `{IF ...}`
- **AND** a template that uses only derived `{IF tech_rider_enabled}`
  conditionals does not receive a missing-placeholder warning for
  `industry_modules`

#### Scenario: [OA-TMP-053] Coverage suppression requires at least one derived key reference

- **GIVEN** template metadata with a `derive_booleans: true` multiselect
  field that is also priority-listed
- **AND** a template that references neither the field name nor any of
  its derived `<option>_enabled` keys
- **WHEN** the validator runs
- **THEN** the validator emits the priority-field error (or warning if
  optional) for the multiselect field — coverage suppression does NOT
  fire when the field is genuinely unused

#### Scenario: [OA-FIL-028] Multiselect runtime input enforces the closed allowlist

- **GIVEN** a multiselect field with `options: [tech_rider, cross_border_rider]`
- **WHEN** fill input contains a non-string entry or an option name not
  in the allowlist
- **THEN** the fill pipeline throws a clear error identifying the
  multiselect field and the offending entry

### Requirement: Fill Pipeline DOCX Rendering
The `fillDocx` function MUST support smart quote normalization, multiline values
as explicit line-break runs, paragraph stripping with table-row cleanup,
and highlight removal from filled fields.

#### Scenario: [OA-FIL-010] Smart quote normalization during fill
- **WHEN** a template DOCX contains smart/curly quotes around tag names
- **AND** `fixSmartQuotes` is enabled
- **THEN** `fillDocx` normalizes quotes and successfully fills the tags

#### Scenario: [OA-FIL-011] Multiline value rendering with line breaks
- **WHEN** a fill value contains newline characters
- **THEN** `fillDocx` renders each line with explicit `<w:br/>` elements between sibling runs

#### Scenario: [OA-FIL-012] Paragraph stripping with table-row cleanup
- **WHEN** `stripParagraphPatterns` is configured (or defaults are used)
- **THEN** matching paragraphs are removed from the output
- **AND** table rows where all cell paragraphs are stripped are also removed
- **AND** table rows with any non-stripped content are preserved
- **AND** when patterns are empty, all paragraphs are preserved

#### Scenario: [OA-FIL-013] Highlight stripping from filled fields
- **WHEN** template runs contain highlight formatting on `{field}` placeholders
- **THEN** highlighting is removed from runs where the field was filled with a value

### Requirement: Fill Pipeline Behavioral Consistency
Template and recipe/external fill paths MUST maintain consistent behavior
for optional field defaulting while allowing path-specific boolean coercion.

#### Scenario: [OA-FIL-014] Path-specific fill behavior consistency
- **WHEN** template path fills with blank placeholders, boolean coercion, and required field warnings
- **AND** recipe/external path fills without boolean coercion
- **THEN** both paths default optional fields to BLANK_PLACEHOLDER consistently

#### Scenario: [OA-FIL-015] Currency sanitization prevents double-dollar in filled output
- **WHEN** a template contains `${field}` and fill value is `$50,000`
- **THEN** the filled output contains `$50,000` (not `$$50,000`)

### Requirement: Loop-Based Array Rendering
The template fill path SHALL support `docx-templates` `{FOR}` loops over array
fields, including arrays of objects described by template metadata item schemas.

#### Scenario: [OA-FIL-024] Array-driven signer blocks render exact counts
- **GIVEN** a template with a `signers` array field and a `{FOR signer IN signers}` signature-block loop
- **WHEN** the template is filled with 1, 3, or 7 signer objects
- **THEN** the rendered DOCX contains exactly 1, 3, or 7 signature blocks respectively
- **AND** no loop markers remain in the output
- **AND** no dangling blank placeholders appear outside the rendered signer blocks

### Requirement: JSON Template Renderer
The JSON template renderer MUST support multiple templates sharing layout IDs,
reject unknown layouts, detect style mismatches, and validate spacing tokens.

#### Scenario: [OA-TMP-017] JSON template renderer validation
- **WHEN** templates reference layout IDs
- **THEN** multiple templates sharing the same layout ID are supported
- **AND** unknown layout IDs are rejected with actionable errors
- **AND** style mismatches between spec and profile are rejected
- **AND** invalid spacing token types are caught before rendering
