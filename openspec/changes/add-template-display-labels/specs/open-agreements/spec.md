## ADDED Requirements

### Requirement: Template Field Display Labels

Each template `metadata.yaml` field SHALL support an optional
`display_label` (string) that carries a human-friendly label for the
field. The canonical `name` SHALL remain the stable identifier used for
filling and automation; `display_label` is purely a discovery /
presentation hint and never replaces `name`.

The CLI `list --json` output SHALL project `display_label` onto each
field entry only when the metadata declares one. When the metadata does
NOT declare a label, the JSON field object SHALL omit the
`display_label` key entirely (no `null`, no empty string, no
auto-derived value). Consumers (UIs, agents, the docs site) that need a
human label when the key is absent SHOULD fall back to a title-cased
rendering of the canonical `name` (replacing `_` with spaces).

The CLI projection SHALL recurse into nested array `items` so that
sub-field labels are surfaced under the same omit-when-absent rule. The
committed `data/templates-snapshot.json` SHALL be regenerated from the
CLI JSON output so the snapshot carries the same contract.

As an authoring guideline, template authors SHOULD NOT add a
`display_label` to fields whose `description` declares them "AI-only"
or "Internal computed" (i.e. fields not intended to render in
human-facing UIs or in the output document). Curating a human label on
those fields invites consumers to surface them, which the description
already discourages. This is guidance only — the CLI does not enforce
it, and absence-of-label on a user-facing field continues to mean
"uncurated, fall back to title-case," not "unsafe to surface."

The contract-templates MCP package SHALL keep type alignment with the
new field on its local `TemplateField` interface, but the MCP runtime
SHALL strip `display_label` from `list_templates` and `get_template`
tool payloads (including nested `items`) so MCP responses are unchanged
in this requirement. Surfacing `display_label` to LLM agents is out of
scope and will be handled by a follow-up change.

#### Scenario: [OA-TMP-040] Field with display_label parses

- **GIVEN** a template `metadata.yaml` with a field
  `{ name: company_name, type: string, description: "…", display_label: "Company Name" }`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes
- **AND** the parsed `FieldDefinition` exposes `display_label: "Company Name"`

#### Scenario: [OA-TMP-041] Field without display_label parses

- **GIVEN** a template `metadata.yaml` with a field that does not declare `display_label`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes
- **AND** the parsed `FieldDefinition` has `display_label === undefined`

#### Scenario: [OA-TMP-042] list --json omits display_label key when absent

- **GIVEN** a template metadata fixture with two fields where only the first declares `display_label`
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the first field's JSON object includes `display_label`
- **AND** the second field's JSON object does NOT contain a `display_label`
  property at all (verified via a hasOwnProperty-style assertion, not just `=== null`)

#### Scenario: [OA-TMP-043] list --json projects display_label through nested items

- **GIVEN** an array-typed field whose `items` declares `display_label` on
  one sub-field and not on another
- **WHEN** the user runs `open-agreements list --json`
- **THEN** the labeled sub-field's JSON object includes `display_label`
- **AND** the unlabeled sub-field's JSON object does NOT contain a `display_label` property

#### Scenario: [OA-TMP-044] AI-only and internal fields do not carry display_label

- **GIVEN** a template `metadata.yaml` whose `description` for a field
  declares it "AI-only" or "Internal computed"
- **WHEN** a contributor authors that field
- **THEN** by the authoring guideline, the field SHOULD NOT include a
  `display_label`
- **AND** the discovery contract is unchanged for absent labels:
  consumers fall back to title-casing the canonical `name`

#### Scenario: [OA-TMP-045] MCP tool payloads strip display_label

- **GIVEN** a template whose metadata declares `display_label` on one or
  more fields (top-level or nested `items`)
- **WHEN** an MCP client calls `list_templates` or `get_template`
- **THEN** the returned tool payload SHALL NOT include a `display_label`
  property on any field, at any depth
- **AND** the type-only `TemplateField.display_label?` mirror in the
  contract-templates MCP package remains for forward compatibility but
  is not populated on the wire
