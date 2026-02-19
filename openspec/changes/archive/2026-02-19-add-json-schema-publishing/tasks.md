## 1. Export Zod schemas
- [x] 1.1 Export `CatalogEntrySchema` and `FormsCatalogSchema` from `catalog.ts`
- [x] 1.2 Export `ConventionConfigSchema` from `convention-config.ts`
- [x] 1.3 Re-export all three schemas from `packages/contracts-workspace/src/index.ts`
- [x] 1.4 Run `npm run build:workspace` and verify exports resolve

## 2. Add generation tooling
- [x] 2.1 Install `zod-to-json-schema` as root devDependency
- [x] 2.2 Create `scripts/generate_json_schemas.mjs` following existing `.mjs` + import-from-`dist/` pattern
  - Single canonical output to `packages/contracts-workspace/schemas/`
  - Deterministic copy to `site/schemas/`
  - Fail fast if workspace `dist/` is missing
  - Use `$refStrategy: 'none'` for portable, self-contained output
  - Set `$id` URLs under `https://openagreements.ai/schemas/`

## 3. Wire into build pipeline
- [x] 3.1 Add `"generate:schemas"` script to root `package.json`
- [x] 3.2 Update `vercel.json` `installCommand` to: `npm install && npm run build:workspace && npm run generate:schemas && npm run build:site` (removes redundant `npm run build` since `prepare` already runs it)
- [x] 3.3 Add `site/schemas` passthrough copy in `eleventy.config.js`
- [x] 3.4 Add `"schemas/"` to `files` array in `packages/contracts-workspace/package.json`
- [x] 3.5 Add `site/schemas/` and `packages/contracts-workspace/schemas/` to `.gitignore`

## 4. Testing and verification
- [x] 4.1 Add snapshot test (`packages/contracts-workspace/tests/json-schema-snapshot.test.ts`) verifying generated output for key Zod constructs: `z.literal(1)`, `z.string().regex()`, `z.record()`, `z.string().datetime()`
- [x] 4.2 Run full generation pipeline: `npm run build:workspace && npm run generate:schemas`
- [x] 4.3 Verify `site/schemas/` and `packages/contracts-workspace/schemas/` contain valid JSON Schema files
- [x] 4.4 Run `npm run build:site` and verify `_site/schemas/` output
- [x] 4.5 Run `npm run test:workspace` — all existing + new tests pass
