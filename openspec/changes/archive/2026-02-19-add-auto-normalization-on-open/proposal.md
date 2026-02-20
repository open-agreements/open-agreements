# Change: Add Automatic Document Normalization on Open

## Why

Legal documents from Microsoft Word are almost always fragmented due to revision tracking, spell-check markers, and rsid attributes. Fragmented runs degrade grep accuracy, smart_edit matching, and read_file context efficiency. The Claude DOCX skill runs `merge_runs()` and `simplify_redlines()` automatically during document unpack — before any editing — to ensure consistent, clean OOXML for downstream operations.

## What Changes

- Normalization (`merge_runs` + `simplify_redlines`) runs automatically on every document open by default
- No mode gating — on by default, overridable by the LLM via `skip_normalization=true` parameter
- `merge_runs` and `simplify_redlines` run as implicit preprocessing on every document open; this proposal does not prescribe whether they are also available as explicit tools
- `validate_document` runs implicitly during download/pack; this proposal does not prescribe whether it is also available as an explicit tool
- Track normalization stats in session metadata (runs merged, redlines simplified)
- Pipeline ordering: `load → normalize → allocate missing jr_para bookmarks → cache view`
- Run-merge safety barriers: never merge across field boundaries (`fldChar`/`instrText`), comment range boundaries, bookmark boundaries, or tracked-change wrapper boundaries (`w:ins`/`w:del`/`w:moveFrom`/`w:moveTo`)
- Benchmark on existing .docx fixtures in the repo

## Impact

- Affected specs: `mcp-server`, `docx-primitives`
- Affected code:
  - `packages/safe-docx-ts/src/tools/open_document.ts` (pipeline reorder + normalization step)
  - `packages/safe-docx-ts/src/tools/session_resolution.ts` (auto-session creation with normalization)
  - `packages/docx-primitives-ts/src/` (merge_runs + simplify_redlines primitives with safety barriers)
  - `packages/safe-docx-ts/src/server.ts` (pass `skip_normalization` option)
