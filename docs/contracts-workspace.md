---
title: Contracts Workspace CLI
description: Filesystem-based contract repository management with catalog, status, and lint commands.
order: 6
section: Packages
---

# Contracts Workspace CLI

The contracts workspace CLI is a separate package focused on filesystem-based contract operations.

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Repo path: `packages/contracts-workspace/`

## Why Separate from `open-agreements`

`open-agreements` is optimized for template/recipe filling. The workspace CLI handles repository-level workflows:

- topic-first structure planning/suggestions
- forms catalog validation/download (URL + checksum)
- filename-driven execution status
- YAML status indexing + linting

Teams can use one package without requiring the other.

## Commands

### `init`

Preview a workspace setup in the current directory. This command does not create folders/files automatically.

```bash
open-agreements-workspace init --agents claude,gemini
```

Suggests:

- top-level topic folders
- `CONTRACTS.md`
- `forms-catalog.yaml`
- `WORKSPACE.md`
- `.contracts-workspace/conventions.yaml`
- `contracts-index.yaml` (generate with `status generate`)
- optional snippets under `.contracts-workspace/agents/`

### `catalog validate`

Validate forms catalog schema and required checksum fields.

```bash
open-agreements-workspace catalog validate
```

### `catalog fetch [ids...]`

Fetch allowed entries and verify SHA-256 before writing files.

```bash
open-agreements-workspace catalog fetch
open-agreements-workspace catalog fetch yc-safe-valuation-cap yc-safe-mfn
```

Pointer-only/proprietary entries are reported but not vendored automatically.

### `status generate`

Generate `contracts-index.yaml` with timestamped summary and per-document records.

```bash
open-agreements-workspace status generate
```

### `status lint`

Validate structure and naming conventions.

```bash
open-agreements-workspace status lint
```

Current baseline lint checks:

- required lifecycle folders exist
- disallowed file types by folder (configurable via `disallowed_file_types` in conventions)
- executed marker naming consistency (uses configured marker, default `_executed`)
- stale `contracts-index.yaml` detection
- duplicate/timestamped file detection
- root orphan detection
- cross-contamination detection (file in wrong domain folder)

## Convention Config

Workspace naming and structure conventions are stored in `.contracts-workspace/conventions.yaml`.

### Adaptive Init

When `init` runs on a non-empty directory, it scans existing filenames to infer:
- **Executed marker**: detects `_executed`, `_signed`, `(fully executed)`, `(signed)` patterns
- **Naming style**: detects `snake_case`, `kebab-case`, `title-case-spaces`, `title-case-dash`
- **Domain applicability**: classifies folders as lifecycle-applicable or asset-only

On an empty directory, defaults apply (`snake_case`, `_executed`).

### Generated Docs (WORKSPACE.md / FOLDER.md)

`init` generates `WORKSPACE.md` at the workspace root and `FOLDER.md` in each existing lifecycle folder. These files:
- Are convention-aware (reflect configured naming style and markers)
- Use sentinel comments for idempotent re-generation
- Preserve user content added outside the sentinel block on re-init

## Local-Synced Drive Model (v1)

This CLI is filesystem-only in v1. It is designed to work on local folders, including locally synced cloud-drive folders (for example, Google Drive sync on macOS). It does not require Drive API credentials.

## Out of Scope (v1)

- signature request integrations
- automatic PDF splitting/signature-pack processing
- cloud-native document API orchestration

## Local MCP Server (for Claude Local Connectors)

There is a sibling local MCP package that exposes workspace operations as tools:

- Package: `@open-agreements/contracts-workspace-mcp`
- Binary: `open-agreements-workspace-mcp`
- Repo path: `packages/contracts-workspace-mcp/`

For local template drafting/filling tools, use the separate package:

- Package: `@open-agreements/contract-templates-mcp`
- Binary: `open-agreements-contract-templates-mcp`

### Build

```bash
npm run build:workspace-mcp
```

### Claude Code setup (local stdio MCP)

```bash
claude mcp add --transport stdio open-agreements-workspace-mcp -- node /ABSOLUTE/PATH/TO/open-agreements/packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

### Demo flow

1. Create a demo folder (for example, `/tmp/oa-demo-workspace`).
2. Call `workspace_init` with `{"root_dir":"/tmp/oa-demo-workspace","agents":["claude","gemini"]}` and create the suggested folders/files.
3. Call `status_generate` with `{"root_dir":"/tmp/oa-demo-workspace"}`.
4. Add a sample file in a topic folder and call `status_lint` to show rule detection.
