## ADDED Requirements
### Requirement: npm Package Integrity
The npm tarball SHALL include `dist/`, `bin/`, `templates/`, `recipes/`, and `skills/`
directories. The `prepack` script SHALL run the build before packing. The tarball
SHALL NOT include `src/` or `node_modules/`.

#### Scenario: [OA-DST-005] Clean install from registry works
- **GIVEN** the package is published to npm
- **WHEN** a user runs `npm install open-agreements` in a fresh directory
- **THEN** `npx open-agreements list --json` produces valid JSON output

### Requirement: Gated Skills Directory Publish Workflow
The repository SHALL provide a manually triggered workflow that can publish
source-controlled `skills/` directories to supported external skill registries
without relying on local browser sessions.

#### Scenario: [OA-DST-073] Publish changed skills after a squash merge
- **WHEN** maintainers run the workflow with scope `changed` after a squash
  merge to `main`
- **THEN** the workflow identifies the changed skill directories relative to the
  provided base ref
- **AND** publishes only those skill directories to the requested targets

#### Scenario: [OA-DST-074] Publish a selected subset of skills
- **WHEN** maintainers run the workflow with scope `selected` and an explicit
  comma-separated skill list
- **THEN** only the named skill directories are published
- **AND** the workflow fails with a clear error if a requested skill directory
  does not exist or lacks a `SKILL.md`

### Requirement: Skill Version-Sourced Directory Publishing
Directory publish automation SHALL source each skill's publish version from the
declared `metadata.version` in that skill's `SKILL.md`.

#### Scenario: [OA-DST-075] ClawHub publish uses declared skill version
- **WHEN** the workflow publishes a skill to ClawHub
- **THEN** it reads the version from that skill's `SKILL.md`
- **AND** passes the declared version to the ClawHub publish command
- **AND** does not invent or auto-bump a separate registry-only version

### Requirement: Explicit Directory Publish Scope
The repository SHALL automate only registries with a supported authenticated
publish path, and SHALL document when a discovery surface is intentionally not
treated as a CI publish target.

#### Scenario: [OA-DST-076] Workflow excludes skills.sh from publish steps
- **WHEN** maintainers review the workflow and release docs
- **THEN** ClawHub and Smithery are the only automated external skill
  registries
- **AND** docs explicitly state that `skills.sh` is a discovery/indexing
  surface rather than a direct CI publish target

### Requirement: Token-Based Registry Authentication
The workflow SHALL use non-interactive token-based authentication for requested
registry targets and fail clearly when required auth is missing.

#### Scenario: [OA-DST-077] Missing target secret blocks requested publish
- **WHEN** the workflow is asked to publish to Smithery or ClawHub
- **AND** the corresponding repository secret is missing
- **THEN** the workflow fails before attempting a publish to that target
- **AND** the logs identify which secret is required

### Requirement: Local Contract Templates MCP Server
The system SHALL provide a local stdio MCP server package named
`@open-agreements/contract-templates-mcp` for template discovery and drafting
workflows without requiring the hosted MCP endpoint.

#### Scenario: [OA-DST-078] Local template MCP server exposes core tools
- **WHEN** a client calls `tools/list` on
  `@open-agreements/contract-templates-mcp`
- **THEN** tool descriptors include `list_templates`, `get_template`, and
  `fill_template`
- **AND** `fill_template` can produce a local DOCX output path for a valid
  template payload

### Requirement: Gemini Extension Manifest Contract
The repository SHALL maintain a valid `gemini-extension.json` contract with
strict metadata fields and local MCP server entries for OpenAgreements package
capabilities.

#### Scenario: [OA-DST-079] Gemini manifest declares strict metadata and local MCP entries
- **WHEN** `gemini-extension.json` is validated in CI
- **THEN** it includes `name`, `version`, `description`, `contextFileName`,
  `entrypoint`, and `mcpServers`
- **AND** it declares both `contracts-workspace-mcp` and
  `contract-templates-mcp` using `npx`
- **AND** no server entry sets `cwd`

### Requirement: Isolated Package Runtime Smoke Gate
Release and CI pipelines SHALL verify publishable package runtime behavior from
an isolated install context prior to publication.

#### Scenario: [OA-DST-080] Isolated runtime smoke validates package startup and commands
- **WHEN** isolated runtime smoke checks execute in CI or release preflight
- **THEN** packed tarballs for publishable packages install successfully in a
  clean temp directory
- **AND** `open-agreements list --json` succeeds
- **AND** both local MCP package binaries respond to `initialize` without
  runtime/module resolution failures

### Requirement: API Endpoint Protocol Compliance
The hosted API endpoints (A2A, MCP, download) MUST handle CORS preflight,
method restrictions, and protocol-specific error formats correctly.

#### Scenario: [OA-DST-024] MCP tool call envelope responses
- **WHEN** MCP tools/call is invoked for list_templates, get_template, or fill_template
- **THEN** responses use structured envelope format with appropriate status codes
- **AND** missing arguments return INVALID_ARGUMENT envelope
- **AND** not-found templates return TEMPLATE_NOT_FOUND envelope

### Requirement: npm Package Distribution Integrity
The packed npm tarball MUST include `dist/`, `bin/`, template metadata, and recipe
metadata. It MUST NOT include `src/` or `node_modules/`.

#### Scenario: [OA-DST-029] Package tarball includes required files and excludes source
- **WHEN** the package is packed via `npm pack`
- **THEN** tarball contains compiled output, CLI entry point, template metadata, and recipe metadata
- **AND** tarball does not contain uncompiled source or dependency directories
