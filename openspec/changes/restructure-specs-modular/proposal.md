# Change: Restructure monolithic `open-agreements` spec into modular capabilities

## Why

`openspec/specs/open-agreements/spec.md` has grown to 1,869 lines / 106 requirements covering everything from DOCX bracket normalization to npm tarball contents to closing-checklist JSON Patch idempotency to SAFE Consent recital authoring. It is no longer a useful unit of review, planning, or comprehension:

- Reviewers can't tell from a diff whether a change touches the CLI, the engine, or a content rule.
- A future DocuSign-style provider has nowhere natural to live.
- The capability namespace conflates entry-point surfaces (CLI / MCP) with cross-cutting concerns (license / validation / quality gates).
- Data-model "requirements" prose-duplicate the Zod schemas in `src/core/metadata.ts` and rot whenever the schema changes.
- Template-family specifics (SAFE / NVCA / Employment) pollute the engine spec.

This change splits the monolith along a **hybrid axis** (surface specs + concern specs), deletes data-model shape duplication in favor of Zod-as-source-of-truth, moves template-family rules out to per-template READMEs, and adds audience framing to `project.md` + README. **Single big-bang PR per user direction.**

## What Changes

- **ADDED** 10 new capability specs:
  - Surface: `engine`, `recipes`, `cli`, `mcp-contract-templates`, `closing-checklist`, `distribution`
  - Concern: `authoring`, `validation`, `ip-license`, `quality-gates`
- **RENAMED** capability `contracts-workspace` → `mcp-contracts-workspace` (contents unchanged).
- **MOVED** all 106 requirements from the `open-agreements` capability to their new homes (mapping captured in `design.md`).
- **DELETED** data-model shape-only requirements that duplicate Zod schemas in `src/core/metadata.ts`. Cross-field semantic invariants ("if license is non-derivative then recipe-mode is forbidden") remain in prose and reference the Zod schema.
- **DELETED** template-family requirements (SAFE / NVCA / Employment / Mutual NDA / Common Paper specifics). Equivalent content moves to per-template `README.md` skeletons in `content/templates/<id>/`.
- **EMPTIED** `openspec/specs/open-agreements/spec.md` (one-line tombstone pointing to the new capabilities).
- **UPDATED** `openspec/project.md` with audience framing (overworked GC at small business; AI-agent-readable rigour over lawyer-readable prose).
- **UPDATED** root README with a short "Who this is for" section (brand-led: Common Paper, Bonterms, NVCA, SAFE first; audience framing second).
- **REGENERATED** `openspec/id-mapping.json` so legacy `OA-NNN` IDs map to new capability paths.
- **REBASED** the 4 near-done in-flight changes (`restore-traditional-safe-consents`, `rename-contract-ir-content-to-template`, `add-typescript-mcp-server`, `add-template-display-labels`) onto new capability paths.

## Impact

- Affected specs: `open-agreements` (emptied), `contracts-workspace` (renamed), 12 new capabilities (created).
- Affected code: JSDoc enrichment on `src/core/metadata.ts` Zod schemas; new per-template READMEs under `content/templates/<id>/`; updates to `openspec/project.md`, root `README.md`, `openspec/id-mapping.json`.
- Affected in-flight changes: 4 near-done changes rebased; 6 stalled changes deferred to a separate cleanup pass.
- CI: `openspec validate --strict` must pass on every capability.
- Consumers of the legacy `OA-NNN` scenario IDs (via `openspec/id-mapping.json`): preserved through the regenerated mapping.
