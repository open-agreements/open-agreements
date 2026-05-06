# Tasks

## 1. Projection
- [x] 1.1 Add `options?: string[]` to `TemplateListField` in `src/core/template-listing.ts`
- [x] 1.2 Conditional-spread `options` on enum fields in `mapFields()` with defensive shallow copy

## 2. Type mirrors
- [x] 2.1 Add `options?: string[]` to `TemplateField` in `packages/contract-templates-mcp/src/core/tools.ts`
- [x] 2.2 Add `options?: string[]` to `TemplateItem.fields[]` in `api/_shared.ts`
- [x] 2.3 Add `options?: string[]` to `normalizedTemplate()` parameter shape in `api/mcp.ts`
- [x] 2.4 Add `options?: string[]` to `TemplateMeta.fields` in `integration-tests/list-command.inprocess.test.ts`

## 3. Tests
- [x] 3.1 Add `OA-DST-054` — `get_template` returns `options` for enum fields (real template, dynamic assertion)
- [x] 3.2 Add `OA-DST-055` — `get_template` omits `options` for non-enum field types
- [x] 3.3 Add `OA-CLI-025` — CLI `list --json` includes `options` for enum fields, omits for non-enum types
- [x] 3.4 Add hosted MCP assertion in `integration-tests/mcp-contract.test.ts` (bound to `OA-DST-054`) that hosted `get_template` preserves `options` and omits for non-enum fields. (`integration-tests/api-shared.test.ts` does not exist in this repo; the existing `api-endpoints.test.ts` mocks `handleListTemplates`, so hosted shared-service coverage flows through `mcp-contract.test.ts` and the package-level `tools.test.ts` instead.)
- [x] 3.5 A2A coverage: `api/a2a.ts:63` calls `handleListTemplates()` from `_shared.js` with no surface-specific transformation. Coverage is inherited via the package-level + CLI tests; no new A2A scenario binding required.

## 4. Snapshot + verification
- [x] 4.1 Regenerate `data/templates-snapshot.json` (`node scripts/export-templates-snapshot.mjs`) — 44 templates exported, +288/-55 line diff.
- [x] 4.2 Verify snapshot freshness (`node scripts/export-templates-snapshot.mjs --check`) — passes.
- [x] 4.3 `npm run lint && npx tsc --noEmit && SKIP_GCLOUD_TESTS=1 npx vitest run` — clean (802 passed, 10 skipped).
- [x] 4.4 `openspec validate expose-options-on-field-projection --strict` — passes.
