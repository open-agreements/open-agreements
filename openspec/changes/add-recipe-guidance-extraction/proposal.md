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
- A new `guidance.json` file is written to the recipe directory during the
  clean step, containing the extracted text organized by source type and
  document position.
- The `guidance.json` file ships with the recipe and is available as a
  reference for AI agents and humans during fill.
- The CLI does **not** parse or surface `guidance.json` at fill-time — it is
  a reference document, not a runtime dependency.

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
recipe directory contents; adding a well-structured JSON file to that
directory is the minimum viable integration.

## Impact

- Affected specs: `open-agreements` (DOCX Cleaner, Recipe Pipeline)
- Affected code: `src/core/recipe/cleaner.ts` (extraction logic),
  `src/core/metadata.ts` (schema for guidance output), recipe directories
  (new `guidance.json` files)
- No CLI changes, no API changes, no breaking changes
- New file (`guidance.json`) is additive and optional — recipes without
  `clean.json` simply don't produce one
