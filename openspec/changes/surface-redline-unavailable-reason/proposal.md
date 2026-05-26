# Change: Surface redline_unavailable_reason in fill_template envelope (opt-in)

## Why

When `fill_template` is called over MCP with `include_redline: true` (the
default), redline-generation failures are silently swallowed. The success
envelope omits the `redline_*` fields entirely whether the redline is
unsupported (non-recipe template), the redline generator threw, or the
redline-variant `createDownloadArtifact` call failed (e.g. KV outage). All
three outcomes look identical to the caller.

Today's redline branch at `api/mcp.ts:1090-1123`:

```ts
if (include_redline) {
  try {
    const redline = await generateRedlineFromFill(template, outcome.base64, redline_base, values);
    if (redline) {
      const redlineArtifact = await createDownloadArtifact(template, values, { variant: 'redline', redline_base });
      // populate redlineData
    }
    // null redline → silently no redline fields
  } catch (err) {
    logError({ event: 'tool_internal_error', endpoint: 'mcp', tool: TOOL_FILL_TEMPLATE,
      phase: 'redline', parentOk: true, /* ... */ });
  }
}
```

Both the `if (redline)` falsy branch and the outer `catch` produce identical
client-visible output: a success envelope with no redline fields. Clients
orchestrating workflows that requested redlines can falsely conclude
"this template doesn't support redlines" when the redline generator actually
crashed or the redline artifact write failed transiently. Server logs alone
are insufficient — the orchestrating client needs the signal in-band.

This change surfaces a new optional `redline_unavailable_reason` field in the
`fill_template` success envelope so callers can distinguish the three modes.

**Back-compat trap.** `include_redline` currently defaults to `true` for every
`fill_template` call (`api/mcp.ts:101`), and `generateRedlineFromFill` returns
`null` for non-recipe templates (`api/_shared.ts:253`). If the new field were
emitted whenever the redline is `null`, *most* non-recipe fills would start
carrying the field by default — a meaningful shape change for every existing
client. The change therefore gates emission on the caller having **explicitly**
passed `include_redline: true`, detected on the raw JSON-RPC arguments before
Zod parsing (the schema's `.default(true)` strips the explicit/default
distinction after parsing).

Issue: [#227](https://github.com/stevenobiajulu/open-agreements/issues/227).

## What Changes

- **`api/mcp.ts`** — Before Zod parse, derive `includeRedlineExplicit` from
  the raw `args` (`args.include_redline === true`). Restructure the redline
  branch (lines 1090-1123) into nested try/catch so the secondary
  `createDownloadArtifact` failure can be distinguished from a
  `generateRedlineFromFill` failure. Add a `redline_unavailable_reason`
  field with three possible values (`'template_unsupported'`,
  `'store_unavailable'`, `'internal_error'`) and spread it into both the
  `url` and `mcp_resource` success envelopes — only when
  `includeRedlineExplicit && redlineUnavailableReason`. Add a new
  `phase: 'redline_artifact'` log discriminator for the inner-catch on the
  redline-variant `createDownloadArtifact`.
- **`integration-tests/api-endpoints.test.ts`** — Add 7 vitest cases in the
  `fill_template` `describe` block covering: explicit-opt-in
  `template_unsupported`, explicit-opt-in generator throw, explicit-opt-in
  `DownloadStoreRuntimeError`, explicit-opt-in `DownloadStoreConfigurationError`,
  explicit-opt-in happy path (negative assertion), default-omitted back-compat,
  and `mcp_resource` return-mode variant. Reuses the existing
  `MockDownloadStore*Error` hierarchy and the `vi.spyOn(console, 'error')`
  log-capture pattern.
- **`docs/mcp-migration-v2.md`** — Add `redline_unavailable_reason` to the
  `fill_template` success-data shape section with the explicit-opt-in
  semantics note.
- **`openspec/specs/open-agreements/spec.md`** — Apply the deltas in this
  change at archive time: add `'redline_artifact'` to the phase enumeration
  in the `Structured Lifecycle Logs for MCP HTTP Transport` requirement at
  line 1959; add a new requirement covering the `redline_unavailable_reason`
  field semantics.

## Out of scope

- Failing the whole fill on redline error (intentional best-effort design).
- Changing the redline algorithm itself.
- Surfacing the same signal at `/api/download` time (separate issue if needed
  — that endpoint already has its own `DOWNLOAD_RENDER_FAILED` taxonomy per
  `OA-DST-025`).
- Changing the `include_redline` default to `false` (Option 2 in the original
  issue — not selected; we picked Option 1, the explicit-opt-in gate).
- A `base_document_missing` reason — peer review confirmed there is no
  base-document fetch in the current redline pipeline; `redline_base` only
  selects between `recipeResult.stages.patch` and `.clean` at
  `api/_shared.ts:273`.
