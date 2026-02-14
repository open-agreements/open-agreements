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

## Status Conventions

Execution state is filename-driven:

- Append `_executed` before extension for signed files
- Example: `msa_acme_beta_executed.docx`

`contracts-index.yaml` is generated output and should be regenerated when files change.

## Local-Synced Cloud Folders

The CLI uses normal filesystem operations and works in locally synced folders (for example, a Google Drive folder synced to a Mac). No Drive API/OAuth integration is required in v1.

## Out of Scope (v1)

- Signature request automation
- PDF splitting/signature-pack processing
- Cloud-native document APIs
