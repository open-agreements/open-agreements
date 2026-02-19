## Context
The workspace package validates two YAML config files with Zod schemas (`FormsCatalogSchema`, `ConventionConfigSchema`). These are currently module-private and only accessible via MCP `tools/list`. Publishing them as JSON Schema at stable URLs makes them discoverable by crawlers and agents outside an MCP session.

## Goals / Non-Goals
- Goals: Auto-generate JSON Schema from Zod at build time, host at stable URLs, ship in npm package
- Non-Goals: Full validation parity (custom runtime checks like duplicate entry ID detection are out of scope for JSON Schema)

## Decisions
- **Generation tool**: `zod-to-json-schema` with `$refStrategy: 'none'` (inline all definitions for maximum portability — agents and crawlers get a self-contained file)
- **Script pattern**: `.mjs` importing from compiled `dist/`, matching `source_drift_canary.mjs` and other existing scripts
- **Single canonical output**: Generate to `packages/contracts-workspace/schemas/` (npm-first), then copy to `site/schemas/` for static hosting. Avoids dual-generation drift.
- **URL scheme**: `https://openagreements.ai/schemas/{name}.schema.json` — unversioned. Pre-1.0 with few consumers, versioned paths add maintenance cost without payoff. The `schema_version` field inside the YAML files already signals internal compatibility. Add `/v1/` path prefix when the package reaches 1.0 and stability matters.
- **Generated files not committed**: Added to `.gitignore`, rebuilt by CI/Vercel each time. Snapshot tests verify correctness instead.
- **Build ordering**: `npm install` triggers `prepare -> build` (root tsc). Vercel install command drops redundant `npm run build`, adds `build:workspace` before `generate:schemas` before `build:site`.

## Risks / Trade-offs
- `zod-to-json-schema` may not perfectly represent every Zod construct — mitigated by snapshot tests on key patterns
- JSON Schema cannot express custom business logic (e.g., duplicate `entries.id` check in `catalog.ts:74`) — documented as a known limitation, not a blocker

## Open Questions
- None remaining (Codex peer review addressed build ordering, dual output, and versioning concerns)
