## MODIFIED Requirements

### Requirement: Public Trust Signal Surfaces
The project SHALL expose trust signals that help users and AI agents quickly verify maintenance quality and testing posture from public surfaces, including a system card that combines mapping and runtime evidence with direct verification links.

#### Scenario: [OA-073] README exposes trust evidence at first glance
- **WHEN** a visitor opens the repository README
- **THEN** the top section shows trust signals for CI status and coverage
- **AND** identifies the active JavaScript test framework (Vitest or Jest)

#### Scenario: [OA-074] Landing page exposes trust evidence without scrolling deep
- **WHEN** a visitor opens the landing page
- **THEN** the Trust section links to npm package, CI status, coverage dashboard, and source repository
- **AND** includes an explicit signal for the active JavaScript test framework (Vitest or Jest)

#### Scenario: [OA-191] System card includes runtime proof metadata
- **WHEN** a reviewer opens the system card
- **THEN** the page shows the latest run timestamp, commit reference, CI run link, and Allure report link
- **AND** missing runtime metadata is shown explicitly as unavailable rather than silently omitted

#### Scenario: [OA-192] System card exposes epic drill-down
- **WHEN** a reviewer inspects an epic in the system card
- **THEN** the epic can be expanded to show scenario-level rows and mapped tests
- **AND** each scenario row displays its binary trust status

## ADDED Requirements

### Requirement: Binary Trust Mapping Status
Trust-facing scenario mapping output SHALL use binary status values only: `covered` or `missing`. Any legacy non-covered state (including `pending_impl`) SHALL be rendered as `missing` in trust surfaces.

#### Scenario: [OA-193] Pending-style mappings render as missing in trust surfaces
- **WHEN** traceability data includes a scenario mapped only to skip/todo tests
- **THEN** trust-facing outputs classify that scenario as `missing`
- **AND** trust surfaces do not render `pending_impl`

#### Scenario: [OA-194] Covered mappings remain covered
- **WHEN** a scenario has at least one covered mapped test
- **THEN** trust-facing outputs classify that scenario as `covered`

### Requirement: Runtime Trust Data Freshness Gate
The trust pipeline SHALL validate the shape and freshness of the runtime trust data artifact used by the system card.

#### Scenario: [OA-195] Runtime artifact must be present and fresh
- **WHEN** trust checks run
- **THEN** `site/_data/systemCardRuntime.json` exists and has required runtime fields
- **AND** the artifact age is within configured freshness limits
- **AND** trust checks fail when the runtime artifact is missing or stale
