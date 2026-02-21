## 1. Spec and Validation
- [x] 1.1 Add OpenSpec deltas for computed recipe profiles, artifact export, and NVCA interaction coverage
- [x] 1.2 Run `openspec validate add-computed-recipe-audit-pipeline --strict`

## 2. Runtime Implementation
- [x] 2.1 Add computed profile schema/types and evaluator in `src/core/recipe/`
- [x] 2.2 Load optional `computed.json` in recipe runtime and merge derived values before fill
- [x] 2.3 Add computed artifact generation in `runRecipe`
- [x] 2.4 Add `--computed-out <path>` plumbing in CLI and command handlers
- [x] 2.5 Validate `computed.json` in recipe validation when present

## 3. NVCA Profile + Tests
- [x] 3.1 Add `recipes/nvca-stock-purchase-agreement/computed.json` with interaction rules
- [x] 3.2 Add unit tests for evaluator behavior (conditions, interpolation, multi-pass trace)
- [x] 3.3 Expand NVCA SPA tests to assert computed artifact content and interaction trace
- [x] 3.4 Keep NVCA Allure evidence inline and readable (no NVCA-specific file attachments)

## 4. Verification
- [x] 4.1 Run `npm run test:run`
- [x] 4.2 Generate Allure report and sanity check NVCA computed evidence
- [x] 4.3 Mark tasks complete
