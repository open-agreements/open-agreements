# Change: Rename Contract IR canonical source from `content.md` to `template.md`

## Why

The OpenAgreements template catalog has two authored-markdown filenames in use:
`content.md` for Contract IR SAFE consents, and `template.md` for employment
templates. This split forces downstream consumers (dev-website, MCP) to carry
dual lookup logic and manual slug lists to decide which filename to prefer per
template. Consolidating on `template.md` removes that split and lets consumers
autodetect authored markdown by a single filename.

## What Changes

- Rename the canonical Contract IR authored-markdown filename from `content.md`
  to `template.md` in both SAFE consent templates.
- Update the Contract IR loader, catalog-data pipeline, integration tests, and
  documentation to read from `template.md`.
- Expose `allow_derivatives` on every template entry in the CLI `list --json`
  output (and therefore in `data/templates-snapshot.json`) so downstream
  consumers can gate derivative rendering without re-reading per-template
  `metadata.yaml`.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `content/templates/openagreements-board-consent-safe/content.md` → `template.md`
  - `content/templates/openagreements-stockholder-consent-safe/content.md` → `template.md`
  - `scripts/contract_ir/index.mjs` — loads `template.md`
  - `scripts/lib/catalog-data.mjs` — Contract IR detection and markdown download
  - `integration-tests/contract-ir-board-consent.test.ts` — fixture filename
  - `integration-tests/contract-ir-stockholder-consent.test.ts` — fixture filename
  - `src/core/template-listing.ts` — `TemplateListItem` gains `allow_derivatives`
  - `src/commands/list.ts` — emits `allow_derivatives` for internal/external/recipe tiers
  - `data/templates-snapshot.json` — regenerated with `allow_derivatives`
  - `docs/contract-ir-safe-board-consent.md` — references `template.md`
  - `content/templates/openagreements-board-consent-safe/README.md` — references `template.md`
  - `content/templates/openagreements-stockholder-consent-safe/README.md` — references `template.md`
