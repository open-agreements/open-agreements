## ADDED Requirements
### Requirement: Docx Comparison Package Migrates with Canonical Naming
The repository SHALL provide a `docx-comparison` package in `packages/docx-comparison` published as `@open-agreements/docx-comparison`.

#### Scenario: canonical package identity is declared
- **WHEN** `packages/docx-comparison/package.json` is evaluated
- **THEN** the package name is `@open-agreements/docx-comparison`
- **AND** licensing remains MIT

#### Scenario: canonical OpenSpec capability is present
- **WHEN** destination OpenSpec specs are listed
- **THEN** a canonical `docx-comparison` capability spec is present
