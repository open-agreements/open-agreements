## MODIFIED Requirements

### Requirement: Template Metadata Schema
Each template directory SHALL contain a `metadata.yaml` validated by Zod schema with fields: `name`, `source_url`, `version`, `license` (enum: CC-BY-4.0, CC0-1.0), `allow_derivatives` (boolean), `attribution_text`, and `fields` (array of field definitions with `name`, `type`, `description`, and optional field metadata such as defaults, sections, enum options, and nested `items` definitions for array fields).

#### Scenario: [OA-TMP-022] Array field item schemas pass validation
- **GIVEN** a template metadata file with an array field that declares nested `items` field definitions
- **WHEN** the metadata is validated
- **THEN** validation accepts the array field schema
- **AND** nested item field definitions use the same field-definition rules as top-level fields

### Requirement: Machine-Readable Template Discovery
The `list` command SHALL support a `--json` flag that outputs template metadata including all field definitions, enabling programmatic field discovery by agent skills. Output SHALL be sorted by name. Templates SHALL include `source_url` and `attribution_text`. Array fields with nested item schemas SHALL include those nested item definitions in discovery output.

#### Scenario: [OA-CLI-024] JSON output preserves array item schemas
- **GIVEN** a template with an array field that declares nested `items`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the matching template entry includes the array field
- **AND** the array field includes its nested item schema in the JSON output

### Requirement: Fill Data Preparation
The `prepareFillData` function MUST apply default values for optional fields, coerce boolean string values when configured, and warn on missing required fields. The `computeDisplayFields` callback MUST be invoked when provided. Explicit field-level defaults MUST override the template-path blank placeholder behavior.

#### Scenario: [OA-FIL-016] Explicit empty-string defaults support conditional block pruning
- **WHEN** an optional signer-slot anchor field declares `default: ""`
- **AND** the template wraps that signer block in `{IF field}` / `{END-IF}`
- **AND** the field is omitted from fill values
- **THEN** `prepareFillData` preserves the explicit empty-string default
- **AND** the signer block is removed cleanly during DOCX rendering

## ADDED Requirements

### Requirement: Loop-Based Array Rendering
The template fill path SHALL support `docx-templates` `{FOR}` loops over array fields, including arrays of objects described by template metadata item schemas.

#### Scenario: [OA-FIL-017] Array-driven signer blocks render exact counts
- **GIVEN** a template with a `signers` array field and a `{FOR signer IN signers}` signature-block loop
- **WHEN** the template is filled with 1, 3, or 7 signer objects
- **THEN** the rendered DOCX contains exactly 1, 3, or 7 signature blocks respectively
- **AND** no loop markers remain in the output
- **AND** no dangling blank placeholders appear outside the rendered signer blocks

### Requirement: MCP Template Discovery Preserves Array Item Schemas
The MCP `get_template` tool SHALL surface nested array item schemas so clients can construct valid object-array payloads for `{FOR}`-based templates.

#### Scenario: [OA-DST-034] get_template returns array item schemas
- **GIVEN** a template with an array field that declares nested `items`
- **WHEN** a client calls `get_template`
- **THEN** the returned field metadata includes the nested array item schema unchanged
