# Change: Add Accept Tracked Changes Tool

## Why

There is no way to take a heavily redlined document from opposing counsel and produce a clean .docx with all changes accepted. This is a common legal workflow — accept the other side's redlines, then start your own round of edits. Existing tools do not cover this:
- `simplify_redlines` consolidates adjacent changes but does not accept them
- `download` with `clean` variant applies safe-docx's own edits but does not accept **pre-existing** tracked changes

## What Changes

- New MCP tool `accept_changes` that accepts all tracked changes in the document body
- v1 scope: document body only; headers, footers, footnotes, and endnotes deferred
- Pure TypeScript/OOXML implementation — no LibreOffice dependency
- Extracts and refactors the core acceptance logic from the existing `acceptAllChanges` in `docx-comparison/trackChangesAcceptorAst.ts` into `docx-primitives-ts`, adding stats reporting and rsid cleanup
- Programmatic acceptance of all revision types:
  - `w:ins` — unwrap (keep content, remove tracked-change wrapper)
  - `w:del` — remove entirely (including content)
  - `w:rPrChange` / `w:pPrChange` / `w:sectPrChange` / `w:tblPrChange` / `w:trPrChange` / `w:tcPrChange` — remove change element, keep current formatting
  - `w:moveFrom` / `w:moveTo` — unwrap destination content, remove source
- Clean up revision-related attributes after acceptance (`w:rsidR`, `w:rsidRPr`, `w:rsidDel`)
- Output written to a new file path (never mutates the original), or applied to working copy in session

## Impact

- Affected specs: `mcp-server`, `docx-primitives`
- Affected code:
  - `packages/docx-primitives-ts/src/accept_changes.ts` (new — core OOXML revision acceptance logic)
  - `packages/safe-docx-ts/src/tools/accept_changes.ts` (new — MCP tool wrapper)
  - `packages/safe-docx-ts/src/server.ts` (register new tool)
