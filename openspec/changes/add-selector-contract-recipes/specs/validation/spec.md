## ADDED Requirements

### Requirement: Selector Drift Detection
The source-drift check MUST detect when an upstream source change breaks a recipe's selector contracts. `checkRecipeSourceDrift` MUST build a safe-docx document view from the source DOCX and resolve every occurrence locator for the recipe's selector-contract fields. `SourceDriftDiff` MUST be extended with `unresolved_selector_fields[]` (fields with any unresolved occurrence) and `assertion_failures[]` (occurrences whose assertions failed). The check MUST report `ok: false` when either list is non-empty.

#### Scenario: [OA-SEL-016] Drift reported when a selector no longer resolves
- **WHEN** the source DOCX no longer contains a span a `company_name` occurrence locator targets
- **THEN** `checkRecipeSourceDrift` lists that field in `unresolved_selector_fields`
- **AND** the result `ok` is `false`

#### Scenario: [OA-SEL-017] Assertion failure reported as drift
- **WHEN** an occurrence's `primary` resolves but a corroborating assertion no longer matches the same span
- **THEN** the occurrence is listed in `assertion_failures`
- **AND** the result `ok` is `false`

#### Scenario: [OA-SEL-018] No drift when selectors resolve cleanly
- **WHEN** every occurrence locator resolves and all assertions pass against the current source
- **THEN** `unresolved_selector_fields` and `assertion_failures` are empty
- **AND** the result `ok` reflects only hash/structure checks

### Requirement: Selector Drift In Source Canary
The `source_drift_canary` script MUST surface selector drift. A recipe with selector contracts MUST report FAIL when any selector field is unresolved or any assertion fails, alongside the existing hash and structural-anchor drift output.

#### Scenario: [OA-SEL-019] Canary fails on selector drift
- **WHEN** `check:source-drift` runs for a recipe whose selector no longer resolves against the cached source
- **THEN** the canary reports FAIL for that recipe
- **AND** names the unresolved selector field(s)
