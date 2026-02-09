## Context

YC's Post-Money SAFE documents are the de facto standard for early-stage startup investment. They are released under CC-BY-ND 4.0, which permits redistribution of unmodified copies but prohibits distribution of derivative works. The repo's existing architecture has two tiers:

1. **Templates** (CC-BY-4.0 / CC0): Committed DOCX files with `{tag}` placeholders pre-baked. Filling is a single-step operation.
2. **Recipes** (non-redistributable): Only transformation instructions in the repo. The source DOCX is downloaded at runtime.

The YC SAFE doesn't fit either tier: it's redistributable (unlike recipes) but can't be pre-modified (unlike templates). A new `external/` directory bridges this gap. From the user's perspective, `fill` and `list` present all agreements uniformly — the distinction between `templates/` and `external/` is an implementation/compliance detail.

## Goals / Non-Goals

### Goals
- Ship YC SAFE DOCX files in the repo for offline/batteries-included use
- Respect CC-BY-ND 4.0: never commit a modified copy of the DOCX
- Reuse the recipe engine's clean/patch/verify stages without code duplication
- Support 3 SAFE variants + Pro Rata Side Letter (4 documents total)
- Unified `fill` and `list` experience — users don't care about tiers
- Clear attribution and licensing in the repo
- CLI warning about redistribution restrictions on filled output

### Non-Goals
- Modifying the YC SAFE legal text (violates CC-BY-ND)
- Supporting arbitrary external document formats (only DOCX for now)
- Automatically updating external files when YC releases new versions (manual process)
- A `post-install` download script (shipping the files is the chosen approach)
- Unifying the recipe tier into this change (recipes remain download-at-runtime; future work may reconsider)

## Evidence

### Verified YC download URLs (as of Feb 2026)
The official YC SAFE documents page (ycombinator.com/documents) links four DOCX downloads:
- Valuation Cap: `https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20Valuation%20Cap%20Only%20-%20FINAL-f2a64add6d21039ab347ee2e7194141a4239e364ffed54bad0fe9cf623bf1691.docx`
- Discount: `https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20Discount%20Only%20-%20FINAL-b9ecb516615d60c6c4653507442aa2561023004368232b7d6e75edc9629acc99.docx`
- MFN: `https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20MFN%20Only%20-%20FINAL-2bc87fa3d2ec5072a60d653aec9a885fb43879781e44341fa720a8e7d1cc42ff.docx`
- Pro Rata Side Letter: `https://bookface-static.ycombinator.com/assets/ycdc/Pro%20Rata%20Side%20Letter-d6dd8d827741862b18fba0f658da17fb4e787e5f2dda49584b9caea89bf42302.docx`

The "Valuation Cap and Discount" combined variant is **not** currently offered as an official download. Scope is 4 documents.

### SHA-256 hashes
- Valuation Cap: `185d24f5bcf13acdf1419bf1d420771088da5dea3b3f3e0cdc7fa5df643649c4` (55,762 bytes)
- Discount: `93d606fc568e39673ab96c581850ece30b4f478972b7b4d4d132df695264b5a5` (47,628 bytes)
- MFN: `d3ad99466059b6f4d838e8e5daeeff5752e9866e6b557c6056df772f8509e727` (49,313 bytes)
- Pro Rata Side Letter: `9b769a6a724da0c40e6649df8c774f49cc20dafe7247cc366ce4b98b4c2a3510` (22,921 bytes)

### Placeholder pattern (validated)
All 4 DOCX files use `[bracket]` placeholders — the recipe patcher works as-is. Smart quotes (U+201C/U+201D) are used in the document text. Key findings:

**Valuation Cap** (9 placeholders): `[Company Name]`, `[Investor Name]`, `[Date of Safe]`, `[State of Incorporation]`, `[Governing Law Jurisdiction]`, `[COMPANY]`, `[name]`, `[title]`, `[_____________]` (×2 in different paragraphs: Purchase Amount and Valuation Cap). The two identical underscore blanks are in separate paragraphs, so context-based replacement keys (including surrounding text) can disambiguate them.

**Discount** (11 placeholders): Same as Valuation Cap plus `[COMPANY NAME]`, `[100 minus the discount]`, `[__________]` (Purchase Amount only; no valuation cap blank).

**MFN** (10 placeholders): Same as Valuation Cap except no valuation cap blank. Has `[COMPANY NAME]`, `[_____________]` (Purchase Amount only).

**Pro Rata Side Letter** (7 placeholders): `[Company Name]`, `[COMPANY NAME]`, `[Investor Name]`, `[INVESTOR NAME]`, `[Date of Safe]`, `[name]`, `[title]`.

