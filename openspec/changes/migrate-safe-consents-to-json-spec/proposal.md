# Change: Migrate SAFE consents onto colocated JSON specs

## Why
`dev-website` now renders rich OpenAgreements pages from colocated JSON specs.
The SAFE board consent and SAFE stockholder consent still only expose the older
Contract IR authoring path, so they fall off the rich-rendering path and keep a
separate template-generation implementation.

## What Changes
- Add JSON-renderer support for loop-backed stacked signature blocks so consent
  templates can preserve variable signer counts in generated DOCX output.
- Migrate `openagreements-board-consent-safe` and
  `openagreements-stockholder-consent-safe` to hand-authored `template.json`
  specs with regenerated `template.docx` and `template.md` artifacts.
- Retire the consent-specific Contract IR source files and update fidelity,
  fill, and discovery tests to the JSON-spec path.

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `scripts/generate_templates.mjs`
  - `scripts/template_renderer/*`
  - `content/templates/openagreements-board-consent-safe/*`
  - `content/templates/openagreements-stockholder-consent-safe/*`
  - relevant integration tests
