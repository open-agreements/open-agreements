## 1. Schema

- [ ] 1.1 Add `GuidanceEntrySchema` to `src/core/metadata.ts`: `{ source: 'footnote' | 'pattern' | 'range', part: string, index: number, text: string, groupId?: string }`
- [ ] 1.2 Add `GuidanceOutputSchema` to `src/core/metadata.ts`: `{ extractedFrom: { sourceHash: string, configHash: string }, entries: GuidanceEntry[] }`

## 2. Extraction logic in cleaner

- [ ] 2.1 Change `cleanDocument()` return type from `Promise<string>` to `Promise<{ outputPath: string; guidance?: GuidanceOutput }>` with an `extractGuidance?: boolean` options parameter
- [ ] 2.2 Update all existing callers of `cleanDocument()` to use `.outputPath`
- [ ] 2.3 When `extractGuidance` is true: extract footnote text from `word/footnotes.xml` before removing, ordered by `footnoteReference` occurrence in document.xml
- [ ] 2.4 When `extractGuidance` is true: extract pattern-matched paragraph text before removing, one entry per paragraph
- [ ] 2.5 When `extractGuidance` is true: extract range-deleted paragraph text before removing, one entry per paragraph with shared `groupId` per range match
- [ ] 2.6 Each entry includes `part` (e.g. `"word/document.xml"`) and `index` (global extraction order counter)

## 3. CLI integration

- [ ] 3.1 Add `--extract-guidance <path>` flag to `recipe clean` subcommand in `src/commands/recipe.ts`
- [ ] 3.2 When flag is set, pass `extractGuidance: true` to `cleanDocument()`, compute source/config hashes, write `GuidanceOutput` as JSON to the specified path

## 4. Tests

- [ ] 4.1 Unit test: `cleanDocument` with `extractGuidance: true` returns footnote text entries
- [ ] 4.2 Unit test: `cleanDocument` with `extractGuidance: true` returns pattern-matched text entries
- [ ] 4.3 Unit test: `cleanDocument` with `extractGuidance: true` returns range-deleted text entries with groupId
- [ ] 4.4 Unit test: `cleanDocument` without `extractGuidance` returns `guidance: undefined` (backward compat)
- [ ] 4.5 Schema test: `GuidanceOutputSchema` validates well-formed guidance JSON
- [ ] 4.6 Schema test: `GuidanceOutputSchema` rejects malformed entries

## 5. Documentation

- [ ] 5.1 Add "Guidance Extraction" section to `docs/adding-recipes.md` with command example and rationale
- [ ] 5.2 Add "Design Philosophy: Guidance Extraction" subsection under Recipes in `README.md` linking to `docs/adding-recipes.md`
