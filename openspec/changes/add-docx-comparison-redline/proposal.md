# Change: Add pure-TypeScript DOCX comparison and redline support

## Why
OpenAgreements can already generate an agreement DOCX (from a template or by preparing a recipe/external source). Users often need a redline against an approved form to review drift and negotiate changes. Generating a tracked-changes DOCX by comparing the prepared agreement against the original form provides a reliable, tier-agnostic workflow and avoids introducing .NET dependencies.

No pure-JavaScript DOCX comparison library exists on npm; current options require .NET/Java or a commercial cloud API. This validates the decision to vendor and maintain a pure TypeScript comparison engine in the OpenAgreements trust surface.

## What Changes
- Vendor a **pure TypeScript** DOCX comparison engine (sourced from `junior-AI-email-bot/packages/docx-comparison`) into this repo under `packages/docx-comparison/`.
- Prune non-production artifacts from the vendored copy before the initial commit (debug outputs, generated reports, node_modules, dist).
- Remove or exclude any non-pure paths (no .NET / Docxodus / WmlComparer runtime).
- Publish the comparison engine as a standalone npm package under the OpenAgreements org scope (target: `@open-agreements/docx-comparison`).
- Add an OpenAgreements wrapper API:
  - `redlineAgainstForm({ form, agreement, author? }): Promise<Buffer>`
- Add an optional CLI command (non-breaking addition):
  - `open-agreements redline --form <path> --agreement <path> --out <path> [--author <name>]`
- Add tests and fixtures for "no change", "simple replacement", and "clause deleted/moved" scenarios.
- Preserve upstream MIT license and vendoring provenance (commit SHA + source repo) for the vendored comparer.

## Constraints / Versioning Contract
- The comparer exposes `engine: 'atomizer' | 'diffmatch'` as part of its public API.
  - Removing an engine name is a breaking change (major).
  - Adding a new engine is a minor change.
  - Engine name spellings are semver-stable.
- The `auto` alias (if present) SHALL resolve to `'atomizer'` in v1. Changing `auto` defaults is a major change.
- No .NET dependencies (no WmlComparer / Docxodus / Word automation).

## Impact
- Affected specs:
  - `open-agreements` (ADDED: redline API + CLI)
  - `docx-comparison` (ADDED: pure TS comparison engine constraints)
- Affected code:
  - New directory: `packages/docx-comparison/`
  - New module(s): `src/redline/…` and CLI wiring for `redline`
  - CI: run comparer tests and build as part of validation workflow
- Dependencies:
  - For comparer package: `diff-match-patch`, `fast-xml-parser`, `jszip`
  - For OpenAgreements: depends on `@open-agreements/docx-comparison` once published
