# Change: Add Local Contract Templates MCP and Multi-Package Trusted Release Flow

## Why

OpenAgreements currently has a hosted MCP endpoint and a local workspace MCP server,
but no local MCP server dedicated to template drafting/filling. Gemini extension
workflows need explicit local stdio servers with stable manifest contracts to avoid
startup/runtime regressions.

Additionally, release automation currently publishes only the root package. To ship a
professional Gemini-local experience, the release flow needs to publish a package suite
with OIDC trusted publishing and stronger runtime guards.

## What Changes

- Add a new local stdio MCP package: `@open-agreements/contract-templates-mcp`.
- Expose template drafting tools over MCP: `list_templates`, `get_template`, `fill_template`.
- Update `gemini-extension.json` to strict required metadata and two local MCP servers:
  - `@open-agreements/contracts-workspace-mcp`
  - `@open-agreements/contract-templates-mcp`
- Add Gemini manifest contract validation and isolated package-runtime smoke checks.
- Upgrade release workflow to a multi-package OIDC trusted publish flow for:
  - `open-agreements`
  - `@open-agreements/contracts-workspace-mcp`
  - `@open-agreements/contract-templates-mcp`
- Add required manual local Gemini extension gate to release docs.
- Bump release versions to `0.2.0` for publishable package and extension manifests.

## Impact

- Affected specs: `open-agreements`, `contracts-workspace`
- Affected code:
  - `packages/contract-templates-mcp/*` (new)
  - `.github/workflows/release.yml`
  - `.github/workflows/ci.yml`
  - `gemini-extension.json`
  - `mcp.json`
  - `scripts/check_gemini_extension_manifest.mjs` (new)
  - `scripts/check_isolated_package_runtime.mjs` (new)
  - `README.md`, `docs/changelog-release-process.md`
- Distribution impact:
  - Introduces a new published package for local MCP template workflows.
