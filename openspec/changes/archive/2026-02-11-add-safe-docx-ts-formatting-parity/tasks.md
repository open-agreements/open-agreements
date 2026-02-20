# Tasks: Safe-Docx TS Formatting Parity

## 1. DocumentView + TOON Output
- [x] 1.1 Implement TS `DocumentView` IR (nodes + metadata) in `packages/docx-primitives-ts/`
- [x] 1.2 Parse supporting parts for structure inference:
  - `word/styles.xml` (paragraph + run styles)
  - `word/numbering.xml` (list label derivation)
- [x] 1.3 Implement list label extraction (equivalent to Python list_label column)
- [x] 1.4 Implement header detection and `header_formatting` metadata (column-first; no duplication in text)
- [x] 1.5 Implement style fingerprinting + `StyleRegistry` mapping to stable style IDs
- [x] 1.6 Port TOON rendering to TS:
  - `#SCHEMA id | list_label | header | style | text`
  - optional compact IDs + id mapping
- [x] 1.7 Extend `read_file` tool:
  - default output: TOON schema above
  - `format="json"` output for parity tests
  - `format="simple"` backward-compat (`#TOON id | text`)

## 2. Hook Library (Normalization + Invariants)
- [x] 2.1 Add hook pipeline for tool execution in `packages/safe-docx-ts/`
- [x] 2.2 Pre-hooks:
  - validate balanced tags / invalid markup
  - enforce Python-compatible pagination rules (offset cannot be 0; negative offsets from end)
  - configurable whitespace matching normalization for `smart_edit`
- [x] 2.3 Post-hooks:
  - cleanup empty runs introduced by split operations
  - enforce header/text de-dup invariants
  - invalidate/rebuild `DocumentView` caches as needed

## 3. Semantic Tags + Role Model Formatting
- [x] 3.1 Implement semantic tag detection and parsing for `<definition>` and header semantics
- [x] 3.2 Implement explicit definition auto-tagging (regex-based) for common definition patterns (means / shall mean / has the meaning)
- [x] 3.3 Implement role model finders (definition + header) over `DocumentView`
- [x] 3.4 Render semantic tags into concrete run formatting using role model style
- [x] 3.5 Ensure semantic tags do not leak into the saved `.docx` output

## 4. Formatting Surgeon Parity for Editing
- [x] 4.1 Implement field-aware visible text extraction (tabs/breaks/fields) for mapping offsets to OOXML atoms
- [x] 4.2 Replace current `replaceParagraphTextRange()` implementation with formatting-aware replacement:
  - preserves uniform formatting spans without flattening
  - preserves mixed-run formatting across span (deterministic distribution)
  - refuses edits crossing unsafe container boundaries (hyperlinks/SDTs) with a structured error
- [x] 4.3 Update `smart_edit` to use the surgeon pipeline + semantic rendering
- [x] 4.4 Update `smart_insert` to support multi-paragraph inserts and semantic rendering

## 5. Parity & Regression Tests (Vitest + Golden)
- [x] 5.1 Create fixtures (NDAs, agreements) with known mixed-run formatting + run-in headers + definitions
- [x] 5.2 Add golden tests for:
  - DocumentView JSON parity (normalized) vs Python reference output
  - `smart_edit` mixed-run replacement does not flatten formatting
  - header column extraction is stable + edits preserve header formatting
  - definition role model bolding parity
- [x] 5.3 Add end-to-end tests that run Safe-Docx TS edits and assert:
  - output opens cleanly (OOXML well-formed)
  - no unexpected style drift on targeted paragraphs (fingerprint stability)

## 6. Documentation
- [x] 6.1 Update `packages/safe-docx-ts/README.md` to document:
  - TOON schema output
  - semantic tags supported
  - style fingerprinting + style IDs
  - JSON mode for parity tooling
- [x] 6.2 Add internal docs explaining:
  - fingerprint normalization rules
  - refusal modes and how to remediate (narrow old_string, avoid container-crossing edits)

## 7. OpenSpec Scenario Traceability (2026-02-11)
- [x] 7.1 Add Allure scenario tests for implemented parity behaviors:
  - TOON schema contract
  - JSON metadata mode
  - fingerprint stability for volatile XML attributes
  - stable style IDs within session
  - formatting-based run-in header extraction/de-dup
  - legacy `<definition>` role-model rendering
  - field-aware refusal path
  - pagination invariant (`offset=0`)
  - post-edit empty-run cleanup invariant
- [x] 7.2 Add traceability mapping in `packages/safe-docx-ts/test/SAFE_DOCX_OPENSPEC_TRACEABILITY.md`.
- [x] 7.3 Close pending parity gaps currently tracked as skipped Allure scenarios:
  - mixed-run formatting preservation
  - semantic smart_insert header/definition rendering
  - explicit-definition auto-tagging
  - backward-compatible header semantic tags
