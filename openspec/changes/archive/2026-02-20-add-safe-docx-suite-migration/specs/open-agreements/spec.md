## ADDED Requirements
### Requirement: Safe Docx Suite Migrates Atomically
The repository SHALL migrate `safe-docx`, `docx-primitives`, `docx-comparison`, and `safe-docx-mcpb` as one package suite without partial package cutover.

#### Scenario: destination package suite paths all exist
- **WHEN** migration is complete
- **THEN** `packages/safe-docx`, `packages/docx-primitives`, `packages/docx-comparison`, and `packages/safe-docx-mcpb` all exist

#### Scenario: CI verifies all suite packages in workspace mode
- **WHEN** CI executes migration-aware checks
- **THEN** workspace build/test commands include all four suite packages

### Requirement: MCPB Bundle Distribution Is Built in CI and Released
The repository SHALL build `safe-docx.mcpb` from `packages/safe-docx-mcpb` and distribute it as a GitHub release asset.

#### Scenario: CI builds MCPB bundle and publishes artifact on main
- **WHEN** CI runs on `main`
- **THEN** CI executes `npm run pack:mcpb -w @open-agreements/safe-docx-mcpb`
- **AND** uploads `packages/safe-docx-mcpb/safe-docx.mcpb` as a workflow artifact

#### Scenario: release workflow attaches MCPB bundle to release
- **WHEN** the release workflow runs for a release tag
- **THEN** it packs `safe-docx.mcpb` from `@open-agreements/safe-docx-mcpb`
- **AND** attaches the `.mcpb` file to the corresponding GitHub release
