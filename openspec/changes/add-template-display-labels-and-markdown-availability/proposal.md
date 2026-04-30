# Change: Add template display labels and markdown availability to discovery surfaces

## Why

Downstream consumers currently need to reconstruct human-facing field labels
from field names or enrich them from legacy template-spec JSON. They also do
not have a canonical discovery flag for whether a template directory actually
ships a `template.md` artifact. Both gaps create avoidable coupling and drift.

## What Changes

- Add an optional `display_label` property to template field definitions in
  `metadata.yaml`.
- Project `display_label` through metadata loading, `list --json`, and the
  committed `data/templates-snapshot.json`.
- Add `has_template_md` to machine-readable template discovery output so
  external consumers can tell whether a listed template has a canonical
  `template.md` file.
- Seed curated `display_label` values into first-party OpenAgreements
  employment template metadata that previously relied on legacy JSON for label
  curation.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `src/core/metadata.ts`
  - `src/core/template-listing.ts`
  - `src/commands/list.ts`
  - `scripts/export-templates-snapshot.mjs`
  - API / MCP discovery helpers that project template metadata
  - first-party template `metadata.yaml` files
