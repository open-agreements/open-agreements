## ADDED Requirements

### Requirement: Selector Resolution Against Document View
The selector engine MUST resolve each occurrence locator against a `DocxDocument`-based document view from `@usejunior/docx-core` (^0.12.0). The engine MUST `DocxDocument.load()` the cleaned DOCX, call `insertParagraphBookmarks()` BEFORE `buildDocumentView()` (because `buildDocumentView()` includes only paragraphs carrying a `_bk_*` bookmark id and `load()` does not insert them), then call `resolveLocator`. Selector patterns MUST be authored against `clean_text`; the resolved span MUST be applied via the `DocxDocument.replaceTextAtRange({ targetParagraphId, start, end, replaceText })` method (raw offsets are produced by the locator's `clean_text→raw` map). The engine MUST serialize via `toBuffer({ cleanBookmarks: true })` so the injected `_bk_*` bookmarks do not appear in output. Resolution MUST be deterministic — no fuzzy matching, scoring, or tie-breaking.

#### Scenario: [OA-SEL-011] Resolve and patch an occurrence
- **WHEN** a `company_name` occurrence locator resolves to exactly one span
- **THEN** the engine writes the `{company_name}` tag at that span via `DocxDocument.replaceTextAtRange`
- **AND** downstream `docx-templates` fill substitutes the tag unchanged

#### Scenario: [OA-SEL-012] Deterministic resolution
- **WHEN** the same source DOCX and manifest are resolved twice
- **THEN** the engine produces identical patch locations both times

#### Scenario: [OA-SEL-020] Bookmarks inserted before view, stripped from output
- **WHEN** a cleaned NVCA DOCX with no `_bk_*` bookmarks is resolved
- **THEN** the engine calls `insertParagraphBookmarks()` so `buildDocumentView()` returns a non-empty view
- **AND** the final output (via `toBuffer({ cleanBookmarks: true })`) contains no injected `_bk_*` bookmarks

### Requirement: Selector Patch Ordering
The selector patch step MUST run after `cleanDocument()` and before the legacy `patchDocument()` step. Keys listed in `template-manifest.json.migrated_keys` MUST be removed from the dict passed to `patchDocument()` so a field is patched exactly once.

#### Scenario: [OA-SEL-013] Selector patch precedes legacy patch
- **WHEN** a recipe has both a `fields/` manifest and a `replacements.json`
- **THEN** cleaning runs first, then the selector patch, then the legacy patch on the remaining (non-migrated) keys

### Requirement: Failure Behavior Gated On failure_behavior
At fill time, an unresolved occurrence or a failed assertion for an opted-in field MUST be dispatched solely by the manifest's `failure_behavior`: `block_render_and_request_review` MUST throw; `warn` MUST emit a warning and continue; `skip` MUST continue silently. The RFC-2119 legal level MUST NOT be consulted at fill time.

#### Scenario: [OA-SEL-014] Block on unresolved MUST-blocking field
- **WHEN** a field with `failure_behavior: block_render_and_request_review` has an unresolved occurrence
- **THEN** the fill throws and requests review rather than producing output

#### Scenario: [OA-SEL-015] Warn does not block
- **WHEN** a field with `failure_behavior: warn` has a failed assertion
- **THEN** a warning is emitted and fill continues
