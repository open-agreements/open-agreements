# Tasks

## 1. Refactor download artifact store

- [x] Add `DownloadStoreUnavailableError` base class with `cause_type` discriminator in `api/_download-artifacts.ts`.
- [x] Add `DownloadStoreConfigurationError` and `DownloadStoreRuntimeError` subclasses.
- [x] Add pure `initDownloadArtifactStore(env, deps?)` initializer; thin cached `getDownloadArtifactStore()` wrapper.
- [x] Implement inverted policy: durable when KV vars present; in-memory only for `NODE_ENV in {test, development}` or `VERCEL_ENV === 'development'`; throw otherwise.
- [x] Honor `DOWNLOAD_ALLOW_IN_MEMORY=1` only when `VERCEL_ENV` is not `production|preview`.
- [x] Wrap `UpstashRestDownloadArtifactStore.command()` failures in `DownloadStoreRuntimeError`.
- [x] Emit cold-start log via injectable `deps.log` (defaults to console).
- [x] Export `getDownloadStorageMode()`.
- [x] Add `_resetDownloadArtifactStoreCacheForTests` test seam.

## 2. Plumb through consumers

- [x] Re-export new symbols from `api/_shared.ts`.
- [x] In `api/download.ts`, classify typed errors in the resolve catch; map config → 500, runtime → 503; both use `DOWNLOAD_STORE_UNAVAILABLE` code.
- [x] Add `setStorageHeader` and emit `X-Download-Store` on every response.
- [x] In `api/mcp.ts`, classify typed errors in `createDownloadArtifact` catch; return `INTERNAL_ERROR` envelope with `retriable`/`details.reason`/`details.cause`.

## 3. Tests

- [x] Add unit tests in `integration-tests/api-download-tokens.test.ts` for `initDownloadArtifactStore`: production-no-KV throws config error, preview-no-KV throws, allow-flag rejected in prod, dev contexts use memory, upstash factory used when KV present, cold-start log fields.
- [x] Add endpoint tests in `integration-tests/api-endpoints.test.ts`: 500 config / 503 runtime with `DOWNLOAD_STORE_UNAVAILABLE` and `X-Download-Store: unavailable`, GET + HEAD parity, success path emits `X-Download-Store: <mode>`.
- [x] Add MCP envelope tests for `details.reason='DOWNLOAD_STORE_UNAVAILABLE'` with config (`retriable:false`) and runtime (`retriable:true`) causes.

## 4. Spec deltas

- [x] Author `openspec/changes/fix-download-artifact-store-serverless-safety/specs/open-agreements/spec.md` with `OA-DST-036` and `OA-DST-037`.
- [x] Verify ID availability: `grep -rhoE "OA-DST-[0-9]+" openspec/ | sort -u | tail` and inspect `openspec/id-mapping.json`.

## 5. Validation

- [ ] `npx openspec validate fix-download-artifact-store-serverless-safety --strict`
- [ ] `npm run test -- integration-tests/api-download-tokens.test.ts integration-tests/api-endpoints.test.ts integration-tests/mcp-contract.test.ts`
- [ ] `npm run preflight:ci`
- [ ] `npm run trust:rebuild` and inspect diff (system card scenario count +2).
