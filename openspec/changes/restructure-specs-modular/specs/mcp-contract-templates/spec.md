## ADDED Requirements
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

### Requirement: MCP Template Discovery Preserves Field Metadata
The MCP `get_template` tool SHALL surface field metadata details that agents
need to construct valid fill payloads. This includes nested array item schemas
for `{FOR}`-based templates and the `options` allowlist for `enum` and
`multiselect` fields so agents can pick or validate values without parsing
free-form descriptions or fetching `metadata.yaml` out of band.

#### Scenario: [OA-DST-033] get_template returns array item schemas
- **GIVEN** a template with an array field that declares nested `items`
- **WHEN** a client calls `get_template`
- **THEN** the returned field metadata includes the nested array item schema unchanged

#### Scenario: [OA-DST-061] get_template returns options for enum and multiselect fields
- **GIVEN** a template with an `enum` or `multiselect` field declaring an `options` array
- **WHEN** a client calls `get_template`
- **THEN** the returned field metadata includes the `options` array with the same values as the source metadata

#### Scenario: [OA-DST-062] get_template omits options for non-enum/non-multiselect fields
- **GIVEN** a template with `string`, `date`, `number`, `boolean`, or `array` fields
- **WHEN** a client calls `get_template`
- **THEN** none of those fields include an `options` key in the returned metadata