### OSS precedent
No credible open-source precedent was found for a public repo vendoring YC SAFE DOCX files verbatim. Commercial tools exist but that's a different context. This should be treated as novel.

## Decisions

### 1. Top-level `external/` directory

- **Decision**: Place external templates in a top-level `external/` directory, sibling to `templates/` and `recipes/`.
- **Why**: The existing `src/commands/list.ts` and `src/commands/validate.ts` enumerate every directory under `templates/` as a template ID. Placing external templates under `templates/vendor/` would cause `list` to treat `vendor` as a broken template and `validate` to fail. A sibling directory avoids this collision entirely without requiring reserved-name hacks. The name `external` accurately describes the source (third-party files we import) without imposing a user-facing mental model.
- **Alternatives**: (a) `templates/vendor/` with reserved name — requires modifying enumeration to skip `vendor`, fragile. (b) `vendored/` — implementation jargon, not meaningful to end users or business owners. (c) `forms/` — too generic, doesn't convey the "imported from elsewhere" aspect.

### 2. Expand `LicenseEnum` and redefine `allow_derivatives`

- **Decision**: Add `CC-BY-ND-4.0` to the existing `LicenseEnum`. Redefine `allow_derivatives: false` to mean "the committed source file must not be modified" rather than "the tool must not render filled output." Update `validateLicense()` in `src/core/validation/license.ts` and the fill guard in `src/commands/fill.ts` to distinguish between template types when `allow_derivatives` is false.
- **Why**: The user chose to redefine rather than add a new field. The existing CC-BY templates all have `allow_derivatives: true`, so redefining the `false` semantics doesn't change any current behavior — no existing template has `allow_derivatives: false`. The fill command will use directory context (templates/ vs external/) to determine the fill strategy.
- **What changes in code**: `validateLicense()` no longer hard-blocks rendering when `allow_derivatives: false`. Instead, the fill command checks whether the template is in `external/` and routes to the external fill pipeline (with integrity check + runtime patching). The validate command checks that no external DOCX has been modified (SHA-256 hash).
- **Alternatives**: (a) Separate `VendoredLicenseEnum` — adds a parallel type system. (b) New `source_no_derivatives` field — cleaner semantics but introduces a redundant boolean alongside `allow_derivatives`. (c) Discriminated union with `tier` field — requires migrating existing metadata.yaml files.

### 3. `ExternalMetadataSchema` extending template metadata

- **Decision**: Create `ExternalMetadataSchema` that extends `TemplateMetadataSchema` with `source_sha256: z.string()`. Use the same `FieldDefinitionSchema` for fields. External templates also require `replacements.json` and optional `clean.json` (same format as recipes).
- **Why**: External templates share most metadata properties with regular templates (name, description, source_url, version, license, attribution_text, fields). The only addition is the SHA-256 hash for integrity verification. Keeping schemas aligned reduces drift and makes the unified `list --json` output consistent.
- **Shared internals**: Both template and external metadata produce the same "list item" shape for `list` output and skill discovery. A mapping function converts either schema to a common display type.
- **Alternatives**: (a) Three fully separate schemas — maximum drift risk. (b) Single schema with all fields optional — loses type safety.

### 4. Unified `fill` command (templates + external only)

- **Decision**: The `fill` command searches `templates/` first, then `external/`. For regular templates, it calls `fillTemplate()` directly. For external templates, it runs the clean → patch → fill → verify pipeline on the local DOCX. Recipes remain exclusively under `recipe run`.
- **Why**: From the user's perspective, `fill yc-safe-valuation-cap` should feel identical to `fill bonterms-mutual-nda`. The implementation detail (runtime patching vs. direct fill) should be invisible. Recipes are kept separate because they require network downloads, which can surprise offline users or agents.
- **ID collision handling**: If a template ID exists in both `templates/` and `external/`, `templates/` wins (first match). This is unlikely in practice but documented.
- **Alternatives**: (a) Truly unified fill for all three tiers — requires `--allow-download` flag and offline safety model, out of scope. (b) `vendor fill` subcommand — users must know the tier. (c) `fill --external` flag — same problem.

### 5. Unified `list` with Source column

- **Decision**: `list` outputs a single table with all agreements (templates + external). Add a "Source" column showing the originating organization (e.g., "Common Paper", "Bonterms", "Y Combinator"). Do not separate into "Templates" and "External" sections.
- **Why**: Users don't care about the underlying licensing tier. They want to see all available agreements in one place. The Source column provides useful context without forcing a compliance mental model.
- **Alternatives**: (a) Separate sections per tier — splits user attention, forces tier awareness. (b) No source column — loses useful context about document origin.

