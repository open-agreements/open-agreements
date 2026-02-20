# Design: Safe-Docx Layout Format Controls

## Context

We need deterministic layout controls inside the TypeScript Safe-Docx stack so `.docx` spacing can be managed programmatically in template build/edit workflows, without requiring Aspose at runtime.

Current Safe-Docx capabilities focus on text/runs/paragraph identity and formatting parity for edits. Layout geometry APIs are not first-class.

## Goals

- Add deterministic, low-level OOXML layout mutation APIs for paragraph spacing and table geometry.
- Expose those APIs via a Safe-Docx MCP tool suitable for local automation workflows.
- Preserve document integrity and paragraph/bookmark stability.
- Keep distributable runtime dependency footprint unchanged (Node/TS only).

## Non-Goals

- Automatic document-wide aesthetic optimization.
- LLM-driven style inference in this change.
- Introducing Aspose/Python in Safe-Docx runtime.

## Decisions

### 1) Add a dedicated layout mutation module in `docx-primitives-ts`

Add a focused module (for example, `layout.ts`) with pure functions that mutate parsed OOXML DOM elements.

Planned API shape (illustrative):
- `setParagraphSpacing(doc, { paragraphIds, beforeTwips?, afterTwips?, lineTwips?, lineRule? })`
- `setTableRowHeight(doc, { tableIndexes, rowIndexes?, valueTwips, rule })`
- `setTableCellPadding(doc, { tableIndexes, rowIndexes?, cellIndexes?, topDxa?, bottomDxa?, leftDxa?, rightDxa? })`

All mutations are deterministic and selector-scoped.

### 2) Expose an MCP tool `format_layout` in `safe-docx-ts`

Add tool with file-first/session-first semantics identical to other editing tools.

Request model includes:
- target scope selectors (paragraph IDs and/or table selectors)
- operation payloads (`paragraph_spacing`, `row_height`, `cell_padding`)
- optional strict validation mode

Response includes:
- `resolved_session_id`, `resolved_file_path`
- affected counts by mutation type
- warnings for no-op selectors

### 3) No spacer-paragraph strategy

Layout APIs only set OOXML geometry fields (`w:spacing`, `w:trHeight`, `w:tcMar`).
They SHALL NOT insert empty paragraphs/runs to emulate whitespace.

### 4) Validation and guardrails

- Validate numeric ranges and enum values (`lineRule`, row height rule).
- Reject malformed selectors with structured tool errors.
- Maintain existing bookmarks and paragraph IDs.
- Operations are idempotent for identical inputs.

## Data Model Notes

- Paragraph spacing: stored in `w:pPr/w:spacing` with twips-based numeric attributes.
- Row height: stored in `w:trPr/w:trHeight` with `w:val` and `w:hRule`.
- Cell padding: stored in `w:tcPr/w:tcMar` with side elements and width attrs.

The implementation will use existing OOXML namespace helpers and DOM mutation patterns already used by `docx-primitives-ts`.

## Risks and Mitigations

- Risk: Incorrect OOXML attribute units lead to unexpected rendering.
  - Mitigation: explicit unit docs + fixture-based tests opened in Word-compatible validators.
- Risk: Mutating shared nodes accidentally strips unrelated formatting.
  - Mitigation: append/replace only target child elements, preserve siblings.
- Risk: Tool complexity due to broad selector combinations.
  - Mitigation: start with explicit selectors and strict validation; add convenience selectors later.

## Migration / Rollout

- Backward-compatible addition: new APIs and new MCP tool only.
- No changes required for existing callers unless they opt into `format_layout`.
- Document examples for template build-time workflows.

## Open Questions

- Should v1 include style-based selectors (e.g., by `style` ID) or only explicit paragraph/table indexes?
- Should `format_layout` support batched multi-operation requests atomically or as sequential best-effort?
