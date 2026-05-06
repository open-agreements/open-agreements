# Change: Add Multiselect Field Type

## Why

Template metadata today has no first-class way to express "choose zero or
more values from an allowlisted set." Authors can either model the choice
as many separate boolean fields or accept an unvalidated free-form array.
That is awkward for template UX and makes downstream boolean gating logic
template-specific.

The upcoming due-diligence request list template needs a single
`industry_modules` field whose selected values also drive existing DOCX
conditionals such as `{IF tech_rider_enabled}`. This change adds the
engine-level multiselect primitive and a constrained `derive_booleans`
mechanism so templates can model that pattern without inventing ad hoc
compute paths.

## What Changes

- Extend field metadata with a new `type: multiselect`.
- Require multiselect fields to declare a non-empty `options` allowlist.
- Add optional `derive_booleans: true` for multiselect fields only.
- Derive `<option>_enabled` boolean keys during fill preparation from the
  selected multiselect values.
- Parse multiselect defaults and JSON-string user input into real arrays
  before priority checks, boolean coercion, and display-field computation.
- Reject metadata that would create derived-key collisions with existing
  field names or with another multiselect's derived keys.
- Reject direct `{IF <multiselect_field>}` template references because
  empty arrays are truthy in the template runtime; templates must use
  derived `<option>_enabled` keys when boolean gating is needed.
- Keep D3a wire shape stable: no production template migrations, no
  `data/templates-snapshot.json` regeneration, and no MCP payload changes.
- Widen CLI/template/recipe value typing to `Record<string, unknown>` so
  array values from JSON input files flow through cleanly.
- Filter synthetic derived keys out of `fieldsUsed` so reporting stays
  user-facing.

Non-goals:

- No production template metadata changes in this proposal.
- No snapshot regeneration.
- No MCP or remote API expansion for multiselect `options` /
  `derive_booleans`.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `src/core/metadata.ts`
  - `src/core/fill-pipeline.ts`
  - `src/core/validation/template.ts`
  - `src/core/unified-pipeline.ts`
  - `src/cli/index.ts`
  - `src/commands/fill.ts`
  - `src/commands/recipe.ts`
  - `src/core/recipe/types.ts`
  - `src/core/recipe/bracket-normalizer.ts`
  - `src/core/employment/memo.ts`
  - `docs/adding-templates.md`
  - `src/core/metadata.test.ts`
  - `integration-tests/fill-pipeline.test.ts`
  - `integration-tests/template-validation.test.ts`
