## ADDED Requirements

### Requirement: JSON Schema Publishing
The workspace package SHALL publish JSON Schema files derived from its Zod validation schemas at build time, making config file formats discoverable by agents and crawlers without an active MCP connection.

#### Scenario: Schema generation from Zod
- **WHEN** `npm run generate:schemas` is executed after `npm run build:workspace`
- **THEN** JSON Schema files are generated for `FormsCatalogSchema` and `ConventionConfigSchema`
- **AND** each file is self-contained (no `$ref` pointers to external files)
- **AND** each file includes a `$id` field with a stable URL

#### Scenario: Schema hosted at stable URL
- **WHEN** the site is deployed
- **THEN** JSON Schema files are available at `https://openagreements.ai/schemas/forms-catalog.schema.json` and `https://openagreements.ai/schemas/conventions.schema.json`

#### Scenario: Schema shipped in npm package
- **WHEN** the `@open-agreements/contracts-workspace` package is published
- **THEN** JSON Schema files are included under the `schemas/` directory

#### Scenario: Generation fails gracefully when workspace not built
- **WHEN** `npm run generate:schemas` is executed without prior `npm run build:workspace`
- **THEN** the script exits with a non-zero code and a clear error message

### Requirement: Workspace Schema Exports
The `@open-agreements/contracts-workspace` package SHALL export its Zod validation schemas as part of the public API so downstream consumers and build tools can use them directly.

#### Scenario: Zod schemas are importable
- **WHEN** a consumer imports from `@open-agreements/contracts-workspace`
- **THEN** `FormsCatalogSchema`, `CatalogEntrySchema`, and `ConventionConfigSchema` are available as named exports
