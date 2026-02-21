## ADDED Requirements
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
