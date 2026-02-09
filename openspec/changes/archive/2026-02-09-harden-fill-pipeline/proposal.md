# Change: Harden fill pipeline — shared pipeline, currency fix, drafting notes, highlight stripping

## Why

The template fill path (`src/core/engine.ts`) has two gaps that the recipe/external paths don't:

1. **No currency sanitization.** If a template DOCX contains `${purchase_amount}` and the user provides `"$50,000"`, the output is `$$50,000`. The recipe/external paths sanitized via `sanitizeCurrencyValues(values, replacements)`, but templates have no `replacements.json` — their `{tags}` are pre-baked in the DOCX.

2. **No post-fill verification.** Recipe and external paths run `verifyOutput()` to catch unrendered tags, double-dollar signs, and leftover placeholders. The template path writes the file and returns without any checks.

Additionally, all three fill callers duplicated the "default field values," "call createReport," and "handle currency" patterns. Common Paper templates contain drafting note paragraphs (e.g. `[Drafting note: ...]`) that leak into filled output, and yellow highlighting on fill-in fields that should be stripped once filled.

Extracting a shared two-function pipeline (`prepareFillData` + `fillDocx`) centralizes these concerns so bug fixes and new capabilities (currency sanitization, drafting note stripping, highlight stripping) apply to all three pipelines automatically.

Template content cleanup (converting bracket placeholders in committed DOCX files) is a related but separate concern, scoped out of this change.

## What Changes

### Part 1: Shared fill pipeline (DRY refactor)

- New `src/core/fill-pipeline.ts` exporting `prepareFillData()` and `fillDocx()`
- `prepareFillData()` handles: required-field validation, field defaults (`useBlankPlaceholder: false` → `''`, `true` → `BLANK_PLACEHOLDER`), boolean coercion (`coerceBooleans`), display field computation (callback)
- `fillDocx()` handles: drafting note stripping, highlight stripping for filled fields, currency sanitization via DOCX scan, `createReport` call with `fixSmartQuotes` option — returns `Uint8Array`
- All three callers (`engine.ts`, `external/index.ts`, `recipe/index.ts`) refactored to use these two functions
- Each caller retains tier-specific orchestration (clean/patch/verify, temp dirs, integrity checks, etc.)

### Part 2: Currency sanitization for all pipelines (bug fix)

- New `detectCurrencyFields(docxBuffer: Buffer): Set<string>` in `src/core/fill-utils.ts`
  - Scans all general OOXML text parts for `${field_name}` patterns
  - Concatenates `<w:t>` at paragraph level to handle cross-run text splits
- New `sanitizeCurrencyValuesFromDocx(values, docxBuffer)` in `src/core/fill-utils.ts`
  - Type-safe: only strips `$` from string values; booleans pass through
- Wired into `fillDocx()` so all three pipelines use it — replaces the old replacements-map-based approach
- Old `sanitizeCurrencyValues(values, replacements)` marked `@deprecated`

### Part 3: Drafting note stripping (new capability for templates)

- `fillDocx()` strips paragraphs matching configurable patterns before rendering
  - Default: `[/\bDrafting note\b/i]` — removes Common Paper drafting notes
  - Row-level removal: if all paragraphs in a `<w:tr>` match, the entire row is removed (avoids empty highlighted rows)
  - Pass `stripParagraphPatterns: []` to disable
- Applies to all three pipelines. For external/recipe this is a second pass after `cleaner.ts`.

### Part 4: Highlight stripping for filled fields (new capability)

- `fillDocx()` removes `<w:highlight>` elements from runs containing `{field_name}` tags when the field has a non-empty value
- Unfilled fields keep their yellow highlighting as a visual cue
- Applies to all three pipelines

### Part 5: Minimal verification for template path (NOT YET IMPLEMENTED)

- Add `verifyTemplateFill(outputPath: string): VerifyResult` — "no double dollar signs" and "no unrendered template tags" checks only
- Call in `engine.ts:fillTemplate()` after writing output — warnings only, does not throw
- Does NOT include recipe/external-only checks (leftover brackets, context values present)

## Impact

- Affected code: `src/core/engine.ts`, `src/core/external/index.ts`, `src/core/recipe/index.ts`, `src/core/fill-utils.ts`
- New code: `src/core/fill-pipeline.ts`
- New tests needed: unit tests for `detectCurrencyFields`, `sanitizeCurrencyValuesFromDocx`, `prepareFillData`, `fillDocx` (drafting notes, highlights, currency, smart quotes); integration test for template currency sanitization end-to-end; regression tests for behavioral divergence
- No new dependencies
- User-visible changes: drafting notes no longer appear in template output; yellow highlighting cleared on filled fields; `$$` currency bugs fixed
