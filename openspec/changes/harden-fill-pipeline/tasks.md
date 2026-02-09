## 1. Currency Sanitization for Template Path (Bug Fix)

- [x] 1.1 Add `detectCurrencyFields(docxBuffer: Buffer): Set<string>` to `src/core/fill-utils.ts` — scans all general OOXML parts for `${field_name}` patterns using paragraph-level `<w:t>` concatenation
- [x] 1.2 Add `sanitizeCurrencyValuesFromDocx(values, docxBuffer)` to `src/core/fill-utils.ts` — type-safe wrapper that only strips `$` from string values (skips booleans)
- [x] 1.3 Wire currency sanitization into `fillDocx()` in `src/core/fill-pipeline.ts` so all three pipelines (template, external, recipe) use it
- [ ] 1.4 Add unit test: `detectCurrencyFields` detects field when `$` and `{field}` are split across `<w:r>` runs
- [ ] 1.5 Add unit test: `detectCurrencyFields` returns empty set for DOCX without dollar-prefixed fields
- [ ] 1.6 Add unit test: `detectCurrencyFields` scans headers, footers, and endnotes (not just `word/document.xml`)
- [ ] 1.7 Add unit test: `sanitizeCurrencyValuesFromDocx` strips `$` from string values but not booleans
- [ ] 1.8 Add integration test: template fill with `"$50,000"` for a dollar-prefixed field produces `$50,000` (not `$$50,000`)

## 2. Minimal Verification for Template Path (Safety Net)

- [ ] 2.1 Export `extractAllText` from `src/core/recipe/verifier.ts` (or add a Buffer-accepting variant) so template verification can reuse it
- [ ] 2.2 Add `verifyTemplateFill(outputPath: string): VerifyResult` to `src/core/fill-utils.ts` — runs "no double dollar signs" and "no unrendered template tags" checks only
- [ ] 2.3 Call `verifyTemplateFill` in `engine.ts:fillTemplate()` after writing output — print warnings, do not throw
- [ ] 2.4 Add unit test: `verifyTemplateFill` catches `$$50,000` in output
- [ ] 2.5 Add unit test: `verifyTemplateFill` catches `{unfilled_field}` in output
- [ ] 2.6 Add unit test: `verifyTemplateFill` passes clean output

## 3. Shared Fill Pipeline (DRY Refactor)

- [x] 3.1 Create `src/core/fill-pipeline.ts` with `prepareFillData()` and `fillDocx()`
- [x] 3.2 `prepareFillData()` handles: required-field validation, field defaults (`useBlankPlaceholder`), boolean coercion (`coerceBooleans`), display field computation (callback)
- [x] 3.3 `fillDocx()` handles: drafting note stripping (`stripParagraphPatterns`), highlight stripping for filled fields, currency sanitization via DOCX scan, `createReport` call with `fixSmartQuotes` option
- [x] 3.4 Refactor `engine.ts:fillTemplate()` to use `prepareFillData()` + `fillDocx()` from fill-pipeline
- [x] 3.5 Refactor `external/index.ts:runExternalFill()` to use `prepareFillData()` + `fillDocx()`
- [x] 3.6 Refactor `recipe/index.ts:runRecipe()` to use `prepareFillData()` + `fillDocx()`
- [ ] 3.7 Add unit test: `prepareFillData` with `useBlankPlaceholder: false` defaults to `''`, user values override
- [ ] 3.8 Add unit test: `prepareFillData` with `useBlankPlaceholder: true` defaults to `BLANK_PLACEHOLDER`, user values override
- [ ] 3.9 Add unit test: `prepareFillData` with `coerceBooleans: true` converts `"true"`→`true` and `"false"`→`false`
- [ ] 3.10 Add unit test: `prepareFillData` throws on missing required fields
- [ ] 3.11 Add unit test: `fillDocx` passes `fixSmartQuotes` option through to `createReport`
- [ ] 3.12 Add unit test: `fillDocx` strips drafting note paragraphs by default
- [ ] 3.13 Add unit test: `fillDocx` strips highlighting only from runs with filled (non-empty) fields
- [ ] 3.14 Add unit test: `fillDocx` with `stripParagraphPatterns: []` preserves all paragraphs

## 4. Deprecation Cleanup

- [ ] 4.1 Confirm `sanitizeCurrencyValues(values, replacements)` in `fill-utils.ts` is no longer called by any pipeline (recipe/external now go through `fillDocx` → `sanitizeCurrencyValuesFromDocx`)
- [ ] 4.2 If confirmed unused: remove `@deprecated` annotation and delete the function, or keep it exported for external consumers — decide and act
- [ ] 4.3 Confirm `BLANK_PLACEHOLDER` is still imported by `fill-pipeline.ts` (for highlight-stripping comparison) and that no other callers need it from `fill-utils.ts`

## 5. Regression Tests

- [ ] 5.1 Add test: template fill defaults optional fields to `''` (not `BLANK_PLACEHOLDER`)
- [ ] 5.2 Add test: recipe/external fill defaults to `BLANK_PLACEHOLDER`
- [ ] 5.3 Add test: template fill uses `fixSmartQuotes: true`; recipe/external use `false`
- [ ] 5.4 Add test: template fill coerces boolean fields; recipe/external pass strings through
- [ ] 5.5 Add test: template fill throws on missing required fields
- [ ] 5.6 Verify existing tests pass after refactor (`npm test`)
- [ ] 5.7 Add test: drafting note stripping applies to all three pipelines (was template-only concern in original design, now in shared `fillDocx`)
- [ ] 5.8 Add test: highlight stripping preserves highlights on unfilled fields, removes on filled fields
