## MODIFIED Requirements

### Requirement: Structured Lifecycle Logs for MCP HTTP Transport
The `/api/mcp` HTTP handler SHALL emit single-line structured JSON log records for every request lifecycle event, written to `stdout` for informational events and `stderr` for error events so that `vercel logs` filtering and downstream log drains can categorize them by severity. Every record SHALL include `endpoint:'mcp'`, an ISO-8601 `ts`, and a `level` of `'info'` or `'error'`. Every record from a request whose inbound `x-vercel-id` header is present SHALL include `vercelId` set to that value. When `x-vercel-id` is absent the record SHALL omit the `vercelId` field entirely (no synthetic fallback id).

The handler SHALL emit `request_start` immediately before dispatch and `request_complete` on every non-OPTIONS terminal path (including `initialize`, `tools/list`, `tools/call`, `ping`, JSON-RPC method-not-found, malformed-envelope rejections, HTTP method rejections, and the outer unhandled-exception catch). `request_complete` records SHALL include `status`, `ok`, `durationMs`, `jsonrpcMethod` when known, and `toolName` when the request is `tools/call`.

The handler SHALL emit additional discriminator events as appropriate: `request_rejected_http_method` (status 405), `request_rejected_invalid_jsonrpc` (status 400), `notification` (id-less envelope), `auth_denied`, `tool_internal_error`, and `unhandled_exception`. `tool_internal_error` records SHALL preserve the existing `phase` discriminator (`'fill'`, `'artifact'`, `'redline'`, `'redline_artifact'`, or `'signing'`) and the `cause` discriminator (`'configuration'` or `'runtime'`) where applicable; both the `redline` and `redline_artifact` phases SHALL additionally carry `parentOk:true` so dashboards can distinguish a best-effort redline failure (either at generator-time or at redline-variant artifact-write time) from a hard fill failure.

#### Scenario: [OA-DST-038] x-vercel-id propagates into request_start and request_complete
- **WHEN** a valid JSON-RPC `tools/list` request reaches `/api/mcp` with header `x-vercel-id: fra1::abc123`
- **THEN** an info log line is written to `stdout` with `event:'request_start'`, `endpoint:'mcp'`, `level:'info'`, `vercelId:'fra1::abc123'`, `jsonrpcMethod:'tools/list'`, and the inbound `jsonrpcId`
- **AND** an info log line is written to `stdout` with `event:'request_complete'`, `vercelId:'fra1::abc123'`, `ok:true`, `status:200`, and a numeric `durationMs`

#### Scenario: [OA-DST-039] vercelId propagates into tool_internal_error and err is normalized
- **WHEN** `fill_template` is invoked with header `x-vercel-id: iad1::xyz789` and the underlying fill throws an `Error('synthetic fill failure')`
- **THEN** an error log line is written to `stderr` with `event:'tool_internal_error'`, `endpoint:'mcp'`, `level:'error'`, `vercelId:'iad1::xyz789'`, `tool:'fill_template'`, `phase:'fill'`, the inbound `jsonrpcId`, `name:'Error'`, `message:'synthetic fill failure'`, and a non-empty `stack`

#### Scenario: [OA-DST-040] auth_denied logs a token fingerprint, never the raw bearer token
- **WHEN** `tools/call` invokes a signing tool (e.g. `send_for_signature`) with `Authorization: Bearer <secret>` and the auth handshake fails
- **THEN** an error log line is written with `event:'auth_denied'`, `endpoint:'mcp'`, `toolName:'send_for_signature'`, and a `tokenFp` field whose value matches the regex `^[0-9a-f]{12}$`
- **AND** the raw bearer-token string SHALL NOT appear anywhere in any captured log record (regression guard against accidental token leakage)

#### Scenario: [OA-DST-041] Successful non-auth-required paths do not fingerprint bearer tokens
- **WHEN** a non-auth-required tool such as `tools/list` is invoked with an `Authorization: Bearer <token>` header present (the header is not consumed because the tool is not in the auth-required set)
- **THEN** no log line emitted by the request SHALL contain a `tokenFp` field

#### Scenario: [OA-DST-042] Malformed JSON-RPC envelopes are logged
- **WHEN** the request body is missing the `jsonrpc:'2.0'` field
- **THEN** an error log line is written with `event:'request_rejected_invalid_jsonrpc'`, `endpoint:'mcp'`, `level:'error'`, `status:400`, and the inbound `jsonrpcId` if present
- **AND** the HTTP response is the existing `400 jsonRpcError(-32600, 'Invalid JSON-RPC 2.0 request')` payload

#### Scenario: [OA-DST-043] vercelId is omitted (not synthesized) when x-vercel-id is absent
- **WHEN** a valid JSON-RPC request reaches `/api/mcp` with no `x-vercel-id` header
- **THEN** the `request_start` and `request_complete` records SHALL NOT contain a `vercelId` key (the field is omitted, not set to a generated UUID or any other fallback value)

## ADDED Requirements

### Requirement: MCP fill_template Surfaces Redline Unavailability Reason (Opt-In)
The MCP `fill_template` tool success envelope SHALL surface an optional `redline_unavailable_reason` field whenever the caller **explicitly** requested redline generation but the redline could not be produced. The field is a string discriminator with exactly one of these three values:

