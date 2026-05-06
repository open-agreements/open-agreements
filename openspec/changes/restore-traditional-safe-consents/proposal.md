## Why

PR #254 migrated the SAFE board and stockholder consents to canonical Markdown but, in the process, replaced the traditional Cooley/Joey-Tsang structure (no cover page, centered all-caps title, italic drafting note, opening recital, centered+bold+underlined section headings, WHEREAS/RESOLVED chain, signature stack) with a cover-table layout. The cover table is itself a modernization artifact; truly traditional Series Seed-style consents have no cover table.

Restore the traditional structure in place — same slugs, same canonical-Markdown pipeline, but rendered through a new layout module that matches Joey's reference DOCX and Cooley's open-source Series Seed source. The modern (cover-table-controlled) variant remains a separate follow-up at issue #256.

## What Changes

- Add a new layout module `traditional-consent-v1` that renders centered all-caps title, italic opening note, opening recital, centered+bold+underlined section headings (no auto-numbering), WHEREAS/RESOLVED clause bodies (with inline-bold parsing), `[Signature Page Follows]` separator, and a separate signature page with preamble paragraphs + repeating signature stack.
- Make the canonical-Markdown compiler optional-cover-aware: when a template's frontmatter omits `sections.cover_terms` and the body omits `## Cover Terms`, accept it; the contract-spec schema makes `sections.cover_terms` optional.
- Add `document.opening_note` and `document.opening_recital` frontmatter fields (optional) for traditional layouts.
- Re-author both SAFE consent `template.md` files (board + stockholder) to use the traditional structure: `layout_id: traditional-consent-v1`, version bumped to `1.2`.
- Update integration tests with OOXML structural assertions (no `<w:tbl>`, exact title text, presence of WHEREAS/RESOLVED, signer-name+date counts, no leaked Cover Terms / Governing Law / cover-page-controls strings).

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `scripts/template_renderer/canonical-source.mjs` (compiler optional-cover support)
  - `scripts/template_renderer/schema.mjs` (cover_terms made optional, opening_note + opening_recital added)
  - `scripts/template_renderer/index.mjs` (layout registry)
  - `scripts/template_renderer/layouts/traditional-consent-v1.mjs` (new)
  - `content/templates/openagreements-board-consent-safe/{template.md,metadata.yaml}`
  - `content/templates/openagreements-stockholder-consent-safe/{template.md,metadata.yaml}`
  - `integration-tests/canonical-board-consent.test.ts`
  - `integration-tests/canonical-stockholder-consent.test.ts`
