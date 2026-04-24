## ADDED Requirements

### Requirement: Durable Download Storage Policy
The download artifact store SHALL require a durable backend (Upstash REST KV) outside known-safe local/test contexts, and SHALL surface unavailability with a typed error so callers can return explicit machine-readable error codes instead of intermittent ghost 404s.

In-memory storage is permitted only when one of the following holds:
- `NODE_ENV === 'test'` (always — keeps tests deterministic and offline);
- `NODE_ENV === 'development'`; or
- `VERCEL_ENV === 'development'` (`vercel dev`).

When `DOWNLOAD_ALLOW_IN_MEMORY=1` is set, it is honored as a self-hosted single-instance escape hatch only when `VERCEL_ENV` is not `production` or `preview`. In `VERCEL_ENV=production` or `preview` the flag is rejected and a configuration error is thrown.

The store SHALL throw `DownloadStoreConfigurationError` (HTTP 500) when durable storage is required but not configured, and `DownloadStoreRuntimeError` (HTTP 503) when a configured durable store is reachable but transiently fails. Hosted endpoints SHALL map both to a `DOWNLOAD_STORE_UNAVAILABLE` machine-readable code, and the MCP `fill_template` envelope SHALL surface them as `INTERNAL_ERROR` with `details.reason='DOWNLOAD_STORE_UNAVAILABLE'` and `details.cause` of `'configuration'` or `'runtime'`.

#### Scenario: [OA-DST-036] Durable store required when neither test/dev nor KV vars are present
- **WHEN** `initDownloadArtifactStore` is called with `NODE_ENV='production'` and no `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) configured
- **THEN** the call throws `DownloadStoreConfigurationError`
- **AND** an error log is emitted with `event:'download_store_init'`, `mode:'error'`, and `reason:'durable_store_required'`
- **AND** `DOWNLOAD_ALLOW_IN_MEMORY=1` set together with `VERCEL_ENV='production'` or `'preview'` is rejected with `reason:'allow_in_memory_rejected_in_production'`
- **AND** `/api/download` responds to a request that triggers `DownloadStoreConfigurationError` from the resolve path with HTTP `500`, header `X-Download-Error-Code: DOWNLOAD_STORE_UNAVAILABLE`, and header `X-Download-Store: unavailable`
- **AND** `/api/download` responds to a request that triggers `DownloadStoreRuntimeError` from the resolve path with HTTP `503` and the same headers (no `Retry-After`)
- **AND** the MCP `fill_template` tool returns an `INTERNAL_ERROR` envelope with `details.reason='DOWNLOAD_STORE_UNAVAILABLE'`, `details.cause='configuration'|'runtime'`, and `retriable=false` for `configuration` or `retriable=true` for `runtime`

### Requirement: Download Storage Mode Visibility
The download artifact store SHALL expose its chosen storage mode through cold-start logs and HTTP response headers so that operators and clients can distinguish durable from non-durable backends without reading the runtime config.

The cold-start log emitted on first store initialization SHALL include `event:'download_store_init'` plus the diagnostic fields `mode` (`'upstash'|'memory'|'error'`), `durable_required` (boolean), `allow_in_memory_honored` (boolean), `node_env`, and `vercel_env`. The log SHALL be emitted via `console.log` for `upstash`, `console.warn` for honored `memory`, and `console.error` immediately before throwing in the `error` case. Cold-start logs are suppressed under `NODE_ENV='test'` to keep test output deterministic.

The `/api/download` endpoint SHALL set the response header `X-Download-Store: upstash|memory|unavailable` on every response (success and failure).

#### Scenario: [OA-DST-037] Storage mode is surfaced in logs and HTTP responses
- **WHEN** `initDownloadArtifactStore` initializes against an Upstash-configured environment
- **THEN** a single structured log line is emitted with `event:'download_store_init'`, `mode:'upstash'`, `durable_required`, `allow_in_memory_honored:false`, `node_env`, and `vercel_env`
- **AND** subsequent successful `/api/download` responses include the header `X-Download-Store: upstash`
- **AND** when the escape hatch (`DOWNLOAD_ALLOW_IN_MEMORY=1`) is honored outside production/preview, a `console.warn` log is emitted with `allow_in_memory_honored:true` and a non-empty `warning` field naming serverless instance risk
- **AND** when the resolve path throws `DownloadStoreUnavailableError`, the failure response carries `X-Download-Store: unavailable`
