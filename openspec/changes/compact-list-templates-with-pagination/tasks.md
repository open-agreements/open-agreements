# Tasks

## 1. Package MCP wire-shape change

- [ ] Bump `SCHEMA_VERSION` in `packages/contract-templates-mcp/src/core/tools.ts:12` to `'2026-05-06'`.
- [ ] Extend `TemplateRecord` interface (`tools.ts:41-50`) with `display_name: string` and `priority_field_count: number`.
- [ ] Update `loadTemplates()` so it surfaces `meta.name` as `display_name` and `meta.priority_fields.length` as `priority_field_count`.
- [ ] Replace `ListTemplatesArgsSchema` (`tools.ts:15-17`) with `{ cursor?: string, limit?: number (1..100, default 25) }`.
- [ ] Update the `list_templates` `inputSchema` and description in the tool definition (`tools.ts:151-181`) — drop `mode`, add `cursor` (opaque) and `limit`.
- [ ] Replace `compactTemplate` (`tools.ts:367-373`) with the new shape `{ template_id, display_name, category, description, field_count, priority_field_count }`. Fall back `display_name` to `template_id` when empty (defense-in-depth — build-time validator is the primary guard).
- [ ] Remove the `mode === 'full'` branch from the `list_templates` invoke handler. Replace with cursor decode → slice → encode-next.
- [ ] Add `encodeCursor(template_id)` / `decodeCursor(cursor)` helpers using `Buffer.from('after:' + id).toString('base64')`. Throw a typed `InvalidCursorError` on parse failure or when the decoded id is beyond the catalog tail.
- [ ] Catch `InvalidCursorError` in the invoke handler and return `errorResult` with `INVALID_ARGUMENT`.

## 2. Hosted MCP wire-shape change

- [ ] Bump `SCHEMA_VERSION` in `api/_envelope.ts:6` to `'2026-05-06'`.
- [ ] Replace `ListTemplatesArgsSchema` (`api/mcp.ts:47-49`) — same shape as package MCP.
- [ ] Update the `list_templates` tool definition (`api/mcp.ts:160-177`) input schema.
- [ ] Update `compactTemplate` (`api/mcp.ts:512-519`) to include `category`, `description`, `priority_field_count` in addition to `display_name`. `priority_field_count = template.priority_fields.length`.
- [ ] Update the `list_templates` handler (`api/mcp.ts:803-829`) — drop the mode branch; apply the same pagination + cursor semantics as the package MCP. Return `{ templates, total_count, next_cursor }`.

## 3. Build-time validator

- [ ] Identify the existing metadata-validation surface (`npm run validate` or the metadata loader) and add a non-empty `meta.name` assertion. Verify it fails when `name` is blanked in any `metadata.yaml`.

## 4. Tests

- [ ] Rewrite `packages/contract-templates-mcp/tests/tools.test.ts` `list_templates` tests:
  - Pagination roundtrip (no duplicates, no gaps, terminal `next_cursor: null`).
  - Lexicographic continuity across page boundaries (`lastIdOfPageN.localeCompare(firstIdOfPageN+1) < 0`).
  - Compact-shape exact-keys assertion.
  - `display_name` runtime fallback to `template_id` when upstream is empty.
  - `total_count` equals catalog size on every page.
  - `limit: 0`, `limit: -1`, `limit: 101` all rejected with `INVALID_ARGUMENT`.
  - Invalid cursor rejected with `INVALID_ARGUMENT`.
  - `mode: "full"` rejected with `INVALID_ARGUMENT`.
- [ ] Update `integration-tests/mcp-contract.test.ts`:
  - OA-DST-032 body: drop "compact and full" assertion; add pagination envelope assertion.
  - Replace the `compact and full payload modes` test with the new shape + pagination assertions.
  - Drop the `full mode includes display_name` test — `display_name` lives on the (only) compact shape now.
- [ ] Bind the new package tests to `OA-DST-054` … `OA-DST-060`.

## 5. Docs

- [ ] Update `docs/mcp-migration-v2.md` — drop `list_templates` Modes section; describe compact-only paginated output with `cursor`/`limit` and `total_count`/`next_cursor`.
- [ ] Update `docs/examples/mcp-client-python.md` — change the `tools/call` example to use `arguments: {"limit": 5}` and demonstrate paging via the returned cursor.
- [ ] Update `skills/open-agreements/SKILL.md` — describe compact-only paginated `list_templates`.
- [ ] Spot-check `skills/{open-agreements,safe,nda,cloud-service-agreement,shared}/template-filling-execution.md` for `mode` references and update.

## 6. Spec deltas

- [ ] Author `openspec/changes/compact-list-templates-with-pagination/specs/open-agreements/spec.md`:
  - **MODIFIED `OA-DST-032`** — replace the "compact and full payload modes are supported for list_templates" bullet with a pagination envelope bullet.
  - **ADDED Requirement: MCP list_templates Returns Paginated Compact Catalog** with scenarios `OA-DST-054` … `OA-DST-060`.
- [ ] Verify ID availability: existing ceiling is `OA-DST-053` in `2026-04-25-add-mcp-rate-limiting`.

## 7. Traceability

- [ ] Run `npm run check:spec-coverage`. Verify regenerated `integration-tests/OPENSPEC_TRACEABILITY.md` shows `OA-DST-054` … `OA-DST-060` as covered and OA-DST-032 still passes.

## 8. Validation

- [ ] `npx openspec validate compact-list-templates-with-pagination --strict`.
- [ ] `npm run build`.
- [ ] `npm run validate` (CLI metadata validator + new `display_name` assertion).
- [ ] `npm test` (vitest + integration suite).
- [ ] Manual MCP smoke (package MCP via stdio + hosted MCP via `vercel dev`): `list_templates` with `limit: 5`, page through using returned cursor, send `mode: "full"` and assert `INVALID_ARGUMENT`.
