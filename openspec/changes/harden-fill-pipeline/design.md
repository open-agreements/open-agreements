## Context

The codebase has three fill pipelines:

| Concern | Template (`engine.ts`) | External (`external/index.ts`) | Recipe (`recipe/index.ts`) |
|---------|----------------------|-------------------------------|---------------------------|
| Source DOCX | Local, pre-baked `{tags}` | Local, unmodified | Downloaded at runtime |
| Clean/Patch | No | Yes | Yes |
| Required-field enforcement | Yes (throws on missing) | No | No |
| Default placeholder | `''` (empty string) | `BLANK_PLACEHOLDER` (`'_______'`) | `BLANK_PLACEHOLDER` |
| Boolean coercion | Yes (field.type metadata) | No (string-only values) | No (string-only values) |
| Display field computation | Yes (`computeDisplayFields`) | No | No |
| Unknown-key warnings | Yes | No | No |
| `fixSmartQuotes` | Yes | No | No |
| Currency sanitization | **No (BUG)** | Yes (from `replacements.json`) | Yes (from `replacements.json`) |
| Post-fill verification | **No (MISSING)** | Yes (`verifyOutput`) | Yes (`verifyOutput`) |
| Drafting note stripping | No | No (uses `cleaner.ts` pre-patch) | No (uses `cleaner.ts` pre-patch) |
| Highlight stripping | No | No | No |

The two gaps in the template path (currency sanitization, post-fill verification) are the primary motivation. The DRY refactor is a secondary goal that makes the fix composable and brings drafting note stripping and highlight stripping to all pipelines as shared concerns.

## Goals / Non-Goals

### Goals

- Fix the currency double-dollar bug in the template fill path
- Add a safety-net verification step to the template fill path
- Extract a shared fill pipeline (`prepareFillData` + `fillDocx`) to reduce code duplication
- Move drafting note stripping and highlight stripping into the shared `fillDocx` so all three pipelines benefit
- Preserve behavioral differences between tiers via config flags (placeholders, smart quotes, booleans)

### Non-Goals

- Unifying clean/patch/verify orchestration into the shared module (those stay per-caller)
- Template content cleanup of committed DOCX files (bracket placeholders, etc.) — separate PR
- Changing placeholder behavior (`''` vs `BLANK_PLACEHOLDER`) — preserve divergence
- Adding boolean coercion or display fields to external/recipe — not needed

## Decisions

### 1. Two-function shared pipeline (`prepareFillData` + `fillDocx`)

- **Decision**: Create `src/core/fill-pipeline.ts` exporting `prepareFillData()` and `fillDocx()`. Each caller composes these with its tier-specific orchestration (clean/patch/verify/temp dirs).
- **Why not pure helpers**: The data-preparation step and the DOCX-rendering step each involve multiple sub-concerns that always run together (defaults + booleans + display fields; stripping + sanitization + createReport). Splitting these into 6+ tiny helpers would just scatter the logic. Two composable functions with config options is the right granularity.
- **Why not a single end-to-end pipeline**: Templates don't clean or patch. External/recipe don't coerce booleans or compute display fields. A single function would need too many conditional branches. The split at "prepare data" vs "render DOCX" is a natural seam — callers own everything before and after.

**`prepareFillData(options): Record<string, string | boolean>`**

Handles the data-normalization steps that differ by tier:

```ts
export interface PrepareFillDataOptions {
  values: Record<string, string | boolean>;
  fields: FieldDefinition[];
  useBlankPlaceholder?: boolean;   // false → '', true → BLANK_PLACEHOLDER
  coerceBooleans?: boolean;        // template: true, others: false
  computeDisplayFields?: (data: Record<string, string | boolean>) => void;
}
```

Steps (in order):
1. Validate required fields (throws if missing) — applies to all tiers, but external/recipe pass all-optional metadata so this is effectively template-only
2. Apply defaults for unset fields using `field.default ?? placeholder`
3. Coerce boolean-typed fields (`"true"` → `true`, anything else → `false`) if `coerceBooleans` is set
4. Call `computeDisplayFields` callback if provided (template-specific)

Design rationale:
- `useBlankPlaceholder` parameterizes the one axis that truly varies between tiers
- `coerceBooleans` is a flag rather than auto-detecting from `field.type` because external/recipe values are always strings — the flag keeps the caller in control
- `computeDisplayFields` is a callback rather than built-in logic because it references template-specific field names (e.g. `order_date_display`) that don't belong in a shared module
- Required-field validation is always-on but harmless for external/recipe since their metadata can mark all fields optional

**`fillDocx(options): Promise<Uint8Array>`**

Handles DOCX-level transformations and rendering:

