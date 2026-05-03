# Change: Add Template Field Display Labels

## Why

Template fields today are identified by a stable canonical `name`
(snake_case, used as the fill-key) and described by a free-form
`description`. There is no structured, human-friendly label that downstream
discovery consumers (UIs, MCP-driven agents, the docs site) can render in
a form, table, or prompt without re-deriving one from the canonical name.

Re-deriving labels at the consumer is brittle: snake_case → Title Case
loses domain nuance ("nondealing" should not surface as "Nondealing"), and
each consumer ends up with a slightly different rendering. A single
optional `display_label` on the template metadata gives the template
author one place to curate the human-facing string while keeping `name`
stable for filling and automation.

This mirrors the precedent set by `add-template-credits-metadata`
(archived 2026-04-26): a small, additive metadata field with a
narrowly-scoped CLI projection and no MCP/A2A propagation.

## What Changes

- Extend `FieldDefinitionSchema` with one optional field:
  - `display_label: string` (optional, no default).
- Project `display_label` through `mapFields()` in
  `src/core/template-listing.ts` so it appears in the CLI `list --json`
  output. Use a conditional spread so the JSON object **omits** the key
  when the metadata does not declare a label (matches the `derived_from`
  precedent — undefined-means-omitted, never `null`).
- Mirror the type on the contract-templates MCP `TemplateField` interface
  for type-only forward compatibility, and **strip `display_label` from
  MCP tool payloads** (`list_templates`, `get_template`, including nested
  `items`) so the MCP runtime surface is unchanged in this proposal. The
  type addition is preparatory; the wire change is deferred.
- Define a consumer fallback rule: when `display_label` is absent,
  consumers SHOULD title-case the canonical `name` (replacing `_` with
  spaces). The fallback is a consumer convention, not a CLI behavior.
- Curate `display_label` on every user-facing field of
  `content/templates/openagreements-restrictive-covenant-wyoming/metadata.yaml`.
  Author guidance: AI-only fields (e.g. `worker_category`,
  `restriction_pathways`) and internal computed fields (e.g.
  `cloud_drive_id_footer`) SHOULD NOT carry a `display_label` — their
  description already says "Not shown in the output document," and
  curating a human label would invite consumers to surface them.
- Regenerate the committed `data/templates-snapshot.json` from the CLI
  JSON output.

Non-goals:

- No MCP `list_templates` / `get_template` tool description or payload
  change in this proposal. The MCP `TemplateField` interface adds
  `display_label` for type alignment only; tool payloads explicitly strip
  it. Surfacing it to LLM agents is a follow-up.
- No remote A2A/MCP API propagation.
- No changes to `attribution_text`, `credits`, or `derived_from`.
- No retroactive curation of labels across all templates. Wyoming is the
  first curated template; other templates remain unlabeled and rely on
  the consumer fallback.
- No CI lint enforcement of the AI-only/internal authoring convention in
  this proposal — it remains a guideline. A structured `visibility` field
  is a candidate for a follow-up if the convention proves insufficient.

## Impact

- Affected specs: `open-agreements` (one new requirement covering
  display_label parsing, CLI projection, MCP payload omission, and the
  authoring guideline for AI-only / internal fields).
- Affected code:
  - `src/core/metadata.ts` — `FieldDefinition` + `FieldDefinitionSchema`
    additions.
  - `src/core/template-listing.ts` — `TemplateListField.display_label?`
    and conditional spread in `mapFields()`.
  - `packages/contract-templates-mcp/src/core/tools.ts` — type-only
    `TemplateField.display_label?` mirror plus runtime stripping of
    `display_label` (and nested `items.display_label`) from
    `list_templates` / `get_template` payloads.
  - `content/templates/openagreements-restrictive-covenant-wyoming/metadata.yaml`
    — curated labels for user-facing fields only.
  - `data/templates-snapshot.json` — regenerated.
  - `src/core/metadata.test.ts`,
    `integration-tests/list-command.inprocess.test.ts`,
    `packages/contract-templates-mcp/tests/tools.test.ts` — new contract
    assertions (positive parse, negative `null` parse, CLI key-omission
    on the wire, MCP payload stripping).
