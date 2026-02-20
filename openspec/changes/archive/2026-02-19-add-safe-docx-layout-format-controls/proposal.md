# Change: Add Safe-Docx Layout Format Controls (No Aspose Runtime)

## Why

Safe-Docx currently preserves and edits text formatting, but it does not expose deterministic controls for document layout spacing (paragraph spacing, line spacing, table row height, cell padding). For template build workflows, teams currently fall back to manual Word editing or external tooling.

We need native layout controls in `@usejunior/docx-primitives` and `@usejunior/safe-docx` so layout can be adjusted programmatically without introducing Aspose (or Python) as a runtime dependency.

## What Changes

- Add deterministic OOXML layout mutation primitives in `docx-primitives-ts`:
  - Paragraph spacing (`w:pPr/w:spacing`): `before`, `after`, `line`, `lineRule`
  - Table row height (`w:trPr/w:trHeight`): `value`, `rule`
  - Cell padding (`w:tcPr/w:tcMar`): `top`, `bottom`, `left`, `right`
- Add a Safe-Docx MCP tool (`format_layout`) that applies these primitives by selectors (paragraph IDs, table indexes, optional row/cell filters).
- Add an optional build-time script pattern for template-authoring flows that invokes Safe-Docx/Docx-primitives formatting controls locally.
- Explicitly enforce that layout changes are done via OOXML properties, not spacer paragraphs.
- Keep runtime dependency boundary unchanged: no Aspose/Python requirement for `npx @usejunior/safe-docx`.

## Impact

- Affected specs:
  - `mcp-server`
- Affected code:
  - `packages/docx-primitives-ts/src/` (new layout mutation module + exports)
  - `packages/safe-docx-ts/src/tools/` (new `format_layout` tool)
  - `packages/safe-docx-ts/src/server.ts` (tool registration)
  - `packages/safe-docx-ts/test/` and `packages/docx-primitives-ts/test/` (new coverage)

## Non-Goals

- No Aspose integration in Safe-Docx runtime package.
- No LLM-driven layout decisioning (deterministic input only).
- No automatic “style beautification” heuristics in v1 beyond requested numeric layout edits.
