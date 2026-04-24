# Change: Make download artifact store serverless-safe

## Why

`api/_download-artifacts.ts` silently falls back to a process-local
`InMemoryDownloadArtifactStore` when Upstash KV env vars are absent. On Vercel
Fluid Compute, in-process state is shared across concurrent requests on a warm
instance but is **not** durable across instances. The fallback therefore lets
`fill_template` succeed on instance A and `/api/download` return
`DOWNLOAD_NOT_FOUND` on instance B for a fresh, valid signed link — an
intermittent ghost 404 (issue #198).

The fix is to make storage durability explicit:

- Require a durable backend outside known-safe local/test contexts.
- Log the chosen mode at cold start with diagnostic fields.
- Surface the mode to clients via an `X-Download-Store` response header
  (success and failure).
- Return distinct, machine-readable codes when the store is unavailable so a
  misconfig is loud instead of intermittent.

## What Changes

- **`api/_download-artifacts.ts`**:
  - Introduce a pure `initDownloadArtifactStore(env, deps?)` initializer with
    a thin cached singleton wrapper. Tests pass `env` directly; no
    `vi.resetModules()` plumbing.
  - Add a typed error hierarchy: `DownloadStoreUnavailableError` (base),
    `DownloadStoreConfigurationError`, `DownloadStoreRuntimeError`.
  - Storage policy (inverted from "detect prod" to "allow-list known safe
    contexts"):
    - Durable when `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or
      `UPSTASH_REDIS_REST_*` aliases) are set — use Upstash REST.
    - In-memory only when `NODE_ENV in {test, development}` or
      `VERCEL_ENV === 'development'`.
    - Otherwise: throw `DownloadStoreConfigurationError`.
  - Narrow escape hatch `DOWNLOAD_ALLOW_IN_MEMORY=1` is honored only when
    `VERCEL_ENV` is not `production` or `preview`; rejected (and logged) in
    those environments.
  - `UpstashRestDownloadArtifactStore.command()` wraps fetch / HTTP / JSON
    failures in `DownloadStoreRuntimeError` instead of generic `Error`.
  - Cold-start log emits one structured JSON line:
    `{event:'download_store_init', mode, durable_required, allow_in_memory_honored, node_env, vercel_env}`.
- **`api/download.ts`**:
  - Existing resolve catch (added in #207) now classifies typed errors and
    maps `DownloadStoreConfigurationError` → HTTP 500 +
    `DOWNLOAD_STORE_UNAVAILABLE`, `DownloadStoreRuntimeError` → HTTP 503 +
    same code (no `Retry-After`). Generic throws fall back to the existing
    `DOWNLOAD_RENDER_FAILED` 500 contract.
  - `X-Download-Store` header set on every response (success and failure) —
    `upstash`, `memory`, or `unavailable`.
- **`api/mcp.ts`**:
  - `createDownloadArtifact` catches in `fill_template` distinguish typed
    errors and return `INTERNAL_ERROR` envelope with `retriable` reflecting
    cause and `details: { reason: 'DOWNLOAD_STORE_UNAVAILABLE', cause }`.
    No new top-level MCP error codes added (envelope taxonomy stays closed).
- **Tests**:
  - `integration-tests/api-download-tokens.test.ts` adds policy tests against
    the pure initializer with stubbed env objects (no module reset).
  - `integration-tests/api-endpoints.test.ts` adds endpoint-level coverage
    for `DOWNLOAD_STORE_UNAVAILABLE` (500 config + 503 runtime, GET + HEAD,
    `X-Download-Store` header on success and failure) and MCP envelope
    coverage for `details.reason`/`cause`.

## Impact

- **Affected specs**: `open-agreements`
  - Adds `OA-DST-036` (Durable Download Storage Policy)
  - Adds `OA-DST-037` (Download Storage Mode Visibility)
- **Affected code**:
  - `api/_download-artifacts.ts`
  - `api/_shared.ts`
  - `api/download.ts`
  - `api/mcp.ts`
  - `integration-tests/api-download-tokens.test.ts`
  - `integration-tests/api-endpoints.test.ts`
- **Behavior change**: any deploy that relied on the silent in-memory fallback
  in production/preview will now hard-fail at first request with an explicit
  HTTP 500 / `DOWNLOAD_STORE_UNAVAILABLE` and a structured error log naming
  the missing env vars. This is the correct outcome — the previous behavior
  was the bug. Operators provision Upstash KV (or equivalent) per the
  existing setup path.
- **Escape hatch (intentional, narrow)**: `DOWNLOAD_ALLOW_IN_MEMORY=1` permits
  in-memory in self-hosted single-instance deploys (`VERCEL_ENV` unset). It
  is **rejected** in `VERCEL_ENV=production|preview` to prevent operators
  from silencing the new error and reintroducing the bug.

## Out of scope

- A `/api/health` endpoint — separate trust-surface expansion.
- Storage backend migration to Vercel Blob / Postgres — Upstash works when
  configured.
