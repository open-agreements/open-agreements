# Add Selector-Contract Recipes (Phase 1: NVCA company_name)

## Why
Recipes turn a non-redistributable source DOCX (NVCA et al.) into a fillable template via **brittle global find/replace**: `replacements.json` maps a literal string like `[Insert Company Name]` → `{company_name}` across the whole document. When the upstream form shifts a heading, renumbers a clause, or rewords a bracket, the literal match silently misses — `zeroMatchKeys` is only a warning at fill time. There is no `field_id`, no version pin, no occurrence count, and no postcondition.

We want recipe fields modeled as **deterministic selector contracts** (resilient locators resolved against a document view), with **drift detection** as the core value: know immediately when an upstream change breaks a selector. The NVCA form changes rarely (~every 6 months), so updating selectors on each release is acceptable; fuzzy auto-healing is explicitly not wanted.

This also unblocks a cross-repo join: legal-explainer PR #813 (merged) parses `template_metadata_fields` onto contract-spec requirements and added an NVCA SPA conformance fixture whose `identify-company` requirement maps `template_metadata_fields: [company_name]`. Its projector is "blocked on willow shipping `fields/company_name.json`" — i.e. this change.

## What Changes
- NEW: `src/core/selectors/` — `manifest-schema.ts` (Zod `FieldSelectorManifest`/`TemplateManifest`), `loader.ts` (discover `fields/*.json` + `template-manifest.json`), `resolve.ts` (DocxDocument-based: `load` → `insertParagraphBookmarks` → `buildDocumentView` → `resolveLocator` per occurrence), `patch.ts` (apply via the `DocxDocument.replaceTextAtRange` method, serialize via `toBuffer({ cleanBookmarks: true })`), `postconditions.ts` (new `VerifyCheck`s). Code lives under `src/core/selectors/` to avoid the naming clash with the existing radio/checkbox `src/core/selector.ts`.
- NEW per-recipe content (additive): `content/recipes/<id>/fields/<field_id>.json` and `content/recipes/<id>/template-manifest.json` (carrying `migrated_keys[]`).
- MODIFIED: recipe fill pipeline — run the selector patch after `cleanDocument()` and before legacy `patchDocument()`; remove `migrated_keys` from the dict passed to `patchDocument`.
- MODIFIED: `src/core/recipe/source-drift.ts` + `scripts/source_drift_canary.mjs` — add a safe-docx parse path and report `unresolved_selector_fields[]` / `assertion_failures[]`.
- DEPENDENCY: consumes `@usejunior/docx-core` ^0.12.0 (`resolveLocator` + `clean_text→raw` offset map). This change MUST NOT merge until 0.12.0 is published.
- Phase-1 proof-of-concept: convert `nvca-stock-purchase-agreement` → `company_name` only.

## Scope Boundaries
- Only `company_name` in `nvca-stock-purchase-agreement` is migrated. All other fields/recipes keep today's `replacements.json` behavior unchanged.
- No `requirement`/RFC-2119 level in the manifest — the legal level is owned by legal-explainer (joined via `field_id ⟷ template_metadata_fields`), not duplicated here.
- No MCP envelope changes (deferred to a later `extend-mcp-fill-selector-contracts` change).
- No `fuzzy_anchor`, no scoring, no consensus — resolution is deterministic (the safe-docx primitive guarantees this).

## Impact
- Affected specs: `recipes`, `engine`, `validation`
- Affected code: `src/core/selectors/*` (new), `src/core/recipe/source-drift.ts`, `src/core/unified-pipeline.ts` / `src/core/fill-pipeline.ts`, `scripts/source_drift_canary.mjs`, `content/recipes/nvca-stock-purchase-agreement/{fields/company_name.json,template-manifest.json}` (new), `integration-tests/source-drift-canary.test.ts`, `package.json` (pin `@usejunior/docx-core: ^0.12.0`)
- Backward compatibility: recipes without a `fields/` directory behave exactly as today; `content/templates/` is untouched.
