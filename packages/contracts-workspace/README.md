# @open-agreements/contracts-workspace

Topic-first workspace CLI for organizing, cataloging, and tracking contract files.

## Scope

This package focuses on repository/workspace operations:

- `init` previews a minimal topic-first structure and suggests setup actions (no auto-write)
- `catalog` validates and fetches forms from URL + checksum catalog entries
- `status` generates `contracts-index.yaml` and lints workspace structure

It is intentionally separate from `open-agreements` template filling so teams can adopt either workflow independently.

## Quickstart

```bash
# From a contracts directory
open-agreements-workspace init --agents claude,gemini

# Validate default forms catalog
open-agreements-workspace catalog validate

# Fetch all allowed catalog entries
open-agreements-workspace catalog fetch

# Generate status index and lint findings
open-agreements-workspace status generate
open-agreements-workspace status lint
```

## Structure Suggested by `init`

- top-level topic folders (for example, `Vendor Agreements/`, `Employment and Human Resources/`)
- `CONTRACTS.md`
- `forms-catalog.yaml`
- `WORKSPACE.md`
- `.contracts-workspace/conventions.yaml`
- `contracts-index.yaml` (generated via `status generate`)
- optional snippets under `.contracts-workspace/agents/`

## Convention Config

Convention behavior is configured via `.contracts-workspace/conventions.yaml`. When `init` runs on a non-empty directory, it scans existing filenames to infer conventions (naming style, executed markers). On an empty directory, it uses defaults.

Key settings:

| Field | Default | Description |
|-------|---------|-------------|
| `executed_marker.pattern` | `_executed` | Filename suffix for signed agreements |
| `naming.style` | `snake_case` | Also detects `kebab-case`, `title-case-spaces`, `title-case-dash` |
| `lifecycle.applicable_domains` | lifecycle folders | Folders that participate in lifecycle tracking |
| `disallowed_file_types` | `{ forms: [pdf] }` | File extensions not allowed in specific folders |
| `documentation.root_file` | `WORKSPACE.md` | Root documentation file |
| `documentation.folder_file` | `FOLDER.md` | Per-folder documentation file |

### Adaptive Init

When initializing a non-empty directory, `init` scans existing files to detect:
- **Executed markers**: `_executed`, `_signed`, `(fully executed)`, etc.
- **Naming style**: `snake_case`, `kebab-case`, `title-case-spaces`, `title-case-dash`
- **Domain folders**: which folders contain lifecycle-stage content vs flat assets

Detected conventions are written to `.contracts-workspace/conventions.yaml`.

### Generated Documentation

`init` creates `WORKSPACE.md` (workspace overview) and `FOLDER.md` (per-lifecycle-folder docs). These files use sentinel comments — on re-init, generated content is updated while any content you add outside the sentinels is preserved.

## Status Conventions

Execution state is filename-driven:

- Append the configured marker (default: `_executed`) before extension for signed files
- Example: `msa_acme_beta_executed.docx`

`contracts-index.yaml` is generated output and should be regenerated when files change.

## Local-Synced Cloud Folders

The CLI uses normal filesystem operations and works in locally synced folders (for example, a Google Drive folder synced to a Mac). No Drive API/OAuth integration is required in v1.

## Out of Scope (v1)

- Signature request automation
- PDF splitting/signature-pack processing
- Cloud-native document APIs
