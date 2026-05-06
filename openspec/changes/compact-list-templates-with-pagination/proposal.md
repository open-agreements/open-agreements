# Change: Collapse list_templates to compact-only output and add cursor pagination

## Why

The MCP `list_templates` tool today exposes a `mode: "compact" | "full"` switch (see `packages/contract-templates-mcp/src/core/tools.ts:153-181` and `api/mcp.ts:803-829`). The `full` mode returns `normalizeTemplate(item)` for every template — the same payload `get_template` produces, repeated N times. There is no pagination on either mode: every call returns the full catalog in one shot.

This is unsustainable for two reasons (issue #267):

1. **Catalog bloat.** As the corpus grows past today's 44 templates, "full mode" produces ever-larger responses that callers don't need at *discovery* time. `get_template` is the per-template detail surface; `list_templates` should not duplicate it.
2. **Discoverability ergonomics.** Even compact mode will get unwieldy. Agents shouldn't have to hold the whole catalog in context to find one template.

PR #265 (`multiselect`) and Issue 1 (`options` on `get_template`) reinforce the surface separation: `list_templates` is *discovery*, `get_template` is *detail*. Compacting `list_templates` and adding pagination locks that contract in.

The MCP server is young, the primary consumer (UseJunior) is in lockstep with this repo, and we control migration — so this is a clean wire-shape break rather than a deprecated-mode shim.

## What Changes

- **`packages/contract-templates-mcp/src/core/tools.ts`** — Drop `mode` from `ListTemplatesArgsSchema`; add `cursor` (opaque base64 `template_id` boundary) and `limit` (default 25, max 100). Replace `compactTemplate` with a richer compact shape `{ template_id, display_name, category, description, field_count, priority_field_count }`. Remove the `mode === 'full'` branch from the `list_templates` invoke handler. Extend `TemplateRecord` with `display_name` and `priority_field_count` and plumb them through `loadTemplates()`. Bump `SCHEMA_VERSION` to `2026-05-06`. Keep `normalizeTemplate` — `get_template` still uses it.
- **`api/mcp.ts` + `api/_envelope.ts`** — Mirror the package changes: same input schema (`cursor`, `limit`, no `mode`), same compact shape, same pagination handler, same `template_id`-boundary cursor semantics. Bump the hosted `SCHEMA_VERSION` to `2026-05-06` so it aligns with the package.
- **Cursor design** — `template_id` boundary, base64-wrapped, opaque on the wire. Stable under catalog mutations: a cursor encodes "the last `template_id` seen"; the next page returns templates whose id is lexicographically `>` the cursor.
- **Build-time `display_name` validator** — Make missing/empty `meta.name` a build-time failure rather than relying on a runtime fallback. The metadata schema already requires `name`; this guards against regressions.
- **`packages/contract-templates-mcp/tests/tools.test.ts`** — Replace the two existing `list_templates` tests with new coverage: pagination roundtrip, lexicographic continuity across page boundaries, compact-shape exactness, `display_name` runtime fallback, limit bounds rejection, invalid cursor rejection, `mode` rejection.
- **`integration-tests/mcp-contract.test.ts`** — Update the OA-DST-032 test at line 191 to assert pagination envelope fields. Drop or rewrite the "compact and full payload modes" test at line 216 and the "full mode includes display_name" test at line 546.
- **`integration-tests/OPENSPEC_TRACEABILITY.md`** — Regenerate so the new scenario IDs (`OA-DST-054` … `OA-DST-060`) show as covered.
- **Documentation** — Update `docs/mcp-migration-v2.md` (the `list_templates` Modes section), `docs/examples/mcp-client-python.md` (the `tools/call` example), and `skills/open-agreements/SKILL.md` to describe the new compact-only paginated contract. Spot-check the `template-filling-execution.md` files in `skills/{open-agreements,safe,nda,cloud-service-agreement,shared}/` for stale `mode` references.

## Out of scope

- Filtering / search on `list_templates` (separate issue — the existing `search_templates` tool covers some of this).
- Sort-order configurability — the contract is stable lexicographic by `template_id` (already today).
- Removing `display_label` / `derive_booleans` strip semantics (already in place).
- Surfacing `options` on `get_template` (separate issue — Issue 1).
- A "deprecated alias" `mode: "full"` back-compat shim — the issue authorizes a clean break.
- Unifying the package MCP's in-process catalog (internal templates only, ~14) with the hosted MCP's broader catalog (internal + external + recipes, ~45). Pre-existing divergence; tracked as a follow-up.
