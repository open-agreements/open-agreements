## ADDED Requirements

### Requirement: Structured Lifecycle Logs for MCP HTTP Transport
The `/api/mcp` HTTP handler SHALL emit single-line structured JSON log records for every request lifecycle event, written to `stdout` for informational events and `stderr` for error events so that `vercel logs` filtering and downstream log drains can categorize them by severity. Every record SHALL include `endpoint:'mcp'`, an ISO-8601 `ts`, and a `level` of `'info'` or `'error'`. Every record from a request whose inbound `x-vercel-id` header is present SHALL include `vercelId` set to that value. When `x-vercel-id` is absent the record SHALL omit the `vercelId` field entirely (no synthetic fallback id).

The handler SHALL emit `request_start` immediately before dispatch and `request_complete` on every non-OPTIONS terminal path (including `initialize`, `tools/list`, `tools/call`, `ping`, JSON-RPC method-not-found, malformed-envelope rejections, HTTP method rejections, and the outer unhandled-exception catch). `request_complete` records SHALL include `status`, `ok`, `durationMs`, `jsonrpcMethod` when known, and `toolName` when the request is `tools/call`.

The handler SHALL emit additional discriminator events as appropriate: `request_rejected_http_method` (status 405), `request_rejected_invalid_jsonrpc` (status 400), `notification` (id-less envelope), `auth_denied`, `tool_internal_error`, and `unhandled_exception`. `tool_internal_error` records SHALL preserve the existing `phase` discriminator (`'fill'`, `'artifact'`, `'redline'`, or `'signing'`) and the `cause` discriminator (`'configuration'` or `'runtime'`) where applicable; the `redline` phase SHALL additionally carry `parentOk:true` so dashboards can distinguish a best-effort redline failure from a hard fill failure.

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
