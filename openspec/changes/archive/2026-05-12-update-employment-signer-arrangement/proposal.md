# Change: Finish employment signer arrangement cleanup

## Why
Employment templates now have a partial signer-model migration. Wyoming and
Employee IP use canonical `template.md` sources with `mode: signers` and
`arrangement=entity-plus-individual`, but the renderer still ignores that
arrangement and falls back to the old side-by-side table assumptions. The offer
letter is also still on the legacy hand-authored `template.json` path, which
keeps its mirrored employer/employee title row and prevents the last
first-party employment template from using the canonical signer model.

## What Changes
- Make `cover-standard-signature-v1` honor `signers` arrangements instead of
  forcing every signer-mode template through the legacy dual-column table.
- Treat `arrangement=entity-plus-individual` as a stacked entity block followed
  by an individual block, with validation that the individual signer does not
  declare a `Title` row.
- Keep legacy `two-party` behavior unchanged, including `left_only`, for any
  non-migrated or external specs.
- Migrate `openagreements-employment-offer-letter` from legacy `template.json`
  authoring to canonical `template.md` plus committed `.template.generated.json`.
- Remove the mirrored `Title` row from the individual signer in
  `openagreements-employee-ip-inventions-assignment`.
- Ensure all first-party employment templates use the canonical signer model
  without `left_only` or mirrored individual-title rows.

## Impact
- Affected specs: `open-agreements`
- Affected code: `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`,
  `content/templates/openagreements-employment-offer-letter/`,
  `content/templates/openagreements-employee-ip-inventions-assignment/`,
  canonical-source renderer tests, and signature rendering regression tests
