# ip-license Specification

## Purpose
Defines the ip license capability after restructuring the legacy open-agreements monolith.

## Requirements
### Requirement: CI License Compliance
The CI license compliance check MUST diff against the PR base SHA for
pull request events. It MUST NOT use `HEAD~1` for PRs, as this only
checks the most recent commit and misses earlier commits in multi-commit PRs.

#### Scenario: [OA-DST-001] Multi-commit PR license check
- **WHEN** a PR has 3 commits and the first modifies a non-derivative template
- **THEN** the CI check detects the modification by diffing against the PR base
- **AND** the check fails appropriately

#### Scenario: [OA-DST-002] Push to main license check
- **WHEN** a commit is pushed directly to main
- **THEN** the CI check diffs against `HEAD~1` (single-commit context)

### Requirement: License Compliance Validation
The system SHALL refuse to generate derivatives of templates where `allow_derivatives` is false and SHALL fail CI if a PR modifies content of a CC BY-ND licensed template.

#### Scenario: [OA-DST-003] Derivative blocked for non-derivative license
- **GIVEN** a template with `allow_derivatives: false` in its metadata
- **WHEN** the user invokes `fill` on that template
- **THEN** the system refuses to render the template and returns an error explaining the license restriction

#### Scenario: [OA-DST-004] CI blocks modification of CC BY-ND template
- **GIVEN** a CI workflow running on a PR that modifies a template DOCX file where `allow_derivatives` is false
- **WHEN** the CI validation step runs
- **THEN** the CI check fails with an error indicating that modifying non-derivative templates is prohibited
