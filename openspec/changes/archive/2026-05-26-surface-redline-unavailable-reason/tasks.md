# Tasks

## 1. api/mcp.ts changes

- [x] In `handleToolCall` for `TOOL_FILL_TEMPLATE` (around line 999), derive `includeRedlineExplicit` from raw `args` before Zod parse: `const includeRedlineExplicit = args != null && typeof args === 'object' && (args as Record<string, unknown>).include_redline === true;`
- [x] Restructure the redline branch at `api/mcp.ts:1090-1123` into nested try/catch:
  - Outer `try`: `generateRedlineFromFill` — on throw, set `redlineUnavailableReason = 'internal_error'`; preserve existing `logError` with `phase: 'redline'`, `parentOk: true`.
  - Inner `if (redline) { try { createDownloadArtifact(...redline variant) } catch { ... } } else { redlineUnavailableReason = 'template_unsupported' }`.
  - Inner catch: discriminate `DownloadStoreUnavailableError` → `'store_unavailable'` (subdivide `cause: 'configuration' | 'runtime'` via `instanceof DownloadStoreConfigurationError`); other throws → `'internal_error'`. Emit `logError` with `phase: 'redline_artifact'`, `parentOk: true`, and `cause` field when the error is a store-unavailable subclass.
- [x] Build `redlineReasonField`: `includeRedlineExplicit && redlineUnavailableReason ? { redline_unavailable_reason: redlineUnavailableReason } : {}`.
- [x] Spread `...redlineReasonField` alongside the existing `...redlineData` into BOTH the `mcp_resource` success envelope (line 1126) and the `url` success envelope (line 1138).

## 2. Tests (integration-tests/api-endpoints.test.ts)

Add seven new vitest cases in the `fill_template` `describe` block. Reuse existing `MockDownloadStoreRuntimeError` / `MockDownloadStoreConfigurationError` at lines 65-77, `generateRedlineFromFillMock` at line 60, `createDownloadArtifactMock` at line 54, `vi.spyOn(console, 'error')` log-capture pattern at line 924. Each test gets `it.openspec('OA-DST-<id>')(...)` referencing the new scenario IDs from the delta spec.

- [x] Test 1 — Explicit `include_redline: true` + `generateRedlineFromFill` resolves `null` → envelope contains `redline_unavailable_reason: 'template_unsupported'`, no `redline_*` fields, no console.error capture (template_unsupported is silent).
- [x] Test 2 — Explicit `include_redline: true` + `generateRedlineFromFill` throws → `redline_unavailable_reason: 'internal_error'`; captured log has `phase: 'redline'`, `parentOk: true`.
- [x] Test 3 — Explicit `include_redline: true` + `createDownloadArtifactMock` chained to throw `MockDownloadStoreRuntimeError` on the second (redline) call → `redline_unavailable_reason: 'store_unavailable'`; captured log has `phase: 'redline_artifact'`, `parentOk: true`, `cause: 'runtime'`.
- [x] Test 4 — Explicit `include_redline: true` + `MockDownloadStoreConfigurationError` on second call → `redline_unavailable_reason: 'store_unavailable'`; captured log has `cause: 'configuration'`.
- [x] Test 5 — Explicit `include_redline: true` + happy path (`generateRedlineFromFillMock` resolves to a stats object, `createDownloadArtifactMock` chained to return parent then redline artifact) → no `redline_unavailable_reason`, all `redline_*` fields populated.
- [x] Test 6 — `include_redline` omitted (defaults to `true`) + `generateRedlineFromFill` resolves `null` → no `redline_unavailable_reason` field (back-compat regression coverage).
- [x] Test 7 — `return_mode: 'mcp_resource'` variant of test 1 — same `redline_unavailable_reason: 'template_unsupported'` assertion on the resource-mode envelope.

## 3. Documentation

- [x] Update `docs/mcp-migration-v2.md` `fill_template` Return Modes section: add `redline_unavailable_reason?: 'template_unsupported' | 'store_unavailable' | 'internal_error'` to both `url` and `mcp_resource` shapes; document explicit-opt-in semantics (field only emitted when caller passed `include_redline: true` literally; absent when the default applies).

## 4. Spec deltas (this change folder)

- [x] Author `openspec/changes/surface-redline-unavailable-reason/proposal.md`.
- [x] Author `openspec/changes/surface-redline-unavailable-reason/specs/open-agreements/spec.md` with:
  - **MODIFIED `Structured Lifecycle Logs for MCP HTTP Transport`** — full requirement block with `'redline_artifact'` added to the phase enum line; preserves all existing scenarios OA-DST-038…043.
  - **ADDED `MCP fill_template Surfaces Redline Unavailability Reason (Opt-In)`** with scenarios `OA-DST-081`…`OA-DST-086`.

## 5. Validation

- [x] `npx openspec validate surface-redline-unavailable-reason --strict`.
- [x] `npm run build`.
- [x] `npx vitest run integration-tests/api-endpoints.test.ts integration-tests/mcp-contract.test.ts`.
- [x] `npm run check:spec-coverage` to confirm OA-DST-081…086 register as covered.
- [x] Manual back-compat probe: confirm `integration-tests/mcp-contract.test.ts:OA-DST-032` still passes (it doesn't pass `include_redline` and must not see the new field).

## 6. Apply to canonical spec (Stage 2 — same PR as code)

- [x] In `openspec/specs/open-agreements/spec.md`, edit the `Structured Lifecycle Logs for MCP HTTP Transport` requirement at line 1954 to add `'redline_artifact'` to the phase enumeration (line 1959).
- [x] Append the new `MCP fill_template Surfaces Redline Unavailability Reason (Opt-In)` requirement near the existing fill_template surfaces (e.g., after the `Opaque Download Links for Hosted Fill` requirement block).

## 7. Archive (Stage 3 — separate PR after merge & deploy)

- [x] `openspec archive surface-redline-unavailable-reason --yes`
- [x] `openspec validate --strict` to confirm the archived state.
