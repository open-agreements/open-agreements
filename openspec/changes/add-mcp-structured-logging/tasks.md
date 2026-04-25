# Tasks

## 1. New logging helper

- [x] Add `api/_log.ts` with `getRequestContext`, `redactBearer`, `normalizeError`, `info`, `error`.
- [x] Omit `vercelId` from records when `x-vercel-id` is absent (no synthetic fallback).
- [x] Split sinks: `info` → `console.log`, `error` → `console.error`.
- [x] Endpoint-agnostic — callers stamp `endpoint: 'mcp'`.

## 2. Wire into api/mcp.ts

- [x] Delete module-scoped `_baseUrl`; thread `ctx.baseUrl` through handlers.
- [x] Add `ctx` as third argument to `handleToolsCall(id, params, ctx)` and `handleSigningToolCall(id, name, args, ctx)`.
- [x] Emit `request_start` + `request_complete` (every non-OPTIONS terminal path, with `status`/`ok`/`durationMs`).
- [x] Emit `request_rejected_http_method`, `request_rejected_invalid_jsonrpc`, `notification`.
- [x] Emit `auth_denied` with `tokenFp` (never the raw bearer token); fingerprint only on denied paths, never on success.
- [x] Replace 5 existing `console.error` calls with structured `error()` records preserving `phase`/`cause` discriminators; redline catch carries `parentOk: true`.
- [x] Replace outer catch with `event: 'unhandled_exception'` log including `durationMs`.

## 3. Tests

- [x] Add 6 regression tests in `integration-tests/mcp-contract.test.ts` bound to `OA-DST-038`…`OA-DST-043`.
- [x] Verify `npx vitest run integration-tests/mcp-contract.test.ts` passes (19/19 with new tests).
- [x] Spy on both `console.log` and `console.error` since the helper splits sinks.

## 4. Spec deltas

- [x] Author `openspec/changes/add-mcp-structured-logging/specs/open-agreements/spec.md` with `OA-DST-038`…`OA-DST-043`.
- [x] Verify ID availability: `grep -rhoE "OA-DST-[0-9]+" openspec/ integration-tests/ | sort -u | tail` confirms 037 was the previous ceiling.

## 5. Validation

- [ ] `npx openspec validate add-mcp-structured-logging --strict`
- [ ] `npm run test -- integration-tests/mcp-contract.test.ts integration-tests/validate-openspec-coverage-script.test.ts`
- [ ] Local smoke against `vercel dev` to confirm `x-vercel-id` propagation when present and absence otherwise (deferred to PR review).
