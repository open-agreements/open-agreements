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
The system SHALL permit local fills of CC BY-ND templates as transient local
outputs while prohibiting redistribution or repository modification of
no-derivatives template content. External template metadata SHALL include
`source_sha256` so validation can verify the vendored source document has not
changed from upstream.

#### Scenario: [OA-DST-003] CI blocks repository-time derivatives for non-derivative license
- **GIVEN** a repository change modifies generated or source-controlled content for a template with `allow_derivatives: false`
- **WHEN** the CI license validation step runs
- **THEN** the CI check fails with an error explaining that repository-time derivatives of no-derivatives templates are prohibited
- **AND** local fill outputs that exist only on the user's machine remain permitted
- **AND** local fills print a license notice that the output must not be redistributed in modified form

#### Scenario: [OA-DST-004] CI blocks modification of CC BY-ND template
- **GIVEN** a CI workflow running on a PR that modifies a template DOCX file where `allow_derivatives` is false
- **WHEN** the CI validation step runs
- **THEN** the CI check fails with an error indicating that modifying non-derivative templates is prohibited
- **AND** source-controlled external templates must match the declared `source_sha256`
