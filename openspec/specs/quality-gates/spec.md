# quality-gates Specification

## Purpose
Defines the quality gates capability after restructuring the legacy open-agreements monolith.

## Requirements
### Requirement: Public Trust Signal Surfaces
The project SHALL expose trust signals that help users and AI agents quickly verify maintenance quality and testing posture from public surfaces, including a system card that combines mapping and runtime evidence with direct verification links.

#### Scenario: [OA-DST-006] README exposes trust evidence at first glance
- **WHEN** a visitor opens the repository README
- **THEN** the top section shows trust signals for CI status and coverage
- **AND** identifies the active JavaScript test framework (Vitest or Jest)

#### Scenario: [OA-DST-068] System card includes runtime proof metadata
- **WHEN** a reviewer opens the system card
- **THEN** the page shows the latest run timestamp, commit reference, CI run link, and Allure report link
- **AND** missing runtime metadata is shown explicitly as unavailable rather than silently omitted

#### Scenario: [OA-DST-069] System card exposes epic drill-down
- **WHEN** a reviewer inspects an epic in the system card
- **THEN** the epic can be expanded to show scenario-level rows and mapped tests
- **AND** each scenario row displays its binary trust status

### Requirement: Binary Trust Mapping Status
Trust-facing scenario mapping output SHALL use binary status values only: `covered` or `missing`. Any legacy non-covered state (including `pending_impl`) SHALL be rendered as `missing` in trust surfaces.

#### Scenario: [OA-DST-070] Pending-style mappings render as missing in trust surfaces
- **WHEN** traceability data includes a scenario mapped only to skip/todo tests
- **THEN** trust-facing outputs classify that scenario as `missing`
- **AND** trust surfaces do not render `pending_impl`

#### Scenario: [OA-DST-071] Covered mappings remain covered
- **WHEN** a scenario has at least one covered mapped test
- **THEN** trust-facing outputs classify that scenario as `covered`

### Requirement: Runtime Trust Data Freshness Gate
The trust pipeline SHALL validate the shape and freshness of the runtime trust data artifact used by the system card.

#### Scenario: [OA-DST-072] Runtime artifact must be present and fresh
- **WHEN** trust checks run
- **THEN** `site/_data/systemCardRuntime.json` exists and has required runtime fields
- **AND** the artifact age is within configured freshness limits
- **AND** trust checks fail when the runtime artifact is missing or stale

### Requirement: Generated README Consistency

The repository SHALL generate `README.md` from a checked-in template plus
repository metadata so public inventory sections stay aligned with the current
repo state.

#### Scenario: [OA-DST-064] Deterministic README generation

- **WHEN** the README generation script runs
- **THEN** it rebuilds `README.md` from a checked-in template and live metadata
  for skills, templates, packages, and documentation links
- **AND** the resulting markdown uses stable headings and npm-safe absolute
  links where required

#### Scenario: [OA-DST-065] Shared catalog data without site side effects

- **WHEN** the README generator needs template catalog data
- **THEN** it reads from a pure shared helper rather than an Eleventy data file
  with site-specific side effects
- **AND** website build behavior remains intact

### Requirement: README Drift Gate

The CI pipeline SHALL fail when the committed `README.md` differs from the
generated README output.

#### Scenario: [OA-DST-066] README drift detected in CI

- **WHEN** repository metadata changes and `README.md` is not regenerated
- **THEN** the README check step regenerates the file
- **AND** CI fails if `git diff --exit-code -- README.md` reports changes

#### Scenario: [OA-DST-067] README stays in sync after regeneration

- **WHEN** the README generator runs locally before commit
- **THEN** the regenerated `README.md` matches the committed file
- **AND** the README drift check passes

### Requirement: CI-Published Coverage and Test Results
The CI pipeline SHALL publish both code coverage and machine-readable unit test results to external trust surfaces.

#### Scenario: [OA-DST-008] Coverage uploads to Codecov
- **WHEN** CI runs on pull requests or pushes to main
- **THEN** coverage output is generated from the active test runner
- **AND** an `lcov` report is uploaded to Codecov

