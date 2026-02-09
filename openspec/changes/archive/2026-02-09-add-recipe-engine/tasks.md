## 1. Template-Tier Fixes (Pre-Work)
- [ ] 1.1 Enable sandboxing: remove `noSandbox: true` from `src/core/engine.ts`
- [ ] 1.2 Fix template validator severity: required field mismatches push to `errors[]` in `src/core/validation/template.ts`
- [ ] 1.3 Fix output.ts: use AdmZip to extract `word/document.xml` before scanning heading styles
- [ ] 1.4 Fix extractDocxText: concatenate `<w:t>` content per-paragraph with separator between paragraphs
- [ ] 1.5 Strengthen metadata schema: enum requires non-empty `options`, defaults validate against type (`src/core/metadata.ts`)
- [ ] 1.6 Add unknown-key warning in `fillTemplate()` (`src/core/engine.ts`)
- [ ] 1.7 Fix CI license check: use PR base SHA for pull_request events (`.github/workflows/validate.yml`)
- [ ] 1.8 Remove unused `jszip` and `fast-xml-parser` from `package.json`
- [ ] 1.9 Update `openspec/project.md` tech stack: replace PizZip/fast-xml-parser with @xmldom/xmldom + AdmZip

## 2. Dependencies
- [ ] 2.1 Add `@xmldom/xmldom` to `package.json` dependencies
- [ ] 2.2 Run `npm install` and verify build

## 3. Recipe Metadata Schema
- [ ] 3.1 Add `CleanConfigSchema` and `RecipeMetadataSchema` to `src/core/metadata.ts`
- [ ] 3.2 Add `loadRecipeMetadata()` and `validateRecipeMetadata()` functions
- [ ] 3.3 Export recipe types from `src/index.ts`

## 4. Path Utilities
- [ ] 4.1 Add `getRecipesDir()` and `resolveRecipeDir()` to `src/utils/paths.ts`

## 5. Recipe Engine Core
- [ ] 5.1 Create `src/core/recipe/types.ts` — RecipeRunOptions, RecipeRunResult interfaces
- [ ] 5.2 Create `src/core/recipe/downloader.ts` — `downloadSource()` using Node 20+ fetch
- [ ] 5.3 Create `src/core/recipe/cleaner.ts` — `cleanDocument()` using AdmZip + @xmldom/xmldom
- [ ] 5.4 Create `src/core/recipe/patcher.ts` — `patchDocument()` with char_map cross-run algorithm
- [ ] 5.5 Create `src/core/recipe/verifier.ts` — `verifyOutput()` checking values, tags, brackets
- [ ] 5.6 Create `src/core/recipe/index.ts` — `runRecipe()` orchestrator

## 6. Scan Command
- [ ] 6.1 Create `src/commands/scan.ts` — placeholder discovery, classification, draft replacements.json output

## 7. Recipe CLI Commands
- [ ] 7.1 Create `src/commands/recipe.ts` — `recipe run`, `recipe clean`, `recipe patch` subcommands
- [ ] 7.2 Register recipe and scan commands in `src/cli/index.ts`

## 8. Recipe Validation
- [ ] 8.1 Create `src/core/validation/recipe.ts` — no .docx files, valid replacements.json, schema coverage, metadata/clean validation
- [ ] 8.2 Update `src/commands/validate.ts` to validate recipes alongside templates
- [ ] 8.3 Update `src/commands/list.ts` to show recipes in a separate section

## 9. Update Exports
- [ ] 9.1 Export recipe types, runRecipe, scan, recipe validation from `src/index.ts`

## 10. NVCA Voting Agreement Recipe
- [ ] 10.1 Create `recipes/nvca-voting-agreement/metadata.yaml`
- [ ] 10.2 Create `recipes/nvca-voting-agreement/replacements.json` (ported from Python prototype, 30+ entries with smart quote variants)
- [ ] 10.3 Create `recipes/nvca-voting-agreement/schema.json` (24 fields with types/descriptions)
- [ ] 10.4 Create `recipes/nvca-voting-agreement/clean.json` (removeFootnotes + drafting note patterns)
- [ ] 10.5 Create `recipes/nvca-voting-agreement/README.md`

## 11. Scaffold Directories
- [ ] 11.1 Create `recipes/nvca-certificate-of-incorporation/metadata.yaml`
- [ ] 11.2 Create `recipes/nvca-stock-purchase-agreement/metadata.yaml`
- [ ] 11.3 Create `recipes/nvca-investors-rights-agreement/metadata.yaml`
- [ ] 11.4 Create `recipes/nvca-rofr-co-sale-agreement/metadata.yaml`
- [ ] 11.5 Create `recipes/nvca-management-rights-letter/metadata.yaml` (optional: true)
- [ ] 11.6 Create `recipes/nvca-indemnification-agreement/metadata.yaml` (optional: true)

## 12. Documentation
- [ ] 12.1 Create `docs/adding-recipes.md` — recipe authoring guide (scan, replacements, clean, schema, testing)

## 13. Tests
- [ ] 13.1 Add vitest config if not present
- [ ] 13.2 Add unit tests for metadata loading (template + recipe schemas)
- [ ] 13.3 Add unit tests for template validation (error vs warning severity)
- [ ] 13.4 Add unit tests for patcher (single-run, cross-run, smart quotes)
- [ ] 13.5 Add unit tests for cleaner (footnote removal, paragraph pattern removal)
- [ ] 13.6 Add integration test: fill a template end-to-end, verify output
- [ ] 13.7 Verify `npm test` and `npm run build` pass

## 14. Verification
- [ ] 14.1 `npm run build` compiles without errors
- [ ] 14.2 `node bin/open-agreements.js list` shows templates AND recipe scaffolds
- [ ] 14.3 `node bin/open-agreements.js validate` validates all templates + recipes
- [ ] 14.4 `node bin/open-agreements.js scan` discovers placeholders from a DOCX
- [ ] 14.5 `node bin/open-agreements.js recipe run nvca-voting-agreement` fills against real NVCA doc
- [ ] 14.6 `openspec validate add-recipe-engine --strict` passes
