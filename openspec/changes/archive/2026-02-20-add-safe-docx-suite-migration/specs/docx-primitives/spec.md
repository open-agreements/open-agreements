## ADDED Requirements
### Requirement: Docx Primitives Package Migrates with Canonical Naming
The repository SHALL provide a `docx-primitives` package in `packages/docx-primitives` published as `@open-agreements/docx-primitives`.

#### Scenario: canonical package identity is declared
- **WHEN** `packages/docx-primitives/package.json` is evaluated
- **THEN** the package name is `@open-agreements/docx-primitives`
- **AND** licensing remains MIT

#### Scenario: canonical OpenSpec capability is present
- **WHEN** destination OpenSpec specs are listed
- **THEN** a canonical `docx-primitives` capability spec is present
