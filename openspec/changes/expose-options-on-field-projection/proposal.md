# Change: Expose options on enum field projection

## Why
An MCP or CLI agent calling `fill_template` for an `enum` field has no programmatic way to learn the legal value set today. The shared field projection in `src/core/template-listing.ts` (`mapFields`) — used by CLI `list --json`, the MCP package `list_templates`/`get_template`, the hosted shared service in `api/_shared.ts`, the hosted MCP `api/mcp.ts`, and the A2A surface `api/a2a.ts` — drops `options` from every field. Agents either guess, parse free-form `description` prose, or pull `metadata.yaml` out of band — defeating the discovery surfaces' purpose.

## What Changes
- Project `options` for `type: 'enum'` fields in `mapFields()` so all consumers (CLI, MCP package, hosted shared service, hosted MCP, A2A) automatically gain enum option discoverability.
- Update type mirrors in `packages/contract-templates-mcp/src/core/tools.ts`, `api/_shared.ts`, `api/mcp.ts`, and `integration-tests/list-command.inprocess.test.ts` to include the new optional `options` projection.
- Regenerate `data/templates-snapshot.json` so the committed snapshot reflects the additive change.
- Bind new test scenarios `OA-CLI-025`, `OA-DST-054`, `OA-DST-055`.
- Rename the existing MCP discovery requirement to reflect its broadened scope (now covers enum option metadata in addition to array item schemas).

## Impact
- Affected specs: `open-agreements`
- Affected code: `src/core/template-listing.ts`, `packages/contract-templates-mcp/src/core/tools.ts`, `api/_shared.ts`, `api/mcp.ts`, `integration-tests/list-command.inprocess.test.ts`, `data/templates-snapshot.json`
- Affected tests: `packages/contract-templates-mcp/tests/tools.test.ts`, `integration-tests/list-command.inprocess.test.ts`, `integration-tests/api-shared.test.ts`, `integration-tests/mcp-contract.test.ts`

## Non-goals
- `multiselect` field type — PR #265; when it lands, that change widens the conditional in `mapFields()` to include `f.type === 'multiselect'`.
- `list_templates` compaction or pagination (separate Issue 2).
- Runtime enum allowlist enforcement in `prepareFillData`.
- Surfacing `derive_booleans` or `display_label` on the wire — both stay stripped.
- Bumping `SCHEMA_VERSION` (in `api/_envelope.ts` or `packages/contract-templates-mcp/src/core/tools.ts`). The archived `add-variable-signer-blocks` change shipped an analogous additive discovery field without bumping; this change follows that precedent.
- `display_name` package-vs-hosted drift — separate issue.
- `OA-DST-034` / `OA-DST-033` test-binding cleanup — the existing `tools.test.ts` array-item test mis-binds to `OA-DST-034`; canonical is `OA-DST-033`. Cleanup deserves its own focused PR.
