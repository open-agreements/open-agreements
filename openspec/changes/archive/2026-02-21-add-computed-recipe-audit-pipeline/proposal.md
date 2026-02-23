# Change: Add Computed Recipe Audit Pipeline

## Why
Current recipe filling verifies placeholder replacement and structural validity, but it does not model cross-field legal interactions as explicit computed state. For high-stakes agreements like NVCA SPA, we need deterministic, inspectable intermediate computation that captures how interacting parameters produce downstream clauses and legal outcomes.

## What Changes
- Add optional per-recipe `computed.json` profiles that declare interaction rules and computed outputs.
- Evaluate computed rules during `recipe run` and merge computed outputs into fill data.
- Add `--computed-out` to export a machine-readable computed artifact (inputs, derived values, rule trace, run metadata).
- Validate `computed.json` schema when present.
- Add NVCA SPA computed profile and interaction-focused tests with detailed inline Allure evidence.

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `src/core/recipe/*` (new computed evaluator and runtime wiring)
  - `src/commands/recipe.ts`, `src/cli/index.ts` (CLI option)
  - `src/core/validation/recipe.ts` (computed profile validation)
  - `recipes/nvca-stock-purchase-agreement/computed.json` (new profile)
  - `tests/nvca-spa-template.test.ts`, plus new unit tests
