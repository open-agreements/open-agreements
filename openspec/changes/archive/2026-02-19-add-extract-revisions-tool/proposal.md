# Change: Add `extract_revisions` MCP Tool

## Why

The comparison engine can produce a redline DOCX with track changes, and the `accept_changes` tool can strip them — but there is no way for an AI agent to **read** the tracked changes as structured data. The Python `mcp_redline_server` has this via `RevisionExtractionProcessor`, but it depends on Aspose Words (.NET interop) and is not available through the TypeScript MCP server.

Agents need to inspect what changed (before/after per paragraph, revision types, comments) to make decisions — e.g. reviewing a redline, summarizing edits, or deciding which changes to accept/reject individually.

## What Changes

- **NEW**: `extract_revisions` tool in `safe-docx-ts` MCP server
- **NEW**: `rejectChanges()` function in `docx-primitives-ts` (inverse of `acceptChanges()`)
- **NEW**: `extractRevisions()` function in `docx-primitives-ts` that walks a DOM with tracked changes and returns structured per-paragraph revision data
- **MODIFIED**: `DocxDocument` class — new `getDocumentXmlClone()` and `getCommentsXmlClone()` methods
- **MODIFIED**: `SessionManager` — extraction cache support
- **MODIFIED**: `mcp-server` spec — new requirement for revision extraction

## Impact

- Affected specs: `mcp-server` (new requirement)
- Affected code:
  - New: `packages/docx-primitives-ts/src/reject_changes.ts` (reject engine)
  - New: `packages/docx-primitives-ts/src/extract_revisions.ts` (core extraction engine)
  - New: `packages/safe-docx-ts/src/tools/extract_revisions.ts` (MCP tool handler)
  - Modified: `packages/docx-primitives-ts/src/document.ts` (DOM clone accessors)
  - Modified: `packages/safe-docx-ts/src/session/manager.ts` (extraction cache)
  - Modified: `packages/safe-docx-ts/src/server.ts` (register tool)

## Design Decisions

### DOM-based approach (not AST string-based)

The extraction engine uses the W3C DOM (`@xmldom/xmldom`) already in use by `acceptChanges()` and `getComments()` in `docx-primitives-ts`. This avoids adding a dependency on the docx-comparison AST acceptor, which operates on serialized XML strings and would require an extra serialize-parse round trip.

### Accept/reject via cloning for before/after text

Following the Python pattern: clone the DOM twice, `acceptChanges()` on one clone (→ after text), `rejectChanges()` on the other (→ before text). The `acceptChanges` function already exists in `docx-primitives-ts`. We add a `rejectChanges` function that mirrors it with inverse logic.

### Paragraph matching by `para_id`, not traversal position

**Critical design choice (from peer review).** Inserted/deleted/moved paragraphs shift DOM structure between accepted and rejected clones, so positional pairing is wrong. Instead:
1. Walk the **original tracked DOM** to identify paragraphs containing revision wrappers (`w:ins`, `w:del`, `w:moveFrom`, `w:moveTo`, `*PrChange`).
2. Use each paragraph's `jr_para_*` bookmark ID as the primary key.
3. Look up `before_text` in the rejected clone by `para_id` bookmark.
4. Look up `after_text` in the accepted clone by `para_id` bookmark.
5. Support paragraphs inside `w:tc` (table cells), not only direct `w:body` children.

### `rejectChanges()` correctness requirements

From peer review — three critical behaviors that differ from a naive `acceptChanges()` mirror:
1. **`w:delText` → `w:t` conversion**: After unwrapping `w:del`, child `w:delText` elements must be renamed to `w:t`, otherwise `getParagraphText()` won't see the restored text.
2. **Cross-paragraph bookmark preservation**: When removing inserted paragraphs, bookmark boundaries (`w:bookmarkStart`/`w:bookmarkEnd`) whose counterpart sits in a kept paragraph must be relocated to an adjacent kept paragraph. See prior art in `trackChangesAcceptorAst.ts:224`.
3. **Property change restoration**: For each `*PrChange` type, replace the parent property element with the original properties stored inside the change element. When the original props are empty/missing, remove the parent property element entirely.

### Session-scoped extraction caching

**Changed from original design (from peer review).** The extraction is cached per session keyed by `edit_revision`, following the same pattern as `download` caching in `SessionManager`. Pagination reads from the cached array. Cache is invalidated on `markEdited()`. This avoids recomputing the full extraction on every paginated call.

### Comment association via existing `getComments()` API

**Changed from original design (from peer review).** Instead of re-walking `w:commentRangeStart`/`w:commentRangeEnd`, join the existing `getComments()` output by `anchoredParagraphId` to match comments to paragraphs. Threaded replies are nested under their parent (not flattened). Date format is `string | null` (ISO 8601 or null if absent).

### Pagination: 0-based offset with validation bounds

Offset is 0-based (unlike `read_file` which uses 1-based). Limit must be 1–500 (matching Python validation). Invalid values return `INVALID_LIMIT` or `INVALID_OFFSET` errors. Results are in document order for deterministic pagination.

### Missing `jr_para_*` policy

Paragraphs with tracked changes but no `jr_para_*` bookmark receive a deterministic synthetic ID based on their document-order index (e.g. `_anon_para_0`, `_anon_para_1`). This ensures no changed paragraphs are silently dropped. The synthetic ID is clearly distinguishable from real IDs and is noted in the response.
