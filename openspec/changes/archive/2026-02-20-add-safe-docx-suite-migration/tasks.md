# Tasks: add-safe-docx-suite-migration

## 1. OpenSpec and Traceability Baseline
- [x] 1.1 Add migration proposal, tasks, and spec deltas for impacted capabilities.
- [x] 1.2 Port canonical capability specs for `mcp-server`, `docx-primitives`, and `docx-comparison`.
- [x] 1.3 Port required safe-docx traceability feature IDs into destination `openspec/changes` active/archive.
- [x] 1.4 Run `openspec validate add-safe-docx-suite-migration --strict`.

## 2. Package Suite Migration
- [x] 2.1 Copy `safe-docx-ts` to `packages/safe-docx` excluding generated artifacts.
- [x] 2.2 Copy `docx-primitives-ts` to `packages/docx-primitives` excluding generated artifacts.
- [x] 2.3 Copy `docx-comparison` to `packages/docx-comparison` excluding generated artifacts.
- [x] 2.4 Copy `safe-docx-mcpb` to `packages/safe-docx-mcpb` excluding generated artifacts.
- [x] 2.5 Rename package scopes/imports/metadata to canonical `@open-agreements/*` names (including MCPB).

## 3. Workspace, CI, and Release
- [x] 3.1 Update workspace configuration for package-suite build and test.
- [x] 3.2 Update CI workflows to run workspace-aware build and tests.
- [x] 3.3 Add CI MCPB bundle phase (`npm run pack:mcpb -w @open-agreements/safe-docx-mcpb`) and upload `safe-docx.mcpb` on main builds.
- [x] 3.4 Update release workflow to dry-run pack and publish all three canonical packages with provenance.
- [x] 3.5 Add release step that attaches `safe-docx.mcpb` to the GitHub release.

## 4. Verification
- [x] 4.1 `openspec list`
- [x] 4.2 `openspec validate --strict`
- [x] 4.3 `npm run build --workspaces --if-present`
- [x] 4.4 `npm run test --workspaces --if-present`
- [x] 4.5 `npm run test:run -w @open-agreements/docx-comparison`
- [x] 4.6 `npm run test:run -w @open-agreements/docx-primitives`
- [x] 4.7 `npm run test:run -w @open-agreements/safe-docx`
- [x] 4.8 `npm run test:run -w @open-agreements/safe-docx-mcpb`
- [x] 4.9 `npm run check:spec-coverage -w @open-agreements/safe-docx`
- [x] 4.10 `npm run pack:mcpb -w @open-agreements/safe-docx-mcpb`
