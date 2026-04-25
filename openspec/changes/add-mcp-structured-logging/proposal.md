# Change: Add structured request/error logs to api/mcp.ts with Vercel request-id propagation

## Why

The MCP HTTP handler at `api/mcp.ts` (deployed on Vercel at
`openagreements.org/api/mcp`) emits only sparse `console.error` calls on a
handful of error paths. Successful requests, auth failures, and malformed
envelopes leave no trace in Vercel runtime logs, and **no record correlates
back to the `x-vercel-id` header that Vercel attaches per request**. When a
client reports a problem against the remote MCP, support has to reconstruct
what happened from the platform's per-function log line — slow and often
impossible (issue #202).

The fix is to emit single-line structured JSON for every lifecycle event of
every MCP HTTP request, each tagged with the Vercel request id and the
JSON-RPC method/tool/id. Scope is HTTP-only: the CLI/STDIO path is untouched.

## What Changes

- **New `api/_log.ts`** — small HTTP-only helper exporting `getRequestContext`
  (reads `x-vercel-id`, derives `baseUrl` from forwarded headers),
  `redactBearer` (12-char sha256 fingerprint of a Bearer token),
  `normalizeError` (Error → `{ name, message, stack }` so `JSON.stringify`
  doesn't drop the detail), and `info`/`error` emitters that route to
  `console.log` / `console.error` respectively. The helper is endpoint-agnostic
  (caller passes `endpoint: 'mcp'`) so `api/download.ts` and `api/a2a.ts` can
  adopt it later without churn.
- **`api/mcp.ts`** — capture a per-request `ctx` (request id + base URL +
  session/user agent) and `startedAt` at handler entry. Thread `ctx` into
  `handleToolsCall` and `handleSigningToolCall` as a third parameter, and
  delete the previous module-scoped `_baseUrl` (race-prone in serverless).
  Emit `request_start`, `request_complete` (every non-OPTIONS terminal path,
  with `status`/`ok`/`durationMs`), `request_rejected_http_method`,
  `request_rejected_invalid_jsonrpc`, `notification`, `auth_denied` (with
  `tokenFp`, never the raw token), `tool_internal_error` (preserving
  `phase: 'fill'|'artifact'|'redline'|'signing'` and `cause` discriminators),
  and `unhandled_exception`.
- **`integration-tests/mcp-contract.test.ts`** — six new logging tests bound
  to `OA-DST-038`…`OA-DST-043` covering vercel-id propagation in success and
  error paths, bearer-token redaction on `auth_denied`, no fingerprint on
  non-auth-required successful paths, malformed-envelope logging, and the
  no-fallback-id rule when `x-vercel-id` is absent.

## Out of scope

- `api/download.ts` and `api/a2a.ts` adopting the helper (separate change).
- A logging dependency (pino, winston, etc.) — overkill for one helper file.
- A `/healthz` endpoint — issue #202 explicitly rules this out.
- CLI/STDIO logging — `src/cli/index.ts` does not import `api/`, so the new
  helper never reaches it.
