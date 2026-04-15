## ADDED Requirements

### Requirement: Generated README Consistency

The repository SHALL generate `README.md` from a checked-in template plus
repository metadata so public inventory sections stay aligned with the current
repo state.

#### Scenario: Deterministic README generation

- **WHEN** the README generation script runs
- **THEN** it rebuilds `README.md` from a checked-in template and live metadata
  for skills, templates, packages, and documentation links
- **AND** the resulting markdown uses stable headings and npm-safe absolute
  links where required

#### Scenario: Shared catalog data without site side effects

- **WHEN** the README generator needs template catalog data
- **THEN** it reads from a pure shared helper rather than an Eleventy data file
  with site-specific side effects
- **AND** website build behavior remains intact

### Requirement: README Drift Gate

The CI pipeline SHALL fail when the committed `README.md` differs from the
generated README output.

#### Scenario: README drift detected in CI

- **WHEN** repository metadata changes and `README.md` is not regenerated
- **THEN** the README check step regenerates the file
- **AND** CI fails if `git diff --exit-code -- README.md` reports changes

#### Scenario: README stays in sync after regeneration

- **WHEN** the README generator runs locally before commit
- **THEN** the regenerated `README.md` matches the committed file
- **AND** the README drift check passes