### 6. SHA-256 integrity enforcement (strict)

- **Decision**: Store a SHA-256 hash of the original DOCX in `metadata.yaml` (`source_sha256` field). Both `validate` and `fill` verify the committed DOCX matches this hash. Keep the hash strict (binary comparison, not text-content-based).
- **Why**: CC-BY-ND compliance requires the distributed file to be unmodified. A binary hash is the strongest guarantee. Text-content hashing would miss metadata/formatting changes that could constitute derivatives.
- **Workflow for updates**: Never re-save a DOCX through Word. Always re-download from `source_url`. Update `source_sha256` and `version` together. The `validate` command prints expected vs. actual hash on mismatch to ease debugging.
- **Alternatives**: (a) Text-content hash — weaker guarantee, misses XML structure changes. (b) Git hooks — brittle, not portable. (c) No hash — relies on human diligence.

### 7. CLI redistribution warning

- **Decision**: When filling an external template, print a notice: "This is an external document (CC-BY-ND 4.0). You may fill it for your own use, but do not redistribute modified versions. See [source URL] for license terms."
- **Why**: CC-BY-ND allows creating adapted material privately but restricts sharing it. Filling a SAFE for your own deal is fine; publishing a filled SAFE template as a new product is not. The warning should inform, not scare — users are mostly closing deals, not redistributing.
- **YC's own language**: YC describes their SAFEs as unchanged "except to fill in blanks and bracketed terms," which supports the intended usage model.
- **Alternatives**: (a) Hard-block without confirmation — too aggressive for the intended use case. (b) No warning — leaves users uninformed about redistribution restrictions.

## Risks / Trade-offs

1. **CC-BY-ND interpretation risk** — "Filling in blanks" is widely accepted as non-derivative, and YC's own language supports it, but there's no case law specifically on programmatic bracket replacement. No OSS precedent for vendoring YC SAFE DOCX files was found. **Mitigation**: The committed DOCX is unmodified; runtime patching happens in a temp directory. CLI warns about redistribution.

2. **User output redistribution** — A filled SAFE may constitute an "adapted work" under CC-BY-ND. Distributing filled output publicly could violate the license. **Mitigation**: CLI warning on every external fill. Documentation in `docs/licensing.md` explicitly notes this risk. This is ultimately the user's responsibility, consistent with how every legal template tool works.

3. **YC updates SAFE documents** — If YC releases a new version, external files become stale. **Mitigation**: `metadata.yaml` includes `source_url` and `version` for manual update tracking. `source_sha256` catches accidental drift. Documented workflow: re-download, update hash+version, re-test replacements.

4. **Placeholder pattern assumption** — The recipe patcher assumes `[bracket]` placeholders. If YC SAFEs use underscores or content controls, the patcher may need extension. **Mitigation**: Task 6 gates the approach on `scan` output before any template authoring begins.

5. **DOCX format variations** — Different Word versions produce different XML for the same visual content. **Mitigation**: Pin to specific versions by URL and SHA-256 hash. Test replacement mappings against the exact file.

6. **Repo size** — Adding 4 DOCX files. **Mitigation**: SAFE DOCX files are typically <100KB each; total impact is negligible.

## Migration Plan

No migration of existing data needed — this is a new tier. However:
- `allow_derivatives` semantics change in code. Existing templates all have `allow_derivatives: true`, so no behavior change for them.
- `LicenseEnum` gains a new value (`CC-BY-ND-4.0`). Existing templates use `CC-BY-4.0` or `CC0-1.0`, so no impact.
- `fill` command gains new search path (`external/`). Existing template IDs are unaffected since `templates/` is searched first.

## Open Questions

1. **Placeholder pattern** — Do YC SAFE DOCX files actually use `[bracket]` placeholders, or underscores/content controls? This must be validated by downloading and scanning before committing to the patcher approach (Task 6).

2. **Shared schema maintenance** — `ExternalMetadataSchema` extends `TemplateMetadataSchema`. If template metadata evolves (new fields, changed validation), external metadata inherits those changes. Is this coupling acceptable, or should we extract a shared `BaseMetadataSchema` that both extend independently?

3. **Recipe tier future** — The user expressed interest in eventually moving recipes toward a vendored/external model too (downloading at runtime is friction for AI agents). This change doesn't address recipes, but the `external/` pattern could inform a future recipe-to-external migration.

4. **ID namespace collisions** — With `fill` searching both `templates/` and `external/`, a template ID like `mutual-nda` could theoretically exist in both. Current decision: `templates/` wins. Should we enforce uniqueness across directories instead?
