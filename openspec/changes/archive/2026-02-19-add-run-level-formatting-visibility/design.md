# Design: Run-Level Formatting Visibility

## Context

`read_file` currently emits TOON rows with plain text. The AI has no visibility into which substrings are bold, italic, underlined, etc. When it plans a `smart_edit`, it cannot preserve or intentionally change formatting because it never saw the boundaries. The Claude DOCX skill solves this by emitting inline formatting tags during `read_file`, using the same vocabulary that edits accept.

## Goals / Non-Goals

**Goals:**
- Show run-level formatting boundaries in TOON output using inline tags
- Use the same tag vocabulary as `smart_edit`'s `new_string` for partial read-write symmetry
- Suppress noise for uniformly-formatted paragraphs via base-style detection
- Default to `show_formatting=true` so the AI always sees formatting context

**Non-Goals:**
- Full read-write symmetry (stripping tags from `old_string` in `smart_edit`) — follow-on task
- Exposing font-size, font-family, or color beyond the core vocabulary
- Changing the TOON schema columns — formatting tags appear inline in the `text` column

## Decisions

### 1. Tag Vocabulary

**Decision:** Two tag categories:

**Writable tags** (accepted by `smart_edit` in `new_string`):
- `<b>text</b>` — bold
- `<i>text</i>` — italic
- `<u>text</u>` — underline
- `<highlighting>text</highlighting>` — highlighted text

**Read-only tags** (rendered in `read_file` output for AI awareness, NOT accepted in `smart_edit`):
- `<a href="url">text</a>` — hyperlinks

**Note:** `extractEffectiveRunFormatting` already exists in `styles.ts:202` and handles the full style chain resolution (paragraph style → run style → direct formatting), returning `{ bold, italic, underline, highlightVal, fontName, fontSizePt, colorHex }`. The implementation should wire this existing function into document view rendering and extend it for hyperlink detection.

**Rationale:** Writable tags have full read-write symmetry: the AI sees `<b>Acme</b>` in `read_file` and can emit the same in `smart_edit`. Read-only tags like `<a href>` provide awareness of hyperlinks without implying they can be created/modified via `smart_edit`.

### 2. Base-Style Suppression Algorithm

**Decision:** Compute a char-weighted modal `(bold, italic, underline)` tuple over non-header visible runs. Only emit tags where a run deviates from this baseline.

Algorithm:
1. For each visible, non-header run, compute its effective `(bold, italic, underline)` tuple
2. Weight each tuple by the run's character count
3. Select the tuple with the highest total character weight as baseline
4. Tie-break by earliest run if modal weights are equal
5. If baseline covers < 60% of visible characters, disable suppression and emit absolute tags for all runs

**Rationale:** Most legal document text is uniformly body-text (no bold/italic). Suppression avoids wrapping every paragraph in redundant tags. The 60% threshold ensures we still show absolute tags when formatting is highly varied.

### 3. TOON Column Unchanged

**Decision:** Formatting tags appear inline in the existing `text` column. No new columns added.

**Rationale:** Adding a `formatting` column would break existing integrations and bloat output. Inline tags are natural for LLM consumption and match the edit input format.

### 4. Default On

**Decision:** `show_formatting` defaults to `true`.

**Rationale:** The primary consumer is an AI agent that needs formatting context for accurate edits. Callers that want plain text can pass `show_formatting=false`.

### 5. Partial Read-Write Symmetry (v1)

**Decision:** Writable tags (`<b>`, `<i>`, `<u>`, `<highlighting>`) in `read_file` output match `smart_edit`'s `new_string` vocabulary. Read-only tags (`<a href>`) are emitted for awareness only. `old_string` matching continues to work on plain text only — tags in `old_string` are not stripped for matching in v1.

**Current state:** `smart_edit` already strips `<definition>` and `<highlighting>` tags from `old_string` (smart_edit.ts:532-533). The follow-on work is extending this stripping to the new `<b>`, `<i>`, `<u>` tags.

**Rationale:** The AI should use plain text for `old_string` and tagged text for `new_string`. Extending tag stripping to formatting tags is a separate concern with its own edge cases.

**Follow-on:** Extend `old_string` tag stripping in `smart_edit` to cover `<b>`, `<i>`, `<u>` so callers can copy-paste tagged output from `read_file` into `old_string` without manual tag removal.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Tags increase TOON output size | Base-style suppression minimizes tag density for typical documents |
| AI includes tags in `old_string` (v1 mismatch) | Document in tool description that `old_string` uses plain text |
| Nested formatting (`<b><i>text</i></b>`) | Emit tags in consistent order: `<b>` > `<i>` > `<u>` > `<highlighting>` |
| Header runs should not get base-style tags | Exclude header runs from baseline computation; emit absolute tags for header content |

## Open Questions

None — design is straightforward enough to proceed.
