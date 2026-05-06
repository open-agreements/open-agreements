## 1. Plumb `allow_derivatives` into snapshot projection
- [x] 1.1 Add `allow_derivatives: boolean` to `TemplateListItem` in `src/core/template-listing.ts`
- [x] 1.2 Emit `allow_derivatives` in `src/commands/list.ts` for internal, external, and recipe tiers (recipes default `false`)
- [x] 1.3 Regenerate `data/templates-snapshot.json`
- [x] 1.4 Verify snapshot via `node bin/open-agreements.js list --json | jq '.items[] | select(.name=="openagreements-board-consent-safe")'`

## 2. Rename Contract IR canonical source filename
- [x] 2.1 `git mv` `openagreements-board-consent-safe/content.md` → `template.md`
- [x] 2.2 `git mv` `openagreements-stockholder-consent-safe/content.md` → `template.md`
- [x] 2.3 Update `scripts/contract_ir/index.mjs` to read `template.md`
- [x] 2.4 Update `scripts/lib/catalog-data.mjs`: Contract IR detection via `template.md + schema.yaml + styles.yaml`; markdown download branches on Contract IR first, then direct copy
- [x] 2.5 Update `integration-tests/contract-ir-board-consent.test.ts` fixture filename
- [x] 2.6 Update `integration-tests/contract-ir-stockholder-consent.test.ts` fixture filename
- [x] 2.7 Update READMEs for both SAFE consent templates
- [x] 2.8 Update `docs/contract-ir-safe-board-consent.md`

## 3. Update spec
- [x] 3.1 Modify `OA-TMP-029` scenario text so the Contract IR loader is described as reading `template.md`

## 4. Validate
- [ ] 4.1 `openspec validate rename-contract-ir-content-to-template --strict`
- [ ] 4.2 `npm run build && npx vitest run integration-tests/contract-ir-board-consent.test.ts integration-tests/contract-ir-stockholder-consent.test.ts`
- [ ] 4.3 `node scripts/export-templates-snapshot.mjs --check`
