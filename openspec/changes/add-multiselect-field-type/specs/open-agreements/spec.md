## MODIFIED Requirements

### Requirement: Metadata Schema Constraints

The metadata schema MUST enforce type-specific constraints on field
definitions. Fields with `type: enum` or `type: multiselect` MUST have a
non-empty `options` array. Fields with a `default` value MUST have that
default validate against the declared `type`.

For `type: multiselect`, every option SHALL be unique and SHALL match the
identifier pattern `^[A-Za-z_][A-Za-z0-9_]*$`. `derive_booleans` SHALL be
allowed only when `type === "multiselect"`. When a multiselect field
declares a `default`, the value SHALL be a JSON-encoded array of unique
strings, and every entry SHALL appear in `options`.

When a multiselect field sets `derive_booleans: true`, metadata validation
SHALL reject any collision between a derived `<option>_enabled` key and
another top-level field name, and SHALL also reject collisions between
derived keys emitted by multiple multiselect fields. These collision rules
apply to template, external-template, and recipe metadata.

#### Scenario: [OA-TMP-049] Valid multiselect metadata parses

- **GIVEN** metadata with a field
  `{ name: industry_modules, type: multiselect, options: [tech_rider, cross_border_rider], default: "[\"tech_rider\"]" }`
- **WHEN** the system loads and validates the metadata
- **THEN** validation passes
- **AND** the parsed field preserves the declared options and default

#### Scenario: [OA-TMP-050] Invalid multiselect metadata is rejected

- **GIVEN** metadata with a multiselect field that omits `options`,
  declares an invalid option identifier, or sets a default outside the
  allowlist
- **WHEN** the system validates the metadata
- **THEN** validation fails with a descriptive schema error

#### Scenario: [OA-TMP-051] Derived boolean collisions are rejected

- **GIVEN** metadata with `derive_booleans: true` on a multiselect field
- **AND** a derived key such as `tech_rider_enabled` would collide with
  another top-level field or another multiselect's derived key
- **WHEN** the system validates the metadata
- **THEN** validation fails before the template can be filled

## ADDED Requirements

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
