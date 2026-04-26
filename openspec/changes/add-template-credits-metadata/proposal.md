# Change: Add Template Credits and Provenance Metadata

## Why

Templates today carry free-form `attribution_text` for licensing language but
no structured, machine-readable way to credit the individuals who materially
shaped them, and no dedicated field for naming the source materials a template
was derived from. Free-text attribution mixes legal licensing with authorship
and cannot power features like a contributor footer on the documentation site,
credit-aware search, or honest provenance surfaces.

Naming an individual as "author" on a synthesized legal document also
misrepresents textual origin. A controlled, role-labeled credit shape
(`drafter` / `drafting_editor` / `reviewer` / `maintainer`) paired with a
neutral `derived_from` string makes provenance honest without overclaiming
authorship, and avoids free-text role governance debt as the project scales.

## What Changes

- Extend `TemplateMetadataBaseSchema` with two optional fields:
  - `credits: array<{ name, role, profile_url? }>` where `role` is a closed
    enum (`drafter`, `drafting_editor`, `reviewer`, `maintainer`), defaulting
    to `[]`.
  - `derived_from: string` (optional) naming the source materials.
- Surface `credits` and `derived_from` in `open-agreements list --json`
  output for internal and external templates (not recipes).
- Populate the two SAFE consent templates (`openagreements-board-consent-safe`,
  `openagreements-stockholder-consent-safe`) with Joey Tsang as
  `drafting_editor` and neutral `derived_from` language.
- Regenerate the committed `data/templates-snapshot.json`.
- Document the new optional fields in `docs/adding-templates.md` and add a
  `Template credits` policy section to `CONTRIBUTING.md`.
- Keep `attribution_text` untouched and orthogonal — continues to carry
  licensing text only.
- Keep MCP and remote A2A/MCP API responses unchanged — credits do not flow
  to agent-consumed surfaces in this change.

Non-goals:

- No MCP or remote API propagation of `credits` / `derived_from`.
- No changes to `TemplateListItem` in `src/core/template-listing.ts` and no
  new public exports from `src/index.ts`.
- No changes to recipe metadata; credits are a template concept.

## Impact

- Affected specs: `open-agreements` (adds one new requirement covering the
  credits schema + list projection).
- Affected code:
  - `src/core/metadata.ts` — Zod schema additions (module-local helper types).
  - `src/commands/list.ts::runListJson` — projection for internal + external
    template blocks.
  - `content/templates/openagreements-board-consent-safe/metadata.yaml` —
    populate credits + derived_from.
  - `content/templates/openagreements-stockholder-consent-safe/metadata.yaml` —
    populate credits + derived_from.
  - `data/templates-snapshot.json` — regenerated.
  - `docs/adding-templates.md`, `CONTRIBUTING.md` — author guidance + policy.
  - `src/core/metadata.test.ts`, `integration-tests/list-command.inprocess.test.ts`
    — new contract assertions.
