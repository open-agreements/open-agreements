## ADDED Requirements

### Requirement: Field Selector Manifest
A recipe MAY declare one or more fields as selector contracts under `content/recipes/<id>/fields/<field_id>.json`. Each `FieldSelectorManifest` MUST carry `schema_version`, `field_id`, `field_label`, `description`, `source_template_version`, an ordered `occurrences` array of locators, `postconditions`, `failure_behavior`, and `fixtures`. The manifest MUST NOT carry an RFC-2119 `requirement` level — the legal level is owned by legal-explainer and joined via `field_id`. `field_id` MUST equal the field's name in the recipe `metadata.yaml`.

#### Scenario: [OA-SEL-001] Manifest schema validation
- **WHEN** a `fields/<field_id>.json` is loaded
- **THEN** it is validated against the `FieldSelectorManifest` Zod schema
- **AND** a manifest missing `field_id`, `occurrences`, or `failure_behavior` is rejected
- **AND** a manifest containing a `requirement` key is rejected

#### Scenario: [OA-SEL-002] field_id joins to metadata
- **WHEN** a manifest declares `field_id: company_name`
- **THEN** `company_name` MUST exist as a field name in the recipe `metadata.yaml`
- **AND** the same string is the cross-repo join key to legal-explainer `template_metadata_fields`

### Requirement: One Field To Many Occurrences
A field MUST be modeled as one `field_id` mapping to N occurrences, each an independent single-span locator. The field's value MUST be written to every resolved occurrence. A field is fully resolved only when every occurrence locator resolves; any unresolved occurrence is a drift signal.

#### Scenario: [OA-SEL-003] Heterogeneous placeholders fill from one field
- **WHEN** `company_name` declares three occurrence locators for `[Insert Company Name]`, `[Company name]`, and a scoped blank `[____________]`
- **THEN** the field value is written to all three occurrences
- **AND** each occurrence is resolved by its own locator (not a single global match)

#### Scenario: [OA-SEL-004] Unresolved occurrence is drift
- **WHEN** any one of a field's occurrence locators resolves to zero or more than one span
- **THEN** the field is reported unresolved
- **AND** the unresolved occurrence is surfaced as a drift signal

### Requirement: Template Manifest And Declarative Cutover
A recipe using selector contracts MUST carry `content/recipes/<id>/template-manifest.json` with `schema_version`, `template_id`, `template_version`, `source_sha256`, optional `part_hashes`, and `migrated_keys`. `migrated_keys` MUST be the explicit list of `replacements.json` keys now owned by the selector engine. The cutover MUST be driven by this explicit list, not inferred from which keys resolve to a manifest-covered tag.

#### Scenario: [OA-SEL-005] Declarative migrated_keys remove legacy keys
- **WHEN** `template-manifest.json.migrated_keys` lists the three `{company_name}` keys
- **THEN** those keys are removed from the dict passed to the legacy patcher
- **AND** non-listed keys still apply via the legacy patcher

#### Scenario: [OA-SEL-006] No inferred cutover
- **WHEN** multiple `replacements.json` keys resolve to the same `{tag}` as a migrated field
- **THEN** only the keys explicitly listed in `migrated_keys` are removed
- **AND** keys are never dropped by inferring "value resolves to a covered tag"

### Requirement: Verification Coverage Preserved After Migration
Removing `migrated_keys` from the legacy patcher input MUST NOT reduce post-fill verification coverage. The recipe verifier (`verifyOutput`) uses replacement keys to detect leftover source placeholders; the engine MUST hand the verifier the FULL replacement key set (including migrated keys), so a selector occurrence that fails to fill is still caught as a leftover source placeholder. Only the patcher receives the filtered dict.

#### Scenario: [OA-SEL-021] Verifier still catches a missed migrated occurrence
- **WHEN** a `company_name` occurrence is not filled (e.g. its source anchor `[Insert Company Name]` remains)
- **THEN** the verifier flags the leftover source placeholder
- **AND** verification fails even though that key was removed from the legacy patcher dict

### Requirement: Selector Postconditions
A `FieldSelectorManifest` MUST support postconditions evaluated after fill, surfaced as `VerifyCheck` entries. Phase 1 MUST support `no_unresolved_placeholder`, `all_occurrences_identical`, and `no_double_dollar`. `all_occurrences_identical` MUST range over the resolved occurrence set and assert identical rendered text.

#### Scenario: [OA-SEL-007] all_occurrences_identical passes
- **WHEN** every resolved occurrence of `company_name` renders the same value
- **THEN** the `all_occurrences_identical` check passes

#### Scenario: [OA-SEL-008] all_occurrences_identical fails on divergence
- **WHEN** two resolved occurrences of a field render different text after fill
- **THEN** the `all_occurrences_identical` check fails with the diverging occurrences in `details`

### Requirement: Per-Field Opt-In Backward Compatibility
The selector engine MUST be opt-in per field via the presence of `fields/<field_id>.json`. A recipe with no `fields/` directory MUST behave exactly as today (legacy `replacements.json` path only). `content/templates/` MUST be unaffected.

#### Scenario: [OA-SEL-009] No fields directory is unchanged behavior
- **WHEN** a recipe has no `fields/` directory
- **THEN** the fill pipeline uses only the legacy `replacements.json` path
- **AND** output is byte-identical to pre-change behavior

#### Scenario: [OA-SEL-010] Parity before cutover
- **WHEN** `company_name` is migrated to a selector contract
- **THEN** selector-patched output is compared to legacy replacement-patched output for that field before its keys are added to `migrated_keys`
- **AND** cutover proceeds only if the outputs match
