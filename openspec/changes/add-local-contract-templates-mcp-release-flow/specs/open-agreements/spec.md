## ADDED Requirements

### Requirement: Local Contract Templates MCP Server
The system SHALL provide a local stdio MCP server package named `@open-agreements/contract-templates-mcp` for template discovery and drafting workflows without requiring the hosted MCP endpoint.

#### Scenario: [OA-DST-033] Local template MCP server exposes core tools
- **WHEN** a client calls `tools/list` on `@open-agreements/contract-templates-mcp`
- **THEN** tool descriptors include `list_templates`, `get_template`, and `fill_template`
- **AND** `fill_template` can produce a local DOCX output path for a valid template payload

### Requirement: Gemini Extension Manifest Contract
The repository SHALL maintain a valid `gemini-extension.json` contract with strict metadata fields and local MCP server entries for OpenAgreements package capabilities.

#### Scenario: [OA-DST-034] Gemini manifest declares strict metadata and local MCP entries
- **WHEN** `gemini-extension.json` is validated in CI
- **THEN** it includes `name`, `version`, `description`, `contextFileName`, `entrypoint`, and `mcpServers`
- **AND** it declares both `contracts-workspace-mcp` and `contract-templates-mcp` using `npx`
- **AND** no server entry sets `cwd`

### Requirement: Isolated Package Runtime Smoke Gate
Release and CI pipelines SHALL verify publishable package runtime behavior from an isolated install context prior to publication.

#### Scenario: [OA-DST-035] Isolated runtime smoke validates package startup and commands
- **WHEN** isolated runtime smoke checks execute in CI or release preflight
- **THEN** packed tarballs for publishable packages install successfully in a clean temp directory
- **AND** `open-agreements list --json` succeeds
- **AND** both local MCP package binaries respond to `initialize` without runtime/module resolution failures
