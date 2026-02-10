# Change: Add contracts workspace init and lifecycle tracking CLI

## Why

OpenAgreements currently focuses on filling a single legal template at a time.
Small teams operating from a locally synced company drive need a broader
workspace workflow: initialize a contract directory, organize documents into a
predictable lifecycle structure, maintain lightweight status signals that stay in
sync with files, and keep a safe catalog of downloadable forms with URL and
checksum verification.

This change adds that workspace capability as a sibling package/CLI so teams can
adopt workspace management without requiring template-filling flows, while
remaining compatible with OpenAgreements forms and skills.

## What Changes

- Add a new sibling package/CLI for workspace management (working name:
  `open-agreements-workspace`) with an `init` workflow inspired by OpenSpec.
- `init` bootstraps a lifecycle-first contracts directory structure in the
  current working directory:
  - `forms/`
  - `drafts/`
  - `incoming/`
  - `executed/`
  - `archive/`
- Within `forms/`, scaffold topic subfolders (for example: `corporate/`,
  `commercial/`, `employment/`, `finance/`, `tax/`, `compliance/`).
- Generate a shared `CONTRACTS.md` guidance file for AI agents and optional
  agent-specific install snippets for Claude Code and Gemini CLI.
- Add a forms catalog file that stores source URLs plus checksums and license
  handling metadata. For non-redistributable/proprietary forms, the catalog
  stores pointers and integrity data only (no vendored source content).
- Add commands to verify/download forms from the catalog into the workspace
  with checksum validation and explicit license gates.
- Add lifecycle/status linting and index generation over the workspace:
  - filename-driven execution state as source of truth (e.g. `_executed` suffix)
  - output index in YAML (human-editable)
  - generated timestamp and stale-signal rules
- Keep signature-request automation, PDF splitting, and signature-pack
  processing out of scope for v1.
- Keep per-contract sidecar metadata lightweight and optional; avoid mandatory
  per-file JSON sidecars.

## Critical Design Decisions

- **Filesystem-only in v1**: works on local folders, including locally synced
  Google Drive directories; no cloud API/OAuth integration.
- **Lifecycle-first IA**: top-level folders are lifecycle stages; topical
  organization is nested (starting in `forms/`).
- **Status source of truth**: execution status MUST be encoded in filenames;
  generated tracker data derives from filenames and scan results.
- **Readable structured data**: tracker/index output uses YAML, not JSON.
- **Separate adoption path**: workspace CLI/package is separable from the
  template-filling package.

## Scope Boundaries

### In scope (v1)

- Workspace scaffold (`init`)
- Shared agent guidance file (`CONTRACTS.md`)
- Claude Code + Gemini CLI installation guidance
- Forms catalog with URL + checksum + license metadata
- Catalog download/verify commands with legal-safe handling
- Workspace validator/linter and YAML status index generation

### Out of scope (future changes)

- Signature request integrations
- Automatic PDF splitting or signature-pack parsing
- Cloud-native Drive/Docs API integrations
- Full unit-test expansion for every agreement template (tracked as separate change)

## Impact

- Affected specs:
  - `contracts-workspace` (new capability)
- Affected code (planned):
  - New sibling package directory under `packages/` for workspace CLI
  - New catalog schema and commands for forms URL/checksum operations
  - New workspace validator/index generator
  - Optional wiring/docs updates in root README
- Compatibility:
  - Non-breaking for existing `open-agreements` template filling users
  - Workspace functionality can be installed/used independently