- `'template_unsupported'` — `generateRedlineFromFill` resolved to `null` (the template has no redline recipe directory).
- `'store_unavailable'` — the redline-variant `createDownloadArtifact` call threw a `DownloadStoreUnavailableError`. The accompanying `tool_internal_error` log record SHALL carry `phase:'redline_artifact'`, `parentOk:true`, and `cause:'configuration'` (for `DownloadStoreConfigurationError`) or `cause:'runtime'` (for `DownloadStoreRuntimeError`).
- `'internal_error'` — any other throw, whether from the redline generator itself (`phase:'redline'`, `parentOk:true`) or from the redline-variant artifact call when the error is not a `DownloadStoreUnavailableError` subclass (`phase:'redline_artifact'`, `parentOk:true`).

The field SHALL be emitted ONLY when the caller passed `include_redline: true` as a literal explicit argument on the JSON-RPC `params.arguments` object. When `include_redline` is absent (i.e., the Zod schema default of `true` applied), the envelope SHALL omit `redline_unavailable_reason` entirely — preserving wire-shape back-compat for every existing caller that relied on the default. When the caller passed `include_redline: false`, the redline branch is skipped entirely and the field is necessarily absent.

Successful redline generation SHALL continue to populate the existing `redline_download_url`, `redline_download_id`, `redline_expires_at`, and `redline_stats` fields, and SHALL NOT emit `redline_unavailable_reason`. The field is spread into both the `url` and `mcp_resource` `return_mode` envelopes identically.

The redline path remains best-effort: redline failures of any kind SHALL NOT fail the parent `fill_template` call. The envelope `ok` flag remains `true` whenever the parent fill itself succeeded.

#### Scenario: [OA-DST-081] Explicit opt-in + template has no redline recipe → template_unsupported reason, no log
- **WHEN** `fill_template` is invoked with `arguments.include_redline: true` (literal explicit) and the resolved template has no redline recipe directory (`generateRedlineFromFill` resolves to `null`)
- **THEN** the success envelope `data` includes `redline_unavailable_reason: 'template_unsupported'`
- **AND** the `data` does NOT include `redline_download_url`, `redline_download_id`, `redline_expires_at`, or `redline_stats`
- **AND** no `tool_internal_error` log record is emitted for the redline path (template_unsupported is a routine outcome, not an error)
- **AND** the envelope `ok` field is `true`

#### Scenario: [OA-DST-082] Explicit opt-in + redline generator throws → internal_error reason, log captured
- **WHEN** `fill_template` is invoked with `arguments.include_redline: true` (literal explicit) and `generateRedlineFromFill` throws an `Error`
- **THEN** the success envelope `data` includes `redline_unavailable_reason: 'internal_error'`
- **AND** a `tool_internal_error` log record is emitted with `phase:'redline'`, `parentOk:true`
- **AND** the envelope `ok` field is `true` (the parent fill itself succeeded)

#### Scenario: [OA-DST-083] Explicit opt-in + redline artifact write throws DownloadStoreRuntimeError → store_unavailable, cause:'runtime'
- **WHEN** `fill_template` is invoked with `arguments.include_redline: true` (literal explicit), `generateRedlineFromFill` succeeds, but the redline-variant `createDownloadArtifact` call throws a `DownloadStoreRuntimeError`
- **THEN** the success envelope `data` includes `redline_unavailable_reason: 'store_unavailable'`
- **AND** a `tool_internal_error` log record is emitted with `phase:'redline_artifact'`, `parentOk:true`, and `cause:'runtime'`
- **AND** the envelope `ok` field is `true`

#### Scenario: [OA-DST-084] Explicit opt-in + redline artifact write throws DownloadStoreConfigurationError → store_unavailable, cause:'configuration'
- **WHEN** `fill_template` is invoked with `arguments.include_redline: true` (literal explicit), `generateRedlineFromFill` succeeds, but the redline-variant `createDownloadArtifact` call throws a `DownloadStoreConfigurationError`
- **THEN** the success envelope `data` includes `redline_unavailable_reason: 'store_unavailable'`
- **AND** a `tool_internal_error` log record is emitted with `phase:'redline_artifact'`, `parentOk:true`, and `cause:'configuration'`
- **AND** the envelope `ok` field is `true`

#### Scenario: [OA-DST-085] Default-true include_redline + redline unavailable → field absent (back-compat)
- **WHEN** `fill_template` is invoked WITHOUT `include_redline` on `arguments` (the Zod schema default of `true` applies) and `generateRedlineFromFill` resolves to `null`
- **THEN** the success envelope `data` does NOT include `redline_unavailable_reason`
- **AND** the `data` does not include any `redline_*` fields
- **AND** existing back-compat is preserved for callers that never explicitly opted into redlines

#### Scenario: [OA-DST-086] Explicit opt-in + happy path → field absent, redline fields populated
- **WHEN** `fill_template` is invoked with `arguments.include_redline: true` (literal explicit), the template has a redline recipe, `generateRedlineFromFill` resolves successfully, and the redline-variant `createDownloadArtifact` succeeds
- **THEN** the success envelope `data` does NOT include `redline_unavailable_reason`
- **AND** the `data` includes `redline_download_url`, `redline_download_id`, `redline_expires_at`, and `redline_stats`
