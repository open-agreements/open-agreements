# Change: Add Run-Level Formatting Visibility to read_file

## Why

When text spans multiple runs with different formatting (bold mid-sentence, underlined definitions), the AI needs to see formatting boundaries to plan edits accurately. Currently `read_file` TOON output shows paragraph text without run-level detail. The AI cannot know *when* to use `smart_edit`'s formatting tags (`<b>`, `<i>`, etc.) without seeing the formatting structure first.

## What Changes

- Add inline formatting tags to `read_file` TOON output showing run-level formatting boundaries
- Writable formatting tags: `<b>`, `<i>`, `<u>`, `<highlighting>` — accepted by `smart_edit` in `new_string`
- Read-only formatting tag: `<a href="...">text</a>` — rendered in `read_file` output for AI awareness, NOT accepted as `smart_edit` input
- `show_formatting` parameter defaults to `true` on `read_file`
- Deterministic base-style suppression reduces noise for uniformly-formatted paragraphs (only emit tags where a run deviates from the char-weighted modal baseline)
- Partial read-write symmetry in v1: writable tags match `smart_edit`'s `new_string` vocabulary, but `old_string` matches plain text only today (`matching.ts:123`). `smart_edit` already strips `<definition>` and `<highlighting>` from `old_string` (smart_edit.ts:532-533); extending stripping to `<b>`, `<i>`, `<u>` is a follow-on task

## Impact

- Affected specs: `mcp-server`, `docx-primitives`
- Affected code:
  - `packages/safe-docx-ts/src/tools/read_file.ts` (add `show_formatting` option, default true)
  - `packages/docx-primitives-ts/src/document_view.ts` (run-level tag rendering, baseline computation)
  - `packages/docx-primitives-ts/src/styles.ts` (existing `extractEffectiveRunFormatting` — wire into document view rendering)
  - `packages/safe-docx-ts/src/server.ts` (schema update)
  - (Follow-on) `packages/safe-docx-ts/src/tools/smart_edit.ts` (old_string `<b>`/`<i>`/`<u>` tag stripping)
