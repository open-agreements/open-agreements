# Design: Accept Tracked Changes

## Context

Legal workflows frequently require accepting all tracked changes in a redlined document to produce a clean baseline for the next round of negotiations. Per [Microsoft's Accept All Revisions guidance](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-accept-all-revisions-in-a-word-processing-document), this is a well-documented OOXML operation. The implementation walks the XML tree and programmatically resolves each revision type.

## Goals / Non-Goals

**Goals:**
- Accept all tracked changes in a document, producing a clean .docx with no revision markup
- Handle all OOXML revision types: insertions, deletions, formatting changes, property changes, moves
- Pure TypeScript implementation with no external dependencies
- Never mutate the original document

**Non-Goals:**
- Selective acceptance (accept by author, by date range, by section) — future work
- Reject changes (similar but inverse logic) — future work
- Accept changes in headers/footers/footnotes/endnotes in v1 — document body only initially

## Decisions

### 1. Reuse Existing Engine from docx-comparison

**Decision:** Extract the core acceptance logic from the existing `acceptAllChanges` in `docx-comparison/trackChangesAcceptorAst.ts` into `docx-primitives-ts/src/accept_changes.ts`. The comparison package can then import from primitives instead of maintaining its own copy.

The existing implementation already handles all revision types (`w:ins`, `w:del`, `w:moveFrom`, `w:moveTo`, `*Change` elements) with bottom-up processing. Key additions for the extracted version:
- Stats reporting (insertions accepted, deletions accepted, moves resolved, property changes resolved)
- `w:rsid*` attribute cleanup on affected elements
- Session integration (replace working copy, invalidate view cache)

**Rationale:** The `docx-comparison` package already has a working, tested `acceptAllChanges` implementation. Writing from scratch would duplicate effort and risk divergent behavior. Extraction into primitives makes the logic reusable across both packages.

### 2. Pure OOXML Manipulation

**Decision:** Walk the OOXML tree in TypeScript and programmatically accept each revision type. No LibreOffice or external dependency.

**Rationale:** Keeps the package lightweight and avoids the LibreOffice process management complexity. The OOXML operations are well-documented and deterministic.

### 3. Revision Type Handling

**Decision:** Handle each revision type as follows:

| Revision Element | Action |
|-----------------|--------|
| `w:ins` | Unwrap: promote child content to parent, remove wrapper |
| `w:del` | Remove: delete element and all children |
| `w:rPrChange` | Remove change record: keep current `w:rPr`, delete `w:rPrChange` child |
| `w:pPrChange` | Remove change record: keep current `w:pPr`, delete `w:pPrChange` child |
| `w:sectPrChange` | Remove change record: keep current `w:sectPr`, delete change child |
| `w:tblPrChange` | Remove change record: keep current table properties |
| `w:trPrChange` | Remove change record: keep current row properties |
| `w:tcPrChange` | Remove change record: keep current cell properties |
| `w:moveFrom` | Remove: delete element and all children (source of move) |
| `w:moveTo` | Unwrap: promote child content to parent, remove wrapper (destination of move) |

**Rationale:** Follows the [OOXML spec](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-accept-all-revisions-in-a-word-processing-document) and Microsoft Word's own accept-all behavior.

### 4. Move Handling

**Decision:** Process moves by keeping `w:moveTo` content at destination and removing `w:moveFrom` content at source. Both wrapper elements are removed.

**Rationale:** `w:moveFrom` and `w:moveTo` are paired via `w:id` attributes. Accepting a move means the content lives at the destination. This matches Word's behavior.

**Edge case:** If `w:moveTo` exists without a corresponding `w:moveFrom` (corrupted document), treat `w:moveTo` as `w:ins` (unwrap). If `w:moveFrom` exists without `w:moveTo`, treat as `w:del` (remove).

### 5. Processing Order

**Decision:** Process in a single bottom-up pass over the document body. Process child elements before parent elements to avoid iterator invalidation.

**Rationale:** Bottom-up ensures that nested revisions (e.g., a `w:del` inside a `w:ins`) are resolved before their parent wrappers. This prevents orphaned elements.

### 6. Attribute Cleanup

**Decision:** After acceptance, clean up revision-related attributes: `w:rsidR`, `w:rsidRPr`, `w:rsidDel` on affected elements. Do not strip `w:rsid*` attributes globally (they serve other purposes like document comparison).

**Rationale:** Removing revision attributes from accepted elements produces cleaner output while preserving document-level metadata.

### 7. Output Handling

**Decision:** Output is written to a new file path (never mutates the original). When used within a session, the accepted document replaces the working copy and the session view is invalidated for refresh.

**Rationale:** Non-destructive by default. Session integration allows the AI to accept changes and then continue editing.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Nested revisions (move inside insertion) | Bottom-up processing resolves inner revisions first |
| Orphaned `w:moveFrom` without `w:moveTo` | Treat as `w:del` (safe fallback) |
| Comments anchored to deleted ranges | Remove comment range markers that fall entirely within `w:del` ranges |
| Custom XML or structured document tags with revisions | Pass through unmodified in v1; document as known limitation |

## Open Questions

None — the OOXML accept-all operation is well-documented and deterministic.
