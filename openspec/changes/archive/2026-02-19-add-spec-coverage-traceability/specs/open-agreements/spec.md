## ADDED Requirements

### Requirement: OpenSpec Scenario Traceability Gate
The repository SHALL provide a programmatic validator that maps each canonical
OpenSpec `#### Scenario:` entry to at least one Allure story in traceability
tests and fails when mappings drift.

#### Scenario: Missing scenario mapping fails validation
- **WHEN** a canonical OpenSpec scenario has no corresponding Allure story mapping
- **THEN** `npm run check:spec-coverage` exits non-zero
- **AND** reports the missing scenario names

#### Scenario: Extra unmapped story fails validation
- **WHEN** an Allure story mapping does not exist in canonical OpenSpec scenarios
- **THEN** `npm run check:spec-coverage` exits non-zero
- **AND** reports the extra story names

#### Scenario: Skipped or todo traceability test is tracked
- **WHEN** a traceability test is marked `test.skip` or `test.todo` for a scenario
- **THEN** the validator reports it as pending coverage
- **AND** the check exits non-zero until pending scenarios are resolved

### Requirement: Generated Traceability Matrix
The validator SHALL generate a markdown matrix showing scenario-level coverage
status for each capability under `openspec/specs/`.

#### Scenario: Matrix includes per-scenario status
- **WHEN** `npm run check:spec-coverage` runs
- **THEN** it writes the traceability matrix file
- **AND** each scenario is labeled as covered, pending, or missing with mapped test files

### Requirement: CI Coverage Gate
CI SHALL run the spec traceability validator and fail pull requests when
traceability coverage is incomplete.

#### Scenario: CI blocks incomplete traceability
- **WHEN** traceability validation reports missing, extra, or pending scenario mappings
- **THEN** the CI spec coverage job fails
- **AND** the pull request is prevented from merging until resolved
