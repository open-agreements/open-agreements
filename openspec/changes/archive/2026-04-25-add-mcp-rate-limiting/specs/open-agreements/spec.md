## MODIFIED Requirements

### Requirement: MCP Protocol Envelope Contract
The MCP endpoint MUST return consistent envelope shapes for all tool calls
including list, fill, and get operations with proper error envelopes.

Success envelopes MUST include `data.rate_limit` with the four-field shape
`{ limit, remaining, reset_at, bucket }`. When the rate limiter is
configured (Upstash env vars present at runtime), all four fields MUST
reflect the binding bucket for the request: `limit` and `remaining` are
non-negative integers, `reset_at` is an ISO 8601 timestamp at the end of
the active window, and `bucket` is the bucket name (`"mcp:global"` for
non-`fill_template` calls, or whichever of `"mcp:global"`/`"mcp:fill"`
has fewer remaining requests for `fill_template`). When the limiter is
unconfigured (dev/test) or has failed open after a Redis error, all four
fields MUST be `null`.

#### Scenario: [OA-DST-032] MCP contract envelope shapes
- **WHEN** MCP tools are called (list_templates, get_template, fill_template)
- **THEN** success responses have consistent envelope structure
- **AND** error responses use typed error codes (INVALID_ARGUMENT, TEMPLATE_NOT_FOUND)
- **AND** compact and full payload modes are supported for list_templates
- **AND** browser GET returns HTML, non-browser GET returns 405
- **AND** success envelopes include `data.rate_limit` with fields `limit`, `remaining`, `reset_at`, and `bucket` (all `null` when the limiter is unconfigured or fails open)

## ADDED Requirements

### Requirement: MCP Rate Limiting on /api/mcp
The `/api/mcp` HTTP handler SHALL enforce per-IP fixed-window rate limiting
on every authoritative POST (including JSON-RPC notifications, but
excluding `OPTIONS` preflight and `GET`). Two buckets SHALL apply:

1. `mcp:global` — every authoritative POST. Default cap 600 requests per
   minute per IP, overridable via env var `OA_MCP_RATE_LIMIT_GLOBAL`.
2. `mcp:fill` — `tools/call` requests with `name === "fill_template"`,
   checked **in addition to** the global bucket. Default cap 120 requests
   per minute per IP, overridable via env var `OA_MCP_RATE_LIMIT_FILL`.

Counters SHALL be backed by Upstash Redis using the REST `/multi-exec`
endpoint with an atomic `INCR` + `PEXPIRE` transaction (single round trip,
no race window). The implementation SHALL prefer
`KV_REST_API_URL`/`KV_REST_API_TOKEN` over
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, mirroring the
download-artifact store policy.

When a request is blocked, the handler SHALL return HTTP `200` with a
JSON-RPC tool envelope where `ok: false`, `error.code: "RATE_LIMITED"`,
`error.retriable: true`, and `error.details.rate_limit` is populated with
`{ limit, remaining: 0, reset_at, bucket }`. The HTTP response SHALL also
carry a `Retry-After` header whose value is the number of seconds until the
window resets (minimum `1`). HTTP 200 (not 429) preserves the JSON-RPC
envelope contract used elsewhere in the endpoint and avoids known interop
issues with HTTP 429 + `Retry-After` in current MCP clients.

The handler SHALL extract the client IP from the headers
`x-vercel-forwarded-for`, `x-real-ip`, and `x-forwarded-for` (first
comma-separated entry) in that order, falling back to the literal string
`"unknown"` so the limit still meaningfully caps degenerate requests.
`x-forwarded-for` is the last fallback because it can be appended by
clients before reaching Vercel.

The limiter SHALL fail open on transient Redis errors (logged as
`rate_limit_runtime_error` warnings) and SHALL emit a loud
`rate_limiter_init` `console.error` at initialization when the durable
store is unconfigured under `VERCEL_ENV=production|preview`. In dev/test
contexts (no env vars) the limiter SHALL be silently disabled.

#### Scenario: [OA-DST-044] Reports truthful rate_limit metadata when limiter is active
- **WHEN** a `tools/call` succeeds and the limiter returns
  `{ allowed: true, bucket: "mcp:global", limit: 600, remaining: 599, reset_at: "..." }`
- **THEN** the success envelope's `data.rate_limit` equals
  `{ limit: 600, remaining: 599, reset_at: "...", bucket: "mcp:global" }`

