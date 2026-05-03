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
- Remove the consent-only Contract IR generator, sidecars, and related docs.

A future change will add a "modern" variant of these consents (productized
section labels, cover-page-controls override, SAFE economics surfaced as cover
sub-rows, capacity language) as a coexistent opt-in template; that work is
out of scope for this change.

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `scripts/template_renderer/*`
  - `content/templates/openagreements-board-consent-safe/*`
  - `content/templates/openagreements-stockholder-consent-safe/*`
  - `scripts/lib/catalog-data.mjs`
  - `scripts/generate_templates.mjs`
