## 1. Schema

- [x] 1.1 Add `display_label?: string` to `FieldDefinition` and
      `FieldDefinitionSchema` in `src/core/metadata.ts`
- [x] 1.2 Add a positive parse test for `display_label` in
      `src/core/metadata.test.ts`

## 2. CLI projection

- [x] 2.1 Add `display_label?: string` to `TemplateListField` in
      `src/core/template-listing.ts`
- [x] 2.2 Use a conditional spread in `mapFields()` so the key is omitted
      when undefined (no `null` on the wire)
- [x] 2.3 Assert key omission for unlabeled top-level fields and nested
      `items` in `integration-tests/list-command.inprocess.test.ts`

## 3. MCP type alignment

- [x] 3.1 Mirror `display_label?: string` on the contract-templates MCP
      `TemplateField` interface (type-only; no tool description change)

## 4. Curation

- [x] 4.1 Populate `display_label` on every user-facing field of
      `content/templates/openagreements-restrictive-covenant-wyoming/metadata.yaml`
- [x] 4.2 Confirm AI-only fields (`worker_category`, `restriction_pathways`)
      and internal computed fields (`cloud_drive_id_footer`) do NOT carry
      a `display_label`

## 5. Snapshot

- [ ] 5.1 Regenerate `data/templates-snapshot.json` via
      `node scripts/export-templates-snapshot.mjs`
- [ ] 5.2 Confirm `node scripts/export-templates-snapshot.mjs --check`
      passes

## 6. Validation

- [ ] 6.1 `openspec validate add-template-display-labels --strict` passes
- [ ] 6.2 `npm run build` passes
- [ ] 6.3 Targeted vitest run passes:
      `npx vitest run src/core/metadata.test.ts integration-tests/list-command.inprocess.test.ts packages/contract-templates-mcp/tests/tools.test.ts`
