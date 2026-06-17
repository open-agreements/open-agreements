# Tasks

## 1. Dependency
- [ ] 1.1 Confirm `@usejunior/docx-core` 0.12.0 (with `resolveLocator` + `clean_text→raw` map) is published
- [x] 1.2 Pin `@usejunior/docx-core: ^0.12.0` in `package.json` (replace `>=0.7.0`); update lockfile

## 2. Schema + loader (`src/core/selectors/`)
- [x] 2.1 `manifest-schema.ts` — Zod `FieldSelectorManifest` (occurrences: docx-core `Locator[]`; no `requirement`) and `TemplateManifest` (with `migrated_keys`)
- [x] 2.2 `loader.ts` — glob `content/recipes/<id>/fields/*.json` and load `template-manifest.json`; validate `field_id` exists in `metadata.yaml`

## 3. Resolve + patch
- [x] 3.1 `resolve.ts` — `DocxDocument.load()` → `insertParagraphBookmarks('selector_contract')` → `buildDocumentView()` → `resolveLocator()` per occurrence → matches + drift findings
- [x] 3.2 `patch.ts` — write `{tag}` at each resolved span via the `doc.replaceTextAtRange({ targetParagraphId, start, end, replaceText })` method; serialize via `doc.toBuffer({ cleanBookmarks: true })` so injected `_bk_*` bookmarks are stripped from output
- [x] 3.3 Integrate into the recipe pipeline: run after `cleanDocument()`, before legacy `patchDocument()`; remove `migrated_keys` from the patcher dict ONLY
- [x] 3.4 Pass the FULL replacement key set (incl. migrated keys) to `verifyOutput()` so leftover selector-owned source placeholders are still caught (split the patch vs verify dicts in `runRecipe()`)
- [x] 3.5 Gate fill-time failures on `failure_behavior` (block/warn/skip); do not consult any legal level

## 4. Postconditions
- [x] 4.1 `postconditions.ts` — emit `VerifyCheck`s for `no_unresolved_placeholder`, `all_occurrences_identical`, `no_double_dollar`

## 5. Drift detection
- [x] 5.1 Add a safe-docx parse path in `src/core/recipe/source-drift.ts`; resolve occurrence locators
- [x] 5.2 Extend `SourceDriftDiff` with `unresolved_selector_fields[]` and `assertion_failures[]`; set `ok: false` when non-empty
- [x] 5.3 Surface selector drift (FAIL) in `scripts/source_drift_canary.mjs`
- [x] 5.4 Add drift test cases in `integration-tests/source-drift-canary.test.ts` (alongside OA-RCP-028/029)

## 6. PoC content: nvca-stock-purchase-agreement → company_name
- [x] 6.1 Author `content/recipes/nvca-stock-purchase-agreement/fields/company_name.json` with 3 occurrence locators (`[Insert Company Name]`, `[Company name]`, scoped `[____________]` in the preamble)
- [x] 6.2 Author `content/recipes/nvca-stock-purchase-agreement/template-manifest.json` with `migrated_keys` = the 3 `{company_name}` keys
- [x] 6.3 Add fixtures referenced by the manifest

## 7. Parity + verification
- [x] 7.1 Parity test: selector-patched vs legacy replacement-patched output for `company_name` matches BEFORE adding keys to `migrated_keys`
- [x] 7.2 Add `migrated_keys` only after parity passes (the declarative cutover)
- [x] 7.3 Confirm recipes without a `fields/` directory are byte-identical to pre-change output
- [x] 7.4 `npm test` (incl. new selector + drift tests) and `npm run check:source-drift` pass
