# Change: Replace SAFE consent Contract IR with canonical Markdown

## Why
OpenAgreements now treats canonical `template.md` as the durable authoring
surface for OpenAgreements-authored branded templates. The SAFE board and
stockholder consents are the remaining branded templates on a separate
Contract IR sidecar path, which duplicates renderer plumbing and leaves a
non-canonical authoring model in the repo.

## What Changes
- Add repeat-backed stacked signer authoring to canonical `template.md`.
- Re-author the SAFE board and stockholder consents as canonical Markdown
  templates that generate `.template.generated.json` and `template.docx`.
- Add SAFE-specific cover sub-rows so non-standard economics or changes to the
  standard YC SAFE terms must be surfaced on page 1 instead of buried in the
  attached resolutions.
- Remove the consent-only Contract IR generator, sidecars, and related docs.

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `scripts/template_renderer/*`
  - `content/templates/openagreements-board-consent-safe/*`
  - `content/templates/openagreements-stockholder-consent-safe/*`
  - `scripts/lib/catalog-data.mjs`
  - `scripts/generate_templates.mjs`
