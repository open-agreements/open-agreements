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
- **AND** `list_templates` success envelopes include pagination fields `total_count` (non-negative integer) and `next_cursor` (opaque string or `null` on the last page)
- **AND** browser GET returns HTML, non-browser GET returns 405
- **AND** success envelopes include `data.rate_limit` with fields `limit`, `remaining`, `reset_at`, and `bucket` (all `null` when the limiter is unconfigured or fails open)

## ADDED Requirements

### Requirement: MCP list_templates Returns Paginated Compact Catalog
The MCP `list_templates` tool SHALL return a compact-only, paginated view
of the template catalog suitable for discovery. The full per-field detail
of any single template SHALL only be available via `get_template`.

The input schema accepts only two optional fields:

- `cursor` — opaque base64 string returned by the previous response. Implementations MAY decode it as `"after:" + template_id` internally; the wire contract is opaque.
- `limit` — positive integer, default `25`, maximum `100`. Out-of-range values (`< 1`, `> 100`, non-integer) MUST be rejected with `INVALID_ARGUMENT`.

Sending `mode` (the legacy parameter) or any other field MUST be rejected
with `INVALID_ARGUMENT`.

Each emitted template SHALL carry exactly these fields, in this shape:

```jsonc
{
  "template_id": "openagreements-restrictive-covenant-wyoming",
  "display_name": "Wyoming Restrictive Covenant",
  "category": "employment",
  "description": "Short one-line description.",
  "field_count": 28,
  "priority_field_count": 8
}
```

No `fields` array, no `license`, no `name` alias for `template_id`. The full
per-field detail must be fetched via `get_template`. `display_name` MUST be
non-empty: implementations SHALL fall back to `template_id` at runtime if
upstream metadata lacks a name, and the metadata schema SHALL reject empty
or whitespace-only `name` so `npm run validate` (the CI preflight surface)
fails before such metadata can be committed. The schema-level guard is the
primary defense; the runtime fallback is defense-in-depth for unverified
content sources.

The catalog SHALL be returned in stable lexicographic order by `template_id`
under `localeCompare`. Pagination uses a `template_id` boundary cursor:
each response carries `next_cursor` set to the last emitted `template_id`
(opaque base64), and the next request returns templates whose `template_id`
is strictly `>` the decoded cursor. `next_cursor` MUST be `null` on the
final page. Invalid cursors (malformed base64, wrong prefix, or pointing
beyond the catalog tail) MUST be rejected with `INVALID_ARGUMENT`.

The success envelope SHALL also include `total_count` — the total number
of templates the call would return without pagination — so callers can
estimate progress.

#### Scenario: [OA-DST-054] Returns compact-only template shape
- **WHEN** a client calls `list_templates` with default arguments
- **THEN** the success envelope's `data.templates[*]` keys are exactly `template_id`, `display_name`, `category`, `description`, `field_count`, `priority_field_count`
- **AND** no template entry includes `fields`, `license`, `name`, or any other key

#### Scenario: [OA-DST-055] Pages the catalog with cursor + limit
- **WHEN** a client calls `list_templates` with `limit: 5` against a catalog of more than 5 templates
- **THEN** `data.templates.length` is `5`
- **AND** `data.next_cursor` is a non-null opaque string
- **AND** `data.total_count` equals the full catalog size
- **AND** a second call passing `cursor: <returned cursor>` returns templates strictly after the first page (no duplicates, no gaps)
- **AND** the final page returned during a full traversal has `next_cursor: null`

#### Scenario: [OA-DST-056] Maintains lexicographic continuity across pages
- **WHEN** a client pages through the catalog using `limit: 5`
- **THEN** for every adjacent page pair, the last `template_id` of page N satisfies `lastId.localeCompare(firstIdOfPageN+1) < 0`
- **AND** every page's templates are themselves sorted lexicographically by `template_id`

#### Scenario: [OA-DST-057] Rejects out-of-range limit
- **WHEN** a client calls `list_templates` with `limit: 0`, `limit: -1`, or `limit: 101`
- **THEN** the response is an `INVALID_ARGUMENT` error envelope
- **AND** the error message identifies `limit` as the offending field

#### Scenario: [OA-DST-058] Rejects invalid cursor
- **WHEN** a client calls `list_templates` with `cursor: "not-base64"`, `cursor: "<base64 of unrelated string>"`, or a cursor that decodes to a `template_id` beyond the catalog tail
- **THEN** the response is an `INVALID_ARGUMENT` error envelope
- **AND** the error message identifies the cursor as malformed or expired

#### Scenario: [OA-DST-059] Rejects legacy mode parameter
- **WHEN** a client calls `list_templates` with `arguments: { "mode": "full" }` (or any value)
- **THEN** the response is an `INVALID_ARGUMENT` error envelope
- **AND** the error message indicates the field is not allowed

#### Scenario: [OA-DST-060] display_name falls back to template_id when upstream metadata is empty
- **WHEN** a template's upstream metadata has an empty `name`
- **THEN** the emitted `display_name` equals the template's `template_id`
- **AND** `npm run validate` (the CI preflight surface that runs `TemplateMetadataSchema`) independently flags an empty `name` as a metadata error so it cannot be committed
