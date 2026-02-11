## ADDED Requirements

### Requirement: Public Trust Signal Surfaces
The project SHALL expose trust signals that help users and AI agents quickly verify maintenance quality and testing posture from public surfaces.

#### Scenario: README exposes trust evidence at first glance
- **WHEN** a visitor opens the repository README
- **THEN** the top section shows trust signals for CI status and coverage
- **AND** identifies the active JavaScript test framework (Vitest or Jest)

#### Scenario: Landing page exposes trust evidence without scrolling deep
- **WHEN** a visitor opens the landing page
- **THEN** the Trust section links to npm package, CI status, coverage dashboard, and source repository
- **AND** includes an explicit signal for the active JavaScript test framework (Vitest or Jest)

### Requirement: CI-Published Coverage and Test Results
The CI pipeline SHALL publish both code coverage and machine-readable unit test results to external trust surfaces.

#### Scenario: Coverage uploads to Codecov
- **WHEN** CI runs on pull requests or pushes to main
- **THEN** coverage output is generated from the active test runner
- **AND** an `lcov` report is uploaded to Codecov

#### Scenario: Unit test results upload in machine-readable format
- **WHEN** CI runs unit tests
- **THEN** the active test runner emits a JUnit XML report
- **AND** CI uploads that test result report to Codecov test-results ingestion

#### Scenario: Tokenless-first test result upload
- **WHEN** repository-level Codecov settings allow tokenless uploads
- **THEN** CI test result upload succeeds without a hard dependency on `CODECOV_TOKEN`
- **AND** repository docs or workflow comments explain the expected auth mode

### Requirement: Repository-Defined Coverage Gate Policy
Coverage gate policy SHALL be versioned in-repo so trust thresholds are explicit, reviewable, and ratchetable over time.

#### Scenario: Initial patch and project gates are codified
- **WHEN** coverage policy is configured
- **THEN** patch coverage uses target `85%` with `5%` threshold
- **AND** project coverage uses target `auto` with `0.5%` threshold

#### Scenario: Coverage policy prevents regressions while allowing staged hardening
- **WHEN** coverage is uploaded for new commits
- **THEN** the project gate blocks material regression relative to baseline
- **AND** policy notes define staged increases toward explicit project floors as coverage grows

### Requirement: Spec-Backed Allure Coverage Expansion
Trust-oriented test coverage SHALL include executable Allure tests keyed to canonical OpenSpec scenarios, including retroactive scenario additions for already-implemented behavior.

#### Scenario: Retroactive specs are added for implemented behavior
- **WHEN** maintainers identify implemented behavior not represented in canonical scenarios
- **THEN** canonical OpenSpec scenarios are added or clarified before claiming coverage
- **AND** scenario names remain stable enough for traceability mapping

#### Scenario: Behavior-level Allure tests are linked to canonical scenarios
- **WHEN** canonical scenarios exist for an implemented behavior
- **THEN** at least one Allure-reported test asserts that behavior and maps to the scenario
- **AND** `npm run check:spec-coverage` remains green for missing/extra/pending mappings
