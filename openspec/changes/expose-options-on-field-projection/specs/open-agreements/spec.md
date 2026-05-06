## RENAMED Requirements
- FROM: `### Requirement: MCP Template Discovery Preserves Array Item Schemas`
- TO: `### Requirement: MCP Template Discovery Preserves Field Metadata`

## MODIFIED Requirements

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

### Requirement: MCP Template Discovery Preserves Field Metadata
The MCP `get_template` tool SHALL surface field metadata details that agents
need to construct valid fill payloads. This includes nested array item schemas
for `{FOR}`-based templates and the `options` allowlist for `enum` and
`multiselect` fields so agents can pick or validate values without parsing
free-form descriptions or fetching `metadata.yaml` out of band.

#### Scenario: [OA-DST-033] get_template returns array item schemas
- **GIVEN** a template with an array field that declares nested `items`
- **WHEN** a client calls `get_template`
- **THEN** the returned field metadata includes the nested array item schema unchanged

#### Scenario: [OA-DST-054] get_template returns options for enum and multiselect fields
- **GIVEN** a template with an `enum` or `multiselect` field declaring an `options` array
- **WHEN** a client calls `get_template`
- **THEN** the returned field metadata includes the `options` array with the same values as the source metadata

#### Scenario: [OA-DST-055] get_template omits options for non-enum/non-multiselect fields
- **GIVEN** a template with `string`, `date`, `number`, `boolean`, or `array` fields
- **WHEN** a client calls `get_template`
- **THEN** none of those fields include an `options` key in the returned metadata