```ts
export interface FillDocxOptions {
  templateBuffer: Buffer;
  data: Record<string, string | boolean>;
  fixSmartQuotes?: boolean;               // template: true, others: false
  stripParagraphPatterns?: RegExp[];      // default: [/\bDrafting note\b/i]
}
```

Steps (in order):
1. **Strip drafting note paragraphs** — removes paragraphs matching `stripParagraphPatterns` from the DOCX buffer. If a matched paragraph is the only content in a table row, the entire `<w:tr>` is removed to avoid empty highlighted rows. Default pattern: `/\bDrafting note\b/i`. Pass `[]` to disable.
2. **Strip highlighting from filled fields** — removes `<w:highlight>` elements from runs whose `{tag}` corresponds to a non-empty, non-placeholder value. Unfilled fields keep their yellow highlight as a visual cue.
3. **Sanitize currency values** — calls `sanitizeCurrencyValuesFromDocx(data, templateBuffer)` to strip leading `$` from values where the DOCX has `$` before `{field_name}`. This replaces the old `sanitizeCurrencyValues(values, replacements)` approach — it works for all pipelines because it scans the DOCX buffer directly.
4. **Render** — calls `createReport()` with `cmdDelimiter: ['{', '}']` and the configured `fixSmartQuotes` option. Returns the filled buffer as `Uint8Array`.

Design rationale:
- Returns `Uint8Array` (the type `createReport` returns) rather than writing to disk. Each caller decides where to put the result — `engine.ts` writes to `outputPath` directly, external/recipe write to a temp dir.
- Drafting note stripping in `fillDocx` means all three pipelines get it automatically. For external/recipe, this is in addition to `cleaner.ts` (which runs pre-patch on the raw DOCX); `fillDocx` strips any notes that survived patching or were in the post-patch template.
- Highlight stripping is a new capability that all three pipelines gain. It checks each run's text for `{field_name}` tags, looks up whether that field has a non-empty value in `data`, and only strips `<w:highlight>` if so.
- Currency sanitization is now DOCX-buffer-based for all pipelines, replacing the replacements-map-based approach for external/recipe too. This is strictly more correct — it scans what the template actually contains rather than relying on the replacements map as a proxy.

### 2. Currency sanitization via OOXML scanning

- **Decision**: Add `detectCurrencyFields(docxBuffer: Buffer): Set<string>` and `sanitizeCurrencyValuesFromDocx(values, docxBuffer)` to `src/core/fill-utils.ts`. Wire into `fillDocx()` so all three pipelines use it.
- **Why**: Templates don't have a `replacements.json`, so the old `sanitizeCurrencyValues(values, replacements)` couldn't be used. Rather than adding a template-only fix, scanning the DOCX buffer directly works for all pipelines and is the single source of truth.
- **Scanning approach**:
  - Concatenates `<w:t>` elements at paragraph level (same approach as `verifier.ts:extractAllText`)
  - Scans all general OOXML parts via `enumerateTextParts()` + `getGeneralTextPartNames()` — covers document, headers, footers, endnotes
  - Pattern: `/\$\{(\w+)\}/g`
- **Known limitation**: `<w:tab/>` or `<w:br/>` elements between `$` and `{field}` would cause a false negative, because these elements are not in `<w:t>`. This is the same limitation the verifier has. Acceptable because `$` and `{tag}` are always adjacent in practice, and the post-fill double-dollar check (in verifier) catches any misses.
- **Type safety**: `sanitizeCurrencyValuesFromDocx` accepts `Record<string, string | boolean>`. Only strips `$` from values where `typeof v === 'string'`. Boolean values pass through unchanged.
- **Old function**: `sanitizeCurrencyValues(values, replacements)` is marked `@deprecated`. It is no longer called by any pipeline — all three now go through `fillDocx()` → `sanitizeCurrencyValuesFromDocx()`. Pending decision: remove it or keep it for external consumers.

### 3. Drafting note stripping in `fillDocx`

