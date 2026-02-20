# Hosted MCP Migration Guide (v2 Envelope Contract)

This guide covers migration from prose-style MCP tool output to the versioned JSON envelope contract introduced on **February 19, 2026**.

## What Changed

All template tools now return a single JSON envelope in `result.content[0].text`.

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
- `download_filled` (new)

## `list_templates` Modes

- `mode: "full"` (default): full field metadata for each template
- `mode: "compact"`: minimal index entries (`template_id`, `name`, `field_count`)

## `fill_template` Return Modes

- `url` (default): `{ download_url, download_id, expires_at, metadata }`
- `base64_docx`: `{ docx_base64, content_type, metadata }`
- `mcp_resource`: `{ resource_uri, download_url, download_id, content_type, expires_at, metadata }`

`mcp_resource` returns preview-style `resource_uri` values (`oa://filled/{download_id}`) with `download_url` fallback.

## `download_filled`

Use `download_filled` to retrieve base64 DOCX in-protocol using the previously issued `download_id`.

Input:
```json
{ "download_id": "..." }
```

Success data includes `docx_base64`, `content_type`, template metadata, and `download_expires_at`.

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

- Success envelopes include placeholder rate metadata fields (`limit`, `remaining`, `reset_at`) as `null` until rate limiting is wired.
- Auth and rate-limit error codes are defined for forward compatibility.
- Clients should branch on error `code` and `retriable` instead of string matching.

## Browser GET Behavior

Direct browser GET requests to `/api/mcp` now return a human-readable HTML instruction page when `Accept: text/html` is present.

Non-browser GET requests still return `405` JSON errors. MCP client behavior over POST is unchanged.

## Client Migration Checklist

1. Parse `result.content[0].text` as JSON.
2. Branch on `envelope.ok`.
3. Handle `envelope.error.code` (avoid parsing free-form text).
4. Choose explicit `fill_template.return_mode` where needed.
5. Add support for `get_template` and `download_filled` in client flows.
