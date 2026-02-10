# Change: Extract source document guidance into recipe knowledge files

## Why

Recipe source documents (e.g., NVCA model agreements) contain expert legal
commentary — footnotes, `[Comment: ...]` blocks, and preliminary notes —
that explain *why* fields exist, what the implications of different values
are, and how sections interact. Today, the cleaner removes this content to
produce a clean fillable document, but the knowledge is lost. An AI agent
or human filling the document has no access to the guidance that the
original authors intended to accompany the form.

## What Changes

- The cleaner captures removed content (footnotes, pattern-matched
  paragraphs, range-deleted blocks) as structured data **before** deleting
  it from the DOCX.
- When `--extract-guidance <path>` is passed to `recipe clean`, a
  `guidance.json` file is written to the specified path containing the
  extracted text organized by source type and document position.
- The `cleanDocument()` API return type changes from `string` to
  `{ outputPath: string; guidance?: GuidanceOutput }`. An `extractGuidance`
  option controls whether extraction occurs. Existing callers are updated.
- Guidance is a **local-only, authoring-time** artifact. It is NOT committed
  to the repository or shipped in the npm package (see Licensing section).

## Licensing / Redistribution

Extracted guidance is verbatim source text — the exact words written by the
document authors. For recipes like NVCA, the source documents are "freely
downloadable but not redistributable" (`metadata.yaml` `license_note`).
Committing verbatim extracted commentary to `recipes/` and shipping it via
npm would violate the same redistribution constraints that motivated the
recipe architecture in the first place.

**Decision: local-only generation.** Guidance is generated on the user's
machine from their locally downloaded DOCX during `recipe clean
--extract-guidance`. The output file is written to a user-specified path
(not into the recipe directory). The repo and npm package never contain
`guidance.json` for non-redistributable sources.

For sources with permissive licenses (e.g., CC BY 4.0 templates), guidance
*could* be committed, but this proposal does not require it. The feature is
opt-in and authoring-time only.

## Benefits

### Why programmatic extraction (not manual curation)

1. **Maintainability.** The source document is the single source of truth.
   When the publisher releases a new version (e.g., NVCA updates their model
   agreement), re-running `recipe clean` re-extracts the guidance
   automatically. No manual maintenance step, no staleness window, no
   forgotten updates.

2. **Trustworthiness.** The comments were written by domain experts —
   securities lawyers at a national coalition. Programmatic extraction
   preserves their exact language. Any summarization (by a human or AI)
   introduces interpretation risk. Raw text has clear provenance: "this came
   directly from the source document."

3. **Completeness.** An AI agent can summarize verbose legal commentary on
   the fly — that's cheap. What it cannot do is recover information that was
   discarded. Given both raw extraction and a curated summary, an agent would
   read the raw extraction. Given only a summary, it would worry about what
   was lost.

4. **Zero-cost baseline.** Programmatic extraction requires no authoring
   effort per recipe. Every recipe that already has a `clean.json` gets
   guidance extraction for free. Manual curation can be layered on top later
   (e.g., a `guidance-notes.md` authored by a human) without conflicting.

### Why reference-only (not CLI-integrated)

The guidance is judgment-informing context ("Section 145(a) permits
indemnification for X, so consider Y"), not structured data the CLI can act
on mechanically. Surfacing it as warnings or field-level hints would require
a mapping layer between comment text and specific fields — complexity that
adds maintenance burden without clear user value. AI agents already read
recipe directory contents; adding a well-structured JSON file is the minimum
viable integration.

## Impact

- Affected specs: `open-agreements` (DOCX Cleaner, Recipe CLI Subcommands)
- Affected code: `src/core/recipe/cleaner.ts` (extraction logic + return
  type change), `src/core/metadata.ts` (Zod schemas), `src/commands/recipe.ts`
  (new `--extract-guidance` flag)
- CLI change: new `--extract-guidance <path>` flag on `recipe clean`
- API change: `cleanDocument()` returns `{ outputPath, guidance? }` instead
  of `string` (callers updated)
- No breaking changes to user-facing fill behavior
