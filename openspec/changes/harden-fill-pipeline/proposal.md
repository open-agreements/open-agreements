# Change: Harden fill pipeline — currency sanitization, verification, DRY helpers

## Why

The template fill path (`src/core/engine.ts`) has two gaps that the recipe/external paths don't:

1. **No currency sanitization.** If a template DOCX contains `${purchase_amount}` and the user provides `"$50,000"`, the output is `$$50,000`. The recipe/external paths sanitize via `sanitizeCurrencyValues(values, replacements)`, but templates have no `replacements.json` to scan — their `{tags}` are pre-baked in the DOCX.

2. **No post-fill verification.** Recipe and external paths run `verifyOutput()` to catch unrendered tags, double-dollar signs, and leftover placeholders. The template path writes the file and returns without any checks.

Additionally, all three fill callers duplicate the "default field values from metadata" and "call createReport" patterns. Extracting these into shared helpers reduces drift and ensures new safeguards (like currency sanitization) are easy to compose into any path.

Template content cleanup (removing drafting notes and converting bracket placeholders in committed template DOCX files) is a related but separate concern. It is scoped out of this change and should be a follow-up PR to reduce blast radius.

## What Changes

### Part 1: Currency sanitization for template path (bug fix)

- Add `detectDollarPrefixedFields(docxBuf: Buffer): Set<string>` to `src/core/fill-utils.ts`
  - Scans all general OOXML text parts (document, headers, footers, endnotes) for `${field_name}` patterns
  - Concatenates `<w:t>` at paragraph level to handle cross-run text splits (same approach as verifier)
- Call it in `engine.ts:fillTemplate()` before passing data to `createReport`
  - Only strip `$` from string values; boolean values pass through unchanged

### Part 2: Minimal verification for template path (safety net)

- Add `verifyTemplateFill(outputPath: string): VerifyResult` to `src/core/fill-utils.ts`
  - Check 1: No double dollar signs (same regex as recipe verifier)
  - Check 2: No unrendered `{template_tags}` in output
- Call it in `engine.ts:fillTemplate()` after writing the output file
- Does NOT include recipe/external-only checks (leftover brackets, context values present, drafting notes, footnotes) — those are not applicable to templates

### Part 3: Shared fill helpers (DRY refactor)

- Extract `applyFieldDefaults(metadata, values, placeholder)` to `src/core/fill-helpers.ts`
  - Parameterized by `placeholder` (`''` for templates, `BLANK_PLACEHOLDER` for external/recipe)
- Extract `renderDocx(templateBuf, data, options?) → Buffer` to `src/core/fill-helpers.ts`
  - Thin wrapper around `createReport` that returns `Buffer` instead of writing to disk
  - `options.fixSmartQuotes` defaults to `false`
- Refactor `engine.ts`, `external/index.ts`, and `recipe/index.ts` to use these helpers
- No behavioral changes — each caller retains its tier-specific logic

## Impact

- Affected code: `src/core/engine.ts`, `src/core/external/index.ts`, `src/core/recipe/index.ts`, `src/core/fill-utils.ts`
- New code: `src/core/fill-helpers.ts`
- New tests: unit tests for `detectDollarPrefixedFields`, `verifyTemplateFill`, `applyFieldDefaults`, `renderDocx`; integration test for template currency sanitization end-to-end
- No new dependencies
- No user-facing behavioral changes (same CLI, same output — except `$$` bugs are now caught)
