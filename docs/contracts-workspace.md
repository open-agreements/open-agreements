# Contracts Workspace CLI

The contracts workspace CLI is a separate package focused on filesystem-based contract operations.

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Repo path: `packages/contracts-workspace/`

## Why Separate from `open-agreements`

`open-agreements` is optimized for template/recipe filling. The workspace CLI handles repository-level workflows:

- lifecycle-first folder scaffolding
- forms catalog validation/download (URL + checksum)
- filename-driven execution status
- YAML status indexing + linting

Teams can use one package without requiring the other.

## Commands

### `init`

Scaffold a workspace in the current directory.

```bash
open-agreements-workspace init --agents claude,gemini
```

Creates:

- `forms/`, `drafts/`, `incoming/`, `executed/`, `archive/`
- topic folders under `forms/`
- `CONTRACTS.md`
- `forms-catalog.yaml`
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
- disallowed file types by folder (for example, PDF in `forms/`)
- `_executed` naming consistency
- stale `contracts-index.yaml` detection

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
2. Call `workspace_init` with `{"root_dir":"/tmp/oa-demo-workspace","agents":["claude","gemini"]}`.
3. Call `status_generate` with `{"root_dir":"/tmp/oa-demo-workspace"}`.
4. Add a sample file in `forms/` and call `status_lint` to show rule detection.