#### Scenario: [OA-DST-045] Blocks tools/call with RATE_LIMITED envelope and Retry-After header on global cap
- **WHEN** `tools/call` is invoked and the global bucket is over its limit
- **THEN** the response status is HTTP 200
- **AND** the response carries a `Retry-After` header with a positive integer value
- **AND** the JSON-RPC envelope has `ok: false`, `error.code: "RATE_LIMITED"`, `error.retriable: true`
- **AND** `error.details.rate_limit` equals
  `{ limit: 600, remaining: 0, reset_at: "...", bucket: "mcp:global" }`

#### Scenario: [OA-DST-046] Enforces stricter mcp:fill bucket when global passes
- **WHEN** `fill_template` is invoked, the global bucket is allowed, and the fill bucket is over its limit
- **THEN** the limiter is consulted twice: first for `mcp:global`, then for `mcp:fill`
- **AND** the response is a `RATE_LIMITED` envelope with
  `error.details.rate_limit.bucket === "mcp:fill"`
- **AND** the envelope's `tool` field is `"fill_template"`

#### Scenario: [OA-DST-047] Counts JSON-RPC notifications against the global bucket
- **WHEN** an id-less JSON-RPC notification (e.g. `notifications/initialized`) reaches `/api/mcp`
- **THEN** the limiter is consulted for `mcp:global` before the notification short-circuit
- **AND** the response is HTTP 202 with no body when allowed

#### Scenario: [OA-DST-048] Fails open with null rate_limit metadata when limiter is unconfigured
- **WHEN** the rate limiter returns `{ configured: false }` (dev/test or runtime fail-open)
- **THEN** the success envelope's `data.rate_limit` is
  `{ limit: null, remaining: null, reset_at: null, bucket: null }`
- **AND** the response carries no `Retry-After` header

#### Scenario: [OA-DST-049] getClientIp prefers Vercel-trusted headers
- **WHEN** a request carries `x-vercel-forwarded-for`, `x-real-ip`, and `x-forwarded-for`
- **THEN** `getClientIp` returns the value from `x-vercel-forwarded-for`
- **AND** when only `x-real-ip` is present, `getClientIp` returns that
- **AND** when only `x-forwarded-for` is present, `getClientIp` returns its first comma-separated entry trimmed
- **AND** when no IP-like header is present, `getClientIp` returns `"unknown"`
- **AND** a spoofed `x-forwarded-for` is ignored when `x-vercel-forwarded-for` is set

#### Scenario: [OA-DST-050] initRateLimiter env policy
- **WHEN** the env has neither Upstash variable set and `NODE_ENV=test`
- **THEN** the returned limiter has `mode: "disabled"` and silently returns `{ configured: false }` from `check()`
- **AND** when `VERCEL_ENV=production` and Upstash variables are missing, a `rate_limiter_init` `console.error` is emitted with `reason: "durable_store_required_but_unconfigured"`
- **AND** when both `KV_REST_API_*` and `UPSTASH_REDIS_REST_*` are set, the limiter posts to the URL from `KV_REST_API_URL` with the token from `KV_REST_API_TOKEN`

#### Scenario: [OA-DST-051] Upstash limiter atomic multi-exec request shape
- **WHEN** `check()` runs against a configured Upstash limiter
- **THEN** exactly one `POST <restUrl>/multi-exec` is issued
- **AND** the body is a two-command array `[["INCR", <key>], ["PEXPIRE", <key>, <windowMs>]]` where the second key matches the first
- **AND** the key contains the bucket name and the IP
- **AND** when the returned `INCR` result is below the limit, the state is `{ allowed: true, remaining: <limit - count> }`
- **AND** when the returned `INCR` result exceeds the limit, the state is `{ allowed: false, remaining: 0 }`

#### Scenario: [OA-DST-052] Fails open on Redis errors
- **WHEN** `fetch` throws or returns a non-2xx HTTP status during a rate-limit check
- **THEN** `check()` returns `{ configured: false }`
- **AND** a `rate_limit_runtime_error` `console.warn` is emitted

#### Scenario: [OA-DST-053] combineState picks the binding bucket
- **WHEN** any input state is `{ allowed: false }`
- **THEN** `combineState` returns that blocked state
- **AND** when all inputs are allowed, the result is the input with the lowest `remaining`
- **AND** when all inputs are `{ configured: false }`, the result is `{ configured: false }`
- **AND** when one input is unconfigured and another is configured, the configured state is surfaced
