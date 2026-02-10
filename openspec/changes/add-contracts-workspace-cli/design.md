# Design: Contracts Workspace CLI

## Context

OpenAgreements already models legal-document automation at the individual
agreement level (fill/list/validate/recipe). The requested workflow introduces a
higher-level operating model: a contract workspace containing many files at
different lifecycle stages, plus a repeatable setup that AI agents can follow.

The design goal is to keep this workflow lightweight and file-centric so a
business can point the tool at a normal synced folder and get immediate value.

## Goals

- Provide a one-command workspace bootstrap (`init`) for contract repositories.
- Keep operational state durable and inspectable without a database.
- Keep the execution status difficult to desynchronize from actual files.
- Make form sourcing safe by coupling URL references to checksums.
- Support multiple coding agents with one shared contract policy document.
- Avoid coupling workspace adoption to template-filling adoption.

## Non-Goals

- Workflow engines for legal negotiations
- E-sign vendor orchestration
- OCR/document intelligence beyond simple file linting/state extraction
- Forcing heavy per-document metadata maintenance

## Architecture Overview

A new sibling package under `packages/` hosts the workspace CLI.

Proposed package shape:

- `packages/contracts-workspace/`
- `packages/contracts-workspace/src/cli/`
- `packages/contracts-workspace/src/commands/init.ts`
- `packages/contracts-workspace/src/commands/catalog.ts`
- `packages/contracts-workspace/src/commands/status.ts`
- `packages/contracts-workspace/src/core/workspace-structure.ts`
- `packages/contracts-workspace/src/core/catalog.ts`
- `packages/contracts-workspace/src/core/indexer.ts`
- `packages/contracts-workspace/src/core/lint.ts`

This keeps responsibility boundaries clear:
- open-agreements package: agreement rendering + recipe transforms
- contracts-workspace package: repository bootstrap + organization + tracking

## Workspace Model

### Directory structure

`init` creates lifecycle-first top-level directories:
- `forms/`
- `drafts/`
- `incoming/`
- `executed/`
- `archive/`

`forms/` is topic-organized via scaffolded subfolders.

### Agent guidance

`init` writes `CONTRACTS.md` with:
- folder semantics
- naming conventions (including `_executed` suffix rules)
- catalog usage guidance
- validator/index command usage
- safety constraints for file moves and renames

Agent-specific optional snippets are generated for:
- Claude Code
- Gemini CLI

Both reference `CONTRACTS.md` as the shared source of truth.

## Forms Catalog Design

Catalog file (YAML) contains entries with at least:
- `id`
- `name`
- `source_url`
- `checksum.sha256`
- `license.type`
- `license.redistribution` (e.g., `allowed-unmodified`, `pointer-only`)
- `destination_topic`
- `notes`

### Security and legal handling

- URL-only download without checksum is disallowed for catalog-managed downloads.
- Checksum mismatch blocks placement in workspace.
- Entries marked pointer-only/proprietary are represented as references; the
  implementation must not vendor disallowed source content.

## Status and Index Design

### Source of truth

Execution status derives from filename convention. `_executed` is authoritative.

### Index output

`status generate` writes `contracts-index.yaml` with:
- generated timestamp
- counts by lifecycle folder
- per-document records (path, inferred type/lifecycle, status markers)
- lint findings summary

YAML is chosen for human readability/editability while staying structured.

### Lint rules (v1)

- enforce lifecycle folder existence
- enforce filename status convention
- configurable extension/location checks (example: reject PDFs in `forms/`)
- detect stale index (index generation timestamp older than latest file mtime)

## Trade-offs

### Why separate package instead of extending `open-agreements` CLI

Pros:
- workspace users can adopt independently
- preserves simplicity of template-fill UX
- cleaner release/versioning boundaries

Cons:
- additional package to maintain
- docs/distribution coordination

Decision: separate package for v1.

### Why filename-first status

Pros:
- robust against sidecar drift
- visible in Finder/Drive UI
- easy for agents and humans to reason about

Cons:
- less expressive than rich metadata schemas

Decision: keep filename as canonical state; optional metadata can be additive later.

### Why YAML index

Pros:
- human editable
- machine parsable
- less punctuation-fragile than JSON for non-technical edits

Cons:
- schema discipline still required

Decision: YAML in v1, optional converters later.

## Open Questions Deferred

- Additional agent targets beyond Claude Code and Gemini CLI
- Rich per-contract frontmatter schemas
- CSV/XLSX export as first-class commands
- Integration with signature providers