#### Scenario: [OA-DST-009] Unit test results upload in machine-readable format
- **WHEN** CI runs unit tests
- **THEN** the active test runner emits a JUnit XML report
- **AND** CI uploads that test result report to Codecov test-results ingestion

#### Scenario: [OA-DST-010] Tokenless-first test result upload
- **WHEN** repository-level Codecov settings allow tokenless uploads
- **THEN** CI test result upload succeeds without a hard dependency on `CODECOV_TOKEN`
- **AND** repository docs or workflow comments explain the expected auth mode

### Requirement: Repository-Defined Coverage Gate Policy
Coverage gate policy SHALL be versioned in-repo so trust thresholds are explicit, reviewable, and ratchetable over time.

#### Scenario: [OA-DST-011] Initial patch and project gates are codified
- **WHEN** coverage policy is configured
- **THEN** patch coverage uses target `85%` with `5%` threshold
- **AND** project coverage uses target `auto` with `0.5%` threshold

#### Scenario: [OA-DST-012] Coverage policy prevents regressions while allowing staged hardening
- **WHEN** coverage is uploaded for new commits
- **THEN** the project gate blocks material regression relative to baseline
- **AND** policy notes define staged increases toward explicit project floors as coverage grows

#### Scenario: [OA-DST-013] Coverage denominator is scoped to implementation sources
- **WHEN** coverage runs in CI
- **THEN** denominator scope is limited to implementation source trees configured in coverage settings
- **AND** tooling/support paths (for example scripts, generated output, docs/site content, and test files) are excluded from gate calculations

### Requirement: Spec-Backed Allure Coverage Expansion
Trust-oriented test coverage SHALL include executable Allure tests keyed to canonical OpenSpec scenarios, including retroactive scenario additions for already-implemented behavior.

#### Scenario: [OA-DST-014] Retroactive specs are added for implemented behavior
- **WHEN** maintainers identify implemented behavior not represented in canonical scenarios
- **THEN** canonical OpenSpec scenarios are added or clarified before claiming coverage
- **AND** scenario names remain stable enough for traceability mapping

#### Scenario: [OA-DST-015] Behavior-level Allure tests are linked to canonical scenarios
- **WHEN** canonical scenarios exist for an implemented behavior
- **THEN** at least one Allure-reported test asserts that behavior and maps to the scenario
- **AND** `npm run check:spec-coverage` remains green for missing/extra/pending mappings

### Requirement: Canonical Evidence Story
The trust surface SHALL include a reproducible evidence story demonstrating the fill pipeline from structured JSON input to valid DOCX output, with pre-generated page renders committed at stable paths.

#### Scenario: [OA-DST-016] Canonical evidence story fills template from JSON payload
- **WHEN** the evidence story JSON payload is passed to the fill pipeline for the Common Paper Mutual NDA template
- **THEN** the CLI produces a valid DOCX file with correct placeholder substitution
- **AND** the JSON payload and rendered page PNG are attached as Allure evidence artifacts

### Requirement: OpenSpec Coverage Validation Script
The validation script MUST parse CLI arguments, enforce behavior-oriented scenario
prose, accept only Allure wrapper bindings, and collect scenario IDs from active
change-package specs.

#### Scenario: [OA-DST-026] Coverage script CLI argument parsing
- **WHEN** the script runs with or without `--write-matrix`
- **THEN** it parses arguments correctly, defaulting matrix path when omitted
- **AND** only writes a traceability matrix file when `--write-matrix` is set

#### Scenario: [OA-DST-027] Coverage script validation rules
- **WHEN** scenario prose contains path-dependent text or non-Allure wrapper bindings
- **THEN** the script rejects them with descriptive errors
- **AND** accepts valid Allure-wrapped openspec mappings only

#### Scenario: [OA-DST-028] Active change-package scenario collection
- **WHEN** active change packages define additional scenarios
- **THEN** the script collects those IDs and does not mark them as unknown
