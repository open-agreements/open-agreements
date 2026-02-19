# Change: Publish JSON Schema files derived from Zod schemas

## Why
The project has Zod schemas that validate agent-facing YAML config files (`forms-catalog.yaml`, `.contracts-workspace/conventions.yaml`), but these schemas are only accessible at runtime through the MCP `tools/list` endpoint. Publishing them as static JSON Schema files at stable URLs makes the config formats discoverable by crawlers and agents without an active MCP connection — self-documenting breadcrumbs for an agent-first platform.

## What Changes
- Export `FormsCatalogSchema`, `CatalogEntrySchema`, and `ConventionConfigSchema` from `@open-agreements/contracts-workspace` public API
- Add `zod-to-json-schema` as a build-time devDependency
- Create a generation script (`scripts/generate_json_schemas.mjs`) that converts Zod schemas to JSON Schema files
- Host generated schemas at `https://openagreements.ai/schemas/` via Eleventy passthrough copy (unversioned — add `/v1/` path prefix at 1.0)
- Ship generated schemas in the npm package under `schemas/`
- Add snapshot tests to verify `zod-to-json-schema` output correctness
- Fix redundant root build in Vercel install command (`prepare` already runs `npm run build`)

## Impact
- Affected specs: `open-agreements` (new requirement for schema publishing)
- Affected code:
  - `packages/contracts-workspace/src/core/catalog.ts` — export schemas
  - `packages/contracts-workspace/src/core/convention-config.ts` — export schema
  - `packages/contracts-workspace/src/index.ts` — re-export schemas
  - `scripts/generate_json_schemas.mjs` — new generation script
  - `eleventy.config.js` — passthrough copy for `site/schemas`
  - `vercel.json` — updated install command
  - `package.json` — new script + devDependency
  - `packages/contracts-workspace/package.json` — `schemas/` in files array
