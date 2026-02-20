# Change: Add configurable workspace conventions with adaptive init

## Why

The contracts-workspace CLI hardcodes conventions (`_executed` suffix, lifecycle
folder names, form topics, file naming patterns) as constants in `constants.ts`.
This prevents adoption in environments with existing naming conventions — for
example, a Google Drive shared drive where documents already use
`(fully executed)` status markers and Title Case naming.

The current `init` command stamps out a fixed scaffold regardless of what already
exists. Teams adopting workspace tooling on an existing document collection must
either rename everything to match the hardcoded conventions or abandon the
tooling.

This change makes conventions configurable, makes `init` an observer that adapts
to existing content, and introduces per-folder documentation (FOLDER.md) plus a
root WORKSPACE.md — so both humans and AI agents know the rules without reading
source code.

## What Changes

- **Convention config file**: `init` writes a `.contracts-workspace/conventions.yaml`
  that records the observed or chosen naming conventions (executed suffix pattern,
  naming style, lifecycle folder names, which domains use lifecycle subfolders).
  All core functions (lint, indexer, workspace-structure) read conventions from
  this config instead of importing constants.
- **Adaptive init**: When `init` runs in a non-empty directory, it scans existing
  files to infer naming conventions (status markers, casing style, separator
  characters) and writes the observed conventions to config. Biases toward
  kebab-case and `_executed` when no clear existing convention is detected.
- **Lifecycle applicability**: Convention config declares which domain folders are
  "lifecycle domains" (get `forms/`, `drafts/`, `executed/`, `archive/`
  subfolders) vs "asset domains" (flat collections like Logos or Presentations).
  Lifecycle subfolders are only created for applicable domains.
- **WORKSPACE.md and FOLDER.md generation**: `init` generates a root `WORKSPACE.md`
  documenting overall structure and linking to per-folder docs. Each domain folder
  gets a `FOLDER.md` declaring purpose, naming convention, owner, and applicable
  lifecycle stages. Both serve as human documentation AND AI agent instructions.
- **Configurable lint**: Lint reads conventions from config to validate status
  markers, naming patterns, and folder structure. A file with `(fully executed)`
  in its name is valid if that's the configured executed marker.
- **Filename-folder consistency warning**: New lint rule — if a filename contains
  the configured execution marker but the file is NOT in the corresponding
  lifecycle folder, emit a warning. Filename remains authoritative for status;
  the warning signals potential misorganization.
- **`constants.ts` becomes defaults**: Current hardcoded values become fallback
  defaults used when no convention config exists. Existing workspaces without
  config continue to work unchanged.

## Critical Design Decisions

- **Filename is authoritative for execution status**: Folder location is
  organizational; the filename marker is the source of truth. This follows the
  OpenSpec filesystem-as-truth principle — status travels with the document.
- **Convention config, not convention enforcement**: The system documents and
  validates conventions but does not force migration. An existing drive with
  `(fully executed)` files keeps working after init.
- **Agent-observed conventions**: During init, the AI agent (or CLI scanner)
  observes the existing workspace and writes conventions to config. The human
  reviews and adjusts. This is the same pattern as OpenSpec's `project.md` — the
  tool generates, the human owns.
- **Lazy lifecycle folder creation**: Lifecycle subfolders are only created for
  domains marked as lifecycle domains in the convention config. Empty folders are
  not created speculatively.
- **Platform-agnostic cross-references**: The guidance says "use references, not
  copies" for cross-domain document bundles (e.g., board meeting exhibits) but
  does not prescribe the reference mechanism (Drive shortcuts, hyperlinks, etc.).

## Scope Boundaries

### In scope (this change)

- Convention config schema and file (`.contracts-workspace/conventions.yaml`)
- Adaptive init that scans existing files and infers conventions
- Lifecycle applicability per domain folder
- WORKSPACE.md and FOLDER.md generation
- Convention-aware lint (configurable executed suffix, naming patterns)
- Filename-vs-folder consistency lint warning
- Backward compatibility: workspaces without config use current defaults

### Out of scope (future changes)

- Cloud API backends (Google Drive, SharePoint) — see add-workspace-provider-interface
- Convention migration tooling (bulk rename to match new conventions)
- Per-file metadata sidecars
- Interactive convention editor UI

## Dependencies

- **Requires**: `add-workspace-provider-interface` — convention config loading
  and writing uses the `WorkspaceProvider` interface. The adaptive init scanner
  reads files through the provider. Lint and indexer access conventions through
  the provider. This change should be implemented after the provider interface
  is in place.

## Impact

- Affected specs:
  - `contracts-workspace` (MODIFIED: conventions become configurable)
- Affected code:
  - `packages/contracts-workspace/src/core/constants.ts` — values become defaults
  - `packages/contracts-workspace/src/core/types.ts` — new ConventionConfig type
  - `packages/contracts-workspace/src/core/workspace-structure.ts` — adaptive init, FOLDER.md/WORKSPACE.md generation
  - `packages/contracts-workspace/src/core/lint.ts` — reads conventions from config
  - `packages/contracts-workspace/src/core/indexer.ts` — reads executed suffix from config
  - `packages/contracts-workspace/src/commands/init.ts` — scanner integration
  - New: `packages/contracts-workspace/src/core/convention-scanner.ts`
  - New: `packages/contracts-workspace/src/core/convention-config.ts`
- Compatibility:
  - Non-breaking: workspaces without convention config fall back to current defaults
  - Existing tests continue to pass against default conventions