- **Decision**: `fillDocx` strips paragraphs matching configurable patterns before rendering. Default: `[/\bDrafting note\b/i]`.
- **Why in `fillDocx` rather than only in `cleaner.ts`**:
  - Templates have pre-baked `{tags}` and never go through `cleaner.ts`. Drafting notes in template DOCX files (e.g. Common Paper's `[Drafting note: ...]`) were previously left in the output.
  - For external/recipe, `cleaner.ts` runs on the raw DOCX pre-patch. If any drafting notes survive patching, `fillDocx` catches them as a second pass.
- **Row-level removal**: If a matched paragraph is the only meaningful content in a `<w:tr>` (all other paragraphs are empty), the entire row is removed. This avoids empty highlighted rows in Common Paper table-based templates. The `isRowOnlyDraftingNotes` helper checks all paragraphs in the row against the patterns.
- **Opt-out**: Pass `stripParagraphPatterns: []` to disable. External/recipe callers currently use the default.

### 4. Highlight stripping for filled fields

- **Decision**: `fillDocx` removes `<w:highlight>` elements from runs containing `{field_name}` tags when the corresponding field has a non-empty value. Unfilled fields keep their yellow highlighting.
- **Why**: Many Common Paper templates use yellow highlighting on fill-in fields as a visual cue. Once a field is filled, the highlighting is noise. But unfilled optional fields should keep it so the user knows what still needs attention.
- **Detection**: For each `<w:r>` element that has a `<w:highlight>` in its `<w:rPr>`, extract the run's text and match `{field_name}` tags. A field is considered "filled" if its value is a non-empty string that isn't `BLANK_PLACEHOLDER`, or if it's a boolean (always filled).
- **Scope**: Applies to all general OOXML parts (document, headers, footers, endnotes).

### 5. Minimal template verification (NOT YET IMPLEMENTED)

- **Decision**: Add `verifyTemplateFill(outputPath: string)` that runs two checks:
  1. **No double dollar signs** — same regex as recipe verifier (`/\$[\s\u00A0\t]*\$/`)
  2. **No unrendered template tags** — `{field_name}` patterns left in output

- **Why NOT other checks**:
  - "No leftover `[bracket]` placeholders" — templates don't use brackets; no `replacements` map to reference
  - "Context values present" — templates use `{IF}` conditionals and computed display fields, so not all user values appear literally in output; false positives are likely
  - "Drafting notes removed" — `fillDocx` now strips these, so a verifier check could be added but is lower priority
  - "Footnotes removed" — templates may have legitimate footnotes

- **Behavior**: Warnings only (same as recipe/external). Does not throw or block output.

- **Implementation**: Reuses `extractAllText` logic from `verifier.ts` (paragraph-level `<w:t>` concatenation across all general OOXML parts). Preferred approach: export `extractAllText` from `verifier.ts` rather than duplicating.

### 6. Preserve behavioral divergence (no breaking changes)

- **Placeholder behavior**: Templates default to `''` (empty string); external/recipe default to `BLANK_PLACEHOLDER` (`'_______'`).
  - **Preserve divergence.** Template fill is interactive (user provides all fields). External/recipe fill can be partial (some legal fields intentionally left blank). Visible underscores signal "this needs attention."
  - **User-visible impact if unified**: Every unfilled optional template field would show `_______` instead of blank space. This would break existing template output expectations.

- **`fixSmartQuotes`**: Template uses `true`; external/recipe use `false` (default).
  - **Keep as-is.** Templates have `{tags}` pre-baked in DOCX. If a user re-saves the template in Word, smart quotes could corrupt tags. External/recipe inject tags at runtime via the patcher — they never pass through Word's smart-quote conversion.

### 7. Template content cleanup is a separate change

- **Decision**: Do NOT include template content cleanup (bracket placeholder conversion in committed DOCX files) in this PR. Drafting note *stripping at runtime* is included (Decision 3), but modifying the committed DOCX sources is separate.
- **Why**:
  - Different risk profile: modifying committed DOCX files vs refactoring TypeScript code
  - Different review process: legal content review vs code review
  - Different rollback: revert DOCX files vs revert code
- **Recommendations for the follow-up change** (documented here for continuity):
  - For bracket placeholders: auto-replace only exact known fill-in patterns (`[____]`, `[$__________]`, `[Fill in …]`). Generate a report for ambiguous bracketed legal text.
  - Do NOT touch checkbox markers (`[ x ]`, `[x]`) or parenthetical markers (`( x )`, `(x)`).
  - Build a one-time audit script that produces per-template counts, a review list of unmatched bracket strings, and before/after verification.

## How Callers Use the Pipeline

### Template path (`engine.ts:fillTemplate`)

```ts
const data = prepareFillData({
  values,
  fields: metadata.fields,
  useBlankPlaceholder: false,       // '' for unfilled optional fields
  coerceBooleans: true,             // "false" → false for {IF} conditions
  computeDisplayFields: (d) => computeDisplayFields(d, fieldNames),
});

const output = await fillDocx({
  templateBuffer: templateBuf,
  data,
  fixSmartQuotes: true,             // protect against smart-quoted {tags}
  // stripParagraphPatterns: default [/\bDrafting note\b/i]
});

writeFileSync(outputPath, output);
```

Caller retains: metadata loading, unknown-key warnings, writing output to `outputPath`.

### External path (`external/index.ts:runExternalFill`)

```ts
const fillData = prepareFillData({
  values,
  fields: metadata.fields,
  useBlankPlaceholder: true,        // BLANK_PLACEHOLDER for unfilled fields
  // coerceBooleans: false (default)
  // computeDisplayFields: none
});

const filledBuf = await fillDocx({
  templateBuffer: templateBuf,       // post-patch buffer
  data: fillData,
  // fixSmartQuotes: false (default)
  // stripParagraphPatterns: default
});
```

Caller retains: SHA-256 integrity check, clean/patch stages, `verifyOutput()`, temp dir management, redistribution warning.

### Recipe path (`recipe/index.ts:runRecipe`)

Same as external, with download instead of integrity check.

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Currency scan false negative (`<w:tab/>` between `$` and `{tag}`) | Low | Medium — double-dollar in output | Post-fill double-dollar check catches it as a warning |
| `detectCurrencyFields` false positive (legal text containing `${word}`) | Very Low | Low — strips leading `$` from a non-currency field that starts with `$` | Only affects fields whose name matches a `\w+` pattern AND whose value starts with `$`; extremely unlikely for legal text |
| Drafting note stripping removes non-note content | Very Low | Medium — paragraph deleted from output | Pattern `/\bDrafting note\b/i` is narrow; word-boundary prevents matching "Redrafting notice" etc. Row removal requires ALL paragraphs to match. |
| Highlight stripping removes intentional highlighting | Low | Low — cosmetic only, no content loss | Only strips from runs containing `{field_name}` tags with filled values; other highlighted content is untouched |
| Behavioral regression from refactor (placeholder, smart quotes) | Low | High if it happens | Explicit tests for each behavioral axis; refactor is mechanical |
| Old `sanitizeCurrencyValues` removed while external consumers depend on it | Low | Medium — breaking API change | Confirm no external imports before removing; keep exported if needed |
| Template verification false positive (legitimate `{word}` in legal text) | Very Low | Low — warning only, does not block output | Pattern requires `[a-z_]` start + `[a-z0-9_]*` body, unlikely in legal prose |

## Test Plan

### Unit tests — currency sanitization

1. **`detectCurrencyFields`** — test DOCX where `$` and `{field_name}` are split across `<w:r>` runs. Verify the field is detected via paragraph-level `<w:t>` concatenation.
2. **`detectCurrencyFields`** — test DOCX with no dollar-prefixed fields. Returns empty set.
3. **`detectCurrencyFields`** — scans headers/footers/endnotes, not just `word/document.xml`.
4. **`sanitizeCurrencyValuesFromDocx`** — strips `$` from string values, passes booleans through unchanged.

### Unit tests — `prepareFillData`

5. **Defaults** — `useBlankPlaceholder: false` defaults optional fields to `''`, user values override.
6. **Defaults** — `useBlankPlaceholder: true` defaults optional fields to `BLANK_PLACEHOLDER`, user values override.
7. **Boolean coercion** — `coerceBooleans: true` converts `"true"` → `true`, `"false"` → `false`.
8. **Required fields** — throws on missing required fields.

### Unit tests — `fillDocx`

9. **Smart quotes** — `fixSmartQuotes: true` is passed through to `createReport`.
10. **Drafting note stripping** — paragraphs matching default pattern are removed.
11. **Drafting note row removal** — table row removed when all paragraphs are drafting notes.
12. **Drafting note opt-out** — `stripParagraphPatterns: []` preserves all paragraphs.
13. **Highlight stripping** — `<w:highlight>` removed from runs with filled fields, preserved on unfilled.

### Unit tests — template verification (not yet implemented)

14. **`verifyTemplateFill`** — catches `$$50,000` in output.
15. **`verifyTemplateFill`** — catches `{unfilled_field}` in output.
16. **`verifyTemplateFill`** — passes clean output with no warnings.

### Integration tests

17. **Template pipeline end-to-end**: Fill a template containing `${purchase_amount}` with value `"$50,000"`. Verify output contains `$50,000` (not `$$50,000`). **This test would have caught the original bug.**
18. **Recipe pipeline unchanged**: Fill a recipe with currency values. Verify output matches current behavior.
19. **External pipeline unchanged**: Fill an external template with currency values. Verify output matches current behavior.

### Regression tests

20. **Placeholder behavior**: Template fill defaults optional fields to `''` (not `BLANK_PLACEHOLDER`).
21. **`fixSmartQuotes`**: Template fill uses `fixSmartQuotes: true`; recipe/external use `false`.
22. **Boolean coercion**: Template fill coerces `"false"` → `false`; recipe/external do not.
23. **Required-field enforcement**: Template fill throws on missing required fields.
24. **Drafting note stripping**: Applied to all three pipelines via `fillDocx` default.
25. **Highlight stripping**: Applied to all three pipelines.

## Open Questions

1. **Remove or keep `sanitizeCurrencyValues(values, replacements)`?** — It is `@deprecated` and no longer called by any internal pipeline. If the package has external consumers importing it, it should stay exported. If not, remove it to avoid confusion. Needs an import check before deciding.
