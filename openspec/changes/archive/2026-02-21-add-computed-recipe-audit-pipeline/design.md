## Context
Recipe rendering currently performs clean -> patch -> fill -> verify with no first-class computed interaction layer. Legal documents often encode conditional dependencies across fields (for example, delayed closing toggles additional condition sets). We need deterministic computation and traceability before rendering.

## Goals
- Provide a declarative computed layer that can derive intermediate legal state from user inputs.
- Keep compatibility: recipes without `computed.json` must behave exactly as before.
- Make computed decisions auditable through explicit rule traces and exportable artifacts.
- Enable high-detail, lawyer-readable evidence in NVCA SPA tests.

## Non-Goals
- Implement full semantic parsing of legal prose.
- Build a complete clause ontology for all templates in this change.
- Change existing replacement patching mechanics.

## Decisions
- Use an optional `computed.json` file per recipe.
- Evaluate rules in deterministic multi-pass order, stopping on fixpoint or max passes.
- Support explicit predicate operators for rules (`eq`, `neq`, `in`, `truthy`, `falsy`, `defined`).
- Allow template interpolation in assigned values (`"${field_name}"`) for derived strings.
- Emit computed artifact only when explicitly requested (`--computed-out`).

## Data Shape (high level)
- `computed.json`:
  - `version`
  - `max_passes` (optional)
  - `rules[]` with:
    - `id`, `description`
    - `when_all[]` / `when_any[]` predicates
    - `set` map of derived assignments
- Computed artifact:
  - `recipe_id`
  - `generated_at`
  - `inputs`
  - `derived_values`
  - `passes[]` with rule-level match + assignments

## Trade-offs
- Added runtime complexity in `recipe run` path, mitigated by optional profile loading.
- Multi-pass evaluation could create cycles; mitigated by bounded passes and deterministic ordering.
- More test surface area, offset by stronger traceability and confidence.

## Risks / Mitigations
- Risk: drift between computed profile and metadata/replacements.
  - Mitigation: validation + NVCA coverage tests asserting rule trace and output behavior.
- Risk: overfitting tests to exact prose.
  - Mitigation: assert short phrase fragments and structural signals, not full clause blocks.

## Migration
- Existing recipes remain unchanged.
- Recipes can adopt `computed.json` incrementally.
- CLI behavior remains backward compatible unless `--computed-out` is used.
