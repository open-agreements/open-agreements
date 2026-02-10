## 1. Extraction logic in cleaner

- [ ] 1.1 Define `GuidanceEntry` type: `{ source: 'footnote' | 'comment' | 'pattern' | 'range', index: number, text: string }`
- [ ] 1.2 Define `GuidanceOutput` type: `{ extractedFrom: string, entries: GuidanceEntry[] }` (where `extractedFrom` records the source document identifier or hash for staleness detection)
- [ ] 1.3 Add `extractGuidance` option to `cleanDocument()` that collects removed text before deletion
- [ ] 1.4 Extract footnote text from `word/footnotes.xml` before removing (iterate `<w:footnote>` elements, collect paragraph text from each)
- [ ] 1.5 Extract pattern-matched paragraph text before removing
- [ ] 1.6 Extract range-deleted paragraph text before removing (group paragraphs per range, join text)
- [ ] 1.7 Return `GuidanceOutput` from `cleanDocument()` when extraction is requested

## 2. Persistence and schema

- [ ] 2.1 Add `GuidanceEntrySchema` and `GuidanceOutputSchema` to `src/core/metadata.ts` (Zod schemas for validation)
- [ ] 2.2 Write `guidance.json` to recipe directory after clean step produces extraction
- [ ] 2.3 Add `guidance.json` to recipe validation as optional (valid if present and schema-conformant, not required)

## 3. Recipe pipeline integration

- [ ] 3.1 Wire extraction into `recipe clean` subcommand — when `--extract-guidance` flag is set, write `guidance.json` alongside output
- [ ] 3.2 Generate `guidance.json` for `nvca-indemnification-agreement` as the reference example

## 4. Tests

- [ ] 4.1 Unit test: `cleanDocument` with extraction enabled returns footnote text
- [ ] 4.2 Unit test: `cleanDocument` with extraction enabled returns pattern-matched text
- [ ] 4.3 Unit test: `cleanDocument` with extraction enabled returns range-deleted text
- [ ] 4.4 Unit test: `cleanDocument` without extraction enabled returns no guidance (backward compat)
- [ ] 4.5 Schema test: `GuidanceOutputSchema` validates well-formed guidance.json
- [ ] 4.6 Integration test: `recipe clean --extract-guidance` writes guidance.json with expected entries

## 5. Documentation

- [ ] 5.1 Add "Guidance Extraction" section to `docs/adding-recipes.md` explaining the feature and its rationale
- [ ] 5.2 After implementation is merged, add a section to `README.md` or project docs explaining the design philosophy (programmatic extraction, trustworthiness, maintainability) for the open-source audience
