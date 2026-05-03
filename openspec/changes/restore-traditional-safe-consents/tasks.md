## 1. Layout + compiler

- [x] 1.1 Add `scripts/template_renderer/layouts/traditional-consent-v1.mjs`.
- [x] 1.2 Register the layout in `scripts/template_renderer/index.mjs`.
- [x] 1.3 Make `cover_terms` optional in `scripts/template_renderer/schema.mjs`.
- [x] 1.4 Make the canonical compiler accept templates without `## Cover Terms` and without `sections.cover_terms` frontmatter (`scripts/template_renderer/canonical-source.mjs`).
- [x] 1.5 Add `document.opening_note` and `document.opening_recital` frontmatter fields to the schema.

## 2. Template authoring

- [x] 2.1 Re-author `content/templates/openagreements-board-consent-safe/template.md` for the traditional structure (`layout_id: traditional-consent-v1`).
- [x] 2.2 Re-author `content/templates/openagreements-stockholder-consent-safe/template.md` matching the board structure with § 228 prefatory paragraph and `stockholders` array.
- [x] 2.3 Bump both `metadata.yaml` files from `1.1` to `1.2`.

## 3. Tests + spec

- [x] 3.1 Retarget `integration-tests/canonical-board-consent.test.ts` with OOXML structural assertions (no `<w:tbl>`, exact title text, WHEREAS/RESOLVED presence, signer-name+date counts, no leaked Cover Terms strings).
- [x] 3.2 Retarget `integration-tests/canonical-stockholder-consent.test.ts` similarly.
- [x] 3.3 Add new OpenSpec scenarios (OA-TMP-040, -041, -042).

## 4. Verification

- [x] 4.1 `node scripts/generate_templates.mjs`
- [x] 4.2 `npm run build` (TypeScript)
- [x] 4.3 `npx vitest run integration-tests/canonical-board-consent.test.ts integration-tests/canonical-stockholder-consent.test.ts`
- [ ] 4.4 `openspec validate restore-traditional-safe-consents --strict`
- [ ] 4.5 Visual smoke check against Joey's reference DOCX
