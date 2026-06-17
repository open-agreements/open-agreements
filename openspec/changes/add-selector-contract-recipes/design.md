# Design: Selector-Contract Recipes (Phase 1)

## Context
Recipes today use literal global find/replace (`replacements.json`). This change introduces deterministic selector contracts for recipe fields, consuming the safe-docx `resolveLocator` primitive (`@usejunior/docx-core` ^0.12.0). Phase 1 migrates a single field — `company_name` in `nvca-stock-purchase-agreement` — chosen because it is the join PoC named by legal-explainer PR #813 and because its three heterogeneous placeholders exercise the occurrences model and `all_occurrences_identical`.

## Hard dependency
safe-docx change `add-deterministic-locator-primitive` must publish `@usejunior/docx-core` 0.12.0 first. This change pins `^0.12.0` (replacing today's loose `>=0.7.0`) and cannot merge until that release is on npm.

## Modules (`src/core/selectors/`, NOT `src/core/selector.ts`)
- `manifest-schema.ts` — Zod `FieldSelectorManifest { schema_version, field_id, field_label, description, source_template_version, occurrences: Locator[], postconditions[], failure_behavior, fixtures[] }` and `TemplateManifest { schema_version, template_id, template_version, source_sha256, part_hashes?, migrated_keys: string[] }`. `Locator` is the docx-core single-span type. No `requirement` field.
- `loader.ts` — glob `content/recipes/<id>/fields/*.json`; load `template-manifest.json`.
- `resolve.ts` — DocxDocument-based path: `DocxDocument.load(cleanedDocx)` → `doc.insertParagraphBookmarks('selector_contract')` → `doc.buildDocumentView()` → `resolveLocator()` per occurrence → matches + drift findings. The `insertParagraphBookmarks` step is REQUIRED: `buildDocumentView()` includes only paragraphs that carry a `_bk_*` bookmark id and `DocxDocument.load()` does not insert them, so on a freshly cleaned NVCA DOCX the view would otherwise be empty.
- `patch.ts` — apply each resolved span via the `doc.replaceTextAtRange({ targetParagraphId: match.nodeId, start, end, replaceText: '{field_id}' })` **method** (not the free `replaceParagraphTextRange` the legacy DOM patcher imports), then serialize via `doc.toBuffer({ cleanBookmarks: true })` so the injected `_bk_*` bookmarks are stripped from output (parity with the legacy path). Writing `{tag}` placeholders keeps downstream `fillDocx`/`docx-templates` untouched.
- `postconditions.ts` — produce new `VerifyCheck`s (`VerifyResult = {passed, checks[]}`, `VerifyCheck = {name, passed, details?}`). Phase-1: `no_unresolved_placeholder`, `all_occurrences_identical`, `no_double_dollar`.

## Cardinality (one field → N occurrences)
The safe-docx `Locator` resolves a single span. A field that appears N times owns an ordered `occurrences: Locator[]`; the engine fills every resolved occurrence. This is required for `company_name`: its three placeholders (`[Insert Company Name]`, `[Company name]`, `[____________]`) are heterogeneous, so a single regex would over-match. The blank `[____________]` occurrence resolves by a bare regex on the unique 12-underscore token (verified: it appears in exactly one node in the source), which is deterministic and also works in synthetic fixtures that omit the preamble heading. A `section`/`contextual` scope (e.g. the preamble, aligned with the contract-spec `template_clause: …/preamble#company`) is the disambiguator to reach for IF a future form makes the token non-unique — at which point the unscoped regex surfaces it as drift (>1 match → unresolved) rather than silently mis-filling.

## Pipeline integration & backward compatibility
- Order: `cleanDocument()` → selector patch (fields with a manifest) → legacy `patchDocument()` (remaining keys). This matches the existing clean-then-patch flow.
- Cutover is declarative: `template-manifest.json.migrated_keys[]` lists exactly which `replacements.json` keys the selector engine owns; those are removed from the dict handed to `patchDocument`. The inferred "drop every key resolving to a covered tag" heuristic is rejected — with three keys all resolving to `{company_name}`, it would over-drop.
- Verification coverage is preserved: `migrated_keys` are removed ONLY from the dict passed to the legacy `patchDocument`, NOT from the key set handed to `verifyOutput()`. The verifier uses replacement keys to detect leftover source placeholders, so the selector-owned source anchors (e.g. `[Insert Company Name]`, `[Company name]`) must remain in the verifier's view — otherwise a missed occurrence would silently pass. `runRecipe()` currently passes the same `replacements` object to both patch and verify; this change splits them: a filtered dict to the patcher, the full key set to the verifier.
- Opt-in: presence of `fields/` enables the engine for those fields only. No `fields/` ⇒ identical legacy behavior. `runRecipe()` still reads `replacements.json` unconditionally; a future fields-only recipe would need to update `runRecipe()` and `validateRecipe()` (out of scope).

## Drift detection (core value)
`checkRecipeSourceDrift` currently extracts text via regex over `word/document.xml`. Add a safe-docx parse path: build the view, resolve each occurrence locator, and extend `SourceDriftDiff` with `unresolved_selector_fields[]` and `assertion_failures[]`. The `source_drift_canary` script already downloads/caches the source DOCX, so it can run resolution at canary time and FAIL on selector drift. This is the standing "did an upstream change break our selectors?" gate; the rare NVCA form update surfaces here.

## Legal level / cross-repo join (no duplication)
No `requirement`/RFC-2119 level in the manifest. The level is owned by legal-explainer contract-spec REQs, joined to OA fields via `template_metadata_fields ⟷ field_id`. PR #813 landed the parse slice + the NVCA fixture (`identify-company → [company_name]`, MUST) and is waiting on this change shipping `fields/company_name.json`. Fill behavior is governed only by `failure_behavior`; the legal level is consumed downstream by the legal-explainer projector.

## Out of scope
MCP envelope changes (`field_values`/`selected_alternatives`/`exceptions`), migrating other fields/recipes, and the legal-explainer projector code itself.
