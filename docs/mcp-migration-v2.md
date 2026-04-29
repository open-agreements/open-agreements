# Hosted MCP Migration Guide (v2 Envelope Contract)

This guide covers migration from prose-style MCP tool output to the versioned JSON envelope contract introduced on **February 19, 2026**.

## What Changed

All tools (template and signing) now return a single JSON envelope in `result.content[0].text`.

```json
{
  "ok": true,
  "tool": "fill_template",
  "schema_version": "2026-02-19",
  "data": {}
}
```

Error responses now use the same envelope shape with `ok: false` and a structured `error` object.

```json
{
  "ok": false,
  "tool": "get_template",
  "schema_version": "2026-02-19",
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template not found: \"...\"",
    "retriable": false,
    "details": {}
  }
}
```

## New/Updated Tools

- `list_templates`
- `get_template` (new)
- `fill_template` (updated)
- `send_for_signature` (updated)
- `check_signature_status` (updated)

## `list_templates` Modes

- `mode: "compact"` (default): minimal index entries (`template_id`, `name`, `field_count`)
- `mode: "full"`: full field metadata for each template

## `fill_template` Return Modes

- `url` (default): `{ download_url, download_id, expires_at, metadata }`
- `mcp_resource`: `{ resource_uri, download_url, download_id, content_type, expires_at, metadata }`

`mcp_resource` returns preview-style `resource_uri` values (`oa://filled/{download_id}`) with `download_url` fallback.
For best performance and reliability, use `return_mode: "url"` and download bytes directly:

```bash
curl -L "$DOWNLOAD_URL" -o filled.docx
```

## Error Code Taxonomy

| Code | Meaning | Retriable |
|---|---|---|
| `MISSING_REQUIRED_FIELDS` | Required fields missing | `false` |
| `INVALID_ARGUMENT` | Invalid tool arguments or unsupported values | `false` |
| `AUTH_REQUIRED` | Authentication required | usually `false` until auth changes |
| `RATE_LIMITED` | Throttled due to request limits | `true` |
| `TEMPLATE_NOT_FOUND` | Unknown template ID | `false` |
| `DOWNLOAD_LINK_INVALID` | Malformed or signature-invalid download ID | `false` |
| `DOWNLOAD_LINK_EXPIRED` | Download link expired | `false` |
| `DOWNLOAD_LINK_NOT_FOUND` | Download ID not found in TTL store | `false` |
| `INTERNAL_ERROR` | Unexpected server error during tool execution | `false` |

## `/api/download` Contract

- Query parameter: `id` (required)
- Methods:
  - `GET` returns DOCX bytes on success
  - `HEAD` returns status-only probe semantics with no response body
- Machine-readable errors:
  - `DOWNLOAD_ID_MISSING`
  - `DOWNLOAD_ID_MALFORMED`
  - `DOWNLOAD_SIGNATURE_INVALID`
  - `DOWNLOAD_EXPIRED`
  - `DOWNLOAD_NOT_FOUND`
  - `DOWNLOAD_RENDER_FAILED`

## Auth and Rate-Limit Metadata

### Rate-limit envelope shape

Success envelopes include `data.rate_limit` with these fields:

```json
{
  "limit": 600,
  "remaining": 597,
  "reset_at": "2026-04-24T00:01:00.000Z",
  "bucket": "mcp:global"
}
```

When the limiter is unconfigured (dev/test, or runtime fail-open after a Redis error), all four fields are `null`.

Two per-IP buckets are enforced:
- `mcp:global` — every authoritative POST to `/api/mcp`, including JSON-RPC notifications. Default 600/min/IP. Override via `OA_MCP_RATE_LIMIT_GLOBAL`.
- `mcp:fill` — `tools/call` with `name === "fill_template"`. Checked in addition to global. Default 120/min/IP. Override via `OA_MCP_RATE_LIMIT_FILL`.

For a `fill_template` call, the reported `bucket` field is whichever bucket has fewer `remaining` (the binding constraint).

### Block contract

When a request is rate-limited, the endpoint returns:
- HTTP `200` with a JSON-RPC `result.content[0].text` envelope where `ok: false`, `error.code: "RATE_LIMITED"`, `error.retriable: true`.
- `error.details.rate_limit` has the same `{ limit, remaining: 0, reset_at, bucket }` shape so clients can compute backoff.
- HTTP header `Retry-After: <seconds>` for any infrastructure tooling that keys off it.

HTTP 200 is intentional: it preserves the JSON-RPC envelope contract used elsewhere in this endpoint, and avoids known interop issues with HTTP 429 + `Retry-After` in current MCP clients (see [modelcontextprotocol/typescript-sdk#1922](https://github.com/modelcontextprotocol/typescript-sdk/issues/1922)).

### Storage and failure policy

Rate-limit counters are kept in Upstash Redis via the REST `/multi-exec` endpoint (atomic `INCR` + `PEXPIRE`, single round trip). Configure with `KV_REST_API_URL` / `KV_REST_API_TOKEN` (preferred) or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

- Dev/test (env vars unset): limiter is disabled; success envelopes show `null` rate-limit fields.
- Production with Redis transient failure: fail open with one `console.warn` per failed call.
- Production (`VERCEL_ENV=production|preview`) with env vars *missing entirely*: loud `console.error` at init time. Still fails open at runtime — refusing all traffic because the limiter cannot run is worse than the abuse it mitigates.

### Auth carve-out

Auth and rate-limit error codes are defined for forward compatibility. Clients should branch on error `code` and `retriable` instead of string matching.

Current carve-out: auth failures on protected `tools/call` requests are still returned at the HTTP boundary as `401`/`403` with a JSON-RPC `-32001` body, not as an `AUTH_REQUIRED` envelope. Migrating this boundary to the envelope is tracked as a follow-up.

## Browser GET Behavior

Direct browser GET requests to `/api/mcp` now return a human-readable HTML instruction page when `Accept: text/html` is present.

Non-browser GET requests still return `405` JSON errors. MCP client behavior over POST is unchanged.

## Client Migration Checklist

1. Parse `result.content[0].text` as JSON.
2. Branch on `envelope.ok`.
3. Handle `envelope.error.code` (avoid parsing free-form text).
4. Use `fill_template.return_mode: "url"` and download via `download_url` out-of-band.
5. Add support for `get_template`.
6. Parse signing tool responses using the same envelope contract as template tools.

## Migrating Signing-Tool Clients

Before this change, signing tools returned a different shape:

```json
{
  "tool": "send_for_signature",
  "status": "ok",
  "envelope_id": "abc-123",
  "review_url": "https://app.docusign.com/..."
}
```

After this change, they use the standard v2 envelope:

```json
{
  "ok": true,
  "tool": "send_for_signature",
  "schema_version": "2026-02-19",
  "data": {
    "envelope_id": "abc-123",
    "review_url": "https://app.docusign.com/...",
    "status": "created",
    "signers": [...],
    "rate_limit": { "limit": null, "remaining": null, "reset_at": null, "bucket": null },
    "auth": null
  }
}
```

Error responses also use the v2 envelope:

```json
{
  "ok": false,
  "tool": "send_for_signature",
  "schema_version": "2026-02-19",
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "No DocuSign connection found. Use connect_signing_provider first.",
    "retriable": false,
    "details": { "reason": "NO_SIGNING_PROVIDER" }
  }
}
```

Signing error `details.reason` values: `NO_SIGNING_PROVIDER`, `INVALID_DOCUMENT`, `NOT_FOUND`, `SEND_FAILED`, `STATUS_FAILED`, `DISCONNECT_FAILED`, `SIGNING_NOT_CONFIGURED`.
