# Change: Add Python-Grade Formatting Parity to Safe-Docx TypeScript

## Why

Safe-Docx TypeScript (`@usejunior/safe-docx` + `@usejunior/docx-primitives`) is the distributable MCP server we expect end users to install via `npx`. Today it can safely round-trip OOXML (DOM-based), but it does **not** match the Python editing pipeline's formatting fidelity:

- `smart_edit` can flatten **mixed-run formatting** across a replaced span (multi-run edits collapse to one run style).
- `read_file` output lacks the Python `DocumentView` signal: list labels, run-in headers, and style fingerprints needed for high-fidelity edits.
- No semantic tag pipeline (`<definition>…</definition>`, header semantics) or **role model** formatting (defined term bolding, run-in header preservation).
- No hook pipeline (normalization + validation) comparable to Python’s editing hooks and invariant checks.

Legal users notice these gaps immediately: edits look “off”, styles drift, and alignment/formatting regressions reduce trust even when the document opens.

## What Changes

- **NEW (TS): DocumentView + TOON rendering**
  - Add a TS `DocumentView` IR mirroring Python: nodes with `id`, `list_label`, `header`, `style`, `text` (plus machine-readable metadata).
  - Upgrade `read_file` to support the full TOON schema: `#SCHEMA id | list_label | header | style | text`, including:
    - programmatic header detection (run-in headers)
    - list label extraction
    - style fingerprint-derived `style` IDs (e.g., `body_1`, `section`, etc.)
  - Add a JSON output mode for parity testing and downstream tooling.

- **NEW (TS): Style fingerprinting + registry**
  - Compute a stable style fingerprint per paragraph (normalized `w:pPr` + effective run formatting summary + numbering/list context).
  - Maintain a per-document `StyleRegistry` that maps fingerprints to stable style IDs and supports “available styles” discovery.

- **NEW (TS): Hook library (normalization + invariants)**
  - Add a deterministic hook pipeline for tool execution (pre/post):
    - TOON escaping/unescaping where relevant
    - whitespace normalization options for matching (without altering output)
    - tag validation (balanced tags, no malformed markup)
    - invariant checks: no orphaned nodes, no empty paragraphs created on rejects, stable bookmark semantics, etc.

- **NEW (TS): Semantic tags + role model formatting**
  - Support semantic tags in replacement strings:
    - `<definition>…</definition>` for defined term styling
    - header semantics (column-first; still accept tag input for backward compatibility)
  - Implement role model lookup (nearest matching definition/header above) to render semantic tags into concrete run formatting.

- **UPGRADED (TS): Formatting surgeon for `smart_edit` / `smart_insert`**
  - Replace the current “clone start run” strategy with formatting-aware range replacement:
    - preserves uniform formatting spans without flattening
    - preserves mixed-run formatting across the replaced span (deterministic mapping)
    - is field-aware (tabs/breaks/field codes) and does not drop non-text nodes
  - Add multi-paragraph insert semantics that match Python ingestion semantics (paragraph breaks, run-in headers, definitions).

## Impact

- Affected specs:
  - `mcp-server` (Safe-Docx TS MCP tool behavior and output)
- Affected code:
  - `packages/safe-docx-ts/` (tool surface + session-level DocumentView)
  - `packages/docx-primitives-ts/` (DocumentView ingestion + style registry + surgeon primitives)

## Success Criteria

1. **Mixed-run formatting preserved**
   - Replacing text spanning multiple runs does not collapse to a single formatting template.
2. **TOON parity**
   - `read_file` can render `#SCHEMA id | list_label | header | style | text` with stable style IDs derived from fingerprints.
3. **Role model formatting parity**
   - Inserted/edited definitions render defined terms using a discovered role model (bold/quotes/etc.) without style drift.
   - Run-in headers appear in the `header` column (not duplicated in text), and edits preserve header formatting.
4. **Hook + invariants**
   - Edits do not introduce empty paragraph stubs, orphaned nodes, or invalid OOXML; documents open cleanly in Word.
5. **Parity tests**
   - A golden test corpus comparing Python vs TS outputs passes for a representative legal document set (NDAs, equity plans, agreements).

## Non-Goals (For This Change)

- Adding new public tools beyond the existing Safe-Docx surface (unless required for parity testing).
- Track-changes generation and comparison output (handled by `docx-comparison`).
- Any Aspose/.NET dependency in the distributable TS packages.
