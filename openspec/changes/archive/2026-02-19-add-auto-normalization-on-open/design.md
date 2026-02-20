# Design: Automatic Document Normalization on Open

## Context

Word documents accumulate XML fragmentation through normal use: spell-check inserts `proofErr` elements that split runs, revision tracking adds `rsid` attributes that prevent run merging, and tracked changes create adjacent wrappers that could be consolidated. This fragmentation degrades the accuracy of text matching in `smart_edit`/`grep` and inflates `read_file` context with redundant structure.

The Claude DOCX skill addresses this by normalizing documents during `unpack()` — before any editing begins. This proposal brings the same automatic normalization to safe-docx.

## Goals / Non-Goals

**Goals:**
- Normalize documents automatically on open (merge fragmented runs, simplify adjacent redlines)
- Ensure normalization runs BEFORE bookmark allocation to maintain view cache consistency
- Provide safety barriers to prevent unsafe merges across structural boundaries
- Track normalization stats in session metadata
- Allow opt-out via `skip_normalization=true`

**Non-Goals:**
- Normalizing headers, footers, footnotes, endnotes in v1 — body only initially
- Changing document semantics (normalization is presentation-preserving)

## Decisions

### 1. Pipeline Ordering

**Decision:** `load → normalize → allocate missing jr_para bookmarks → cache view`

Normalization runs BEFORE bookmark allocation for three reasons:

1. **View cache consistency:** Normalization changes XML content that the document view is built from. Running it after view caching would leave a stale cache requiring invalidation and rebuild.
2. **Paragraph count stability:** Bookmark allocation counts paragraphs to mint `jr_para_*` identifiers. If normalization were to merge or split paragraphs (e.g., `simplify_redlines` merging adjacent `w:ins` wrappers that contain paragraph marks), the paragraph count could change, invalidating already-minted IDs.
3. **Logical ordering:** Clean first, annotate second. Normalization is a preparatory step that produces a canonical XML form; bookmark allocation and view caching operate on that canonical form.

**Rationale:** Running normalization after bookmark allocation would require re-allocation and view cache invalidation, adding complexity for no benefit.

### 2. Run-Merge Safety Barriers

**Decision:** Never merge runs across:
- `fldChar` / `instrText` boundaries (field boundaries)
- Comment range boundaries (`commentRangeStart` / `commentRangeEnd`)
- Bookmark boundaries (`bookmarkStart` / `bookmarkEnd`)
- Tracked-change wrapper boundaries (`w:ins` / `w:del` / `w:moveFrom` / `w:moveTo`)

Per the [OOXML Run class spec](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.run), runs may contain field chars, comments, and deleted text children. Merging across these boundaries would corrupt document structure.

**Rationale:** Safety-first approach. A missed merge opportunity is harmless; a merge across a field boundary corrupts the document.

### 3. Simplify Redlines: Same-Author Constraint

**Decision:** Only merge adjacent tracked-change wrappers (`w:ins` or `w:del`) when they share the same author. Do not merge across different change types or non-whitespace separators.

**Rationale:** Merging wrappers from different authors would lose attribution. Merging different change types (insert + delete) would change semantics.

### 4. Normalization Modifies Working Copy Only

**Decision:** Normalization modifies the in-memory working copy only. The original file on disk is never touched. Normalization is invisible to the end user — it only affects the OOXML that the AI sees and edits.

**Rationale:** Non-destructive. The original document is always recoverable.

### 5. Stats in Session Metadata

**Decision:** Normalization stats are stored in session metadata and returned via `get_session_status`:
- `runs_merged: number` — total runs consolidated
- `redlines_simplified: number` — total tracked-change wrappers consolidated
- `normalization_skipped: boolean` — whether normalization was bypassed

**Rationale:** Observability for debugging and benchmarking. The AI can see whether normalization had material impact on a document.

### 6. Default On, Opt-Out via Parameter

**Decision:** Normalization is enabled by default. The `open_document` and file-first entry paths accept `skip_normalization=true` to bypass.

**Rationale:** The common case (fragmented legal documents) benefits from normalization. The rare case (intentionally fragmented documents, or performance-sensitive workflows on very large documents) can opt out.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Normalization takes too long on large documents | Benchmark on existing .docx fixtures; add timing to stats metadata |
| Removing `proofErr` elements changes spellcheck behavior | `proofErr` is non-semantic; Word regenerates on open |
| Stripping `rsid` attributes affects diff tools | Only strip on merged runs; document-level rsid attributes preserved |
| Safety barriers miss an edge case | Conservative approach: any unrecognized boundary element blocks merge |

## Open Questions

None — the normalization operations are well-understood from the Claude DOCX skill implementation.
