# Change: Add Safe Docx Suite Migration

## Why
The repository currently lacks the full Safe Docx package suite (`safe-docx`, `docx-primitives`, `docx-comparison`) plus the MCP bundle package (`safe-docx-mcpb`) as canonical `@open-agreements/*` packages with destination-repo OpenSpec traceability continuity.

## What Changes
- Add the three-package Safe Docx suite plus `safe-docx-mcpb` to `packages/` as a single migration unit.
- Adopt canonical package names and internal dependency edges under `@open-agreements/*`.
- Port OpenSpec capabilities and required mcp-server change deltas needed for traceability tests.
- Update CI and release workflows to build, test, pack, and publish the suite with provenance.
- Add MCPB distribution flow: pack `safe-docx.mcpb` in CI and attach it to GitHub releases.

## Impact
- Affected specs: `mcp-server`, `docx-primitives`, `docx-comparison`, `open-agreements`
- Affected code: `packages/safe-docx`, `packages/docx-primitives`, `packages/docx-comparison`, `packages/safe-docx-mcpb`, root workspace config, `.github/workflows/*`, `openspec/specs/*`, `openspec/changes/*`
