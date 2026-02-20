# Design: Safe-Docx TS Formatting Parity (DocumentView + Style Registry + Surgeon)

## Overview

This change ports the Python editing pipeline’s highest-leverage formatting-preservation primitives into the Safe-Docx TypeScript stack:

- `DocumentView` IR for LLM-visible structure (list labels, headers, style IDs)
- style fingerprinting + a per-document `StyleRegistry`
- semantic tag rendering via role models (`<definition>`, header semantics)
- a deterministic formatting surgeon for `smart_edit` / `smart_insert`
- a hook pipeline for normalization + invariant checks

The implementation remains **deterministic** (no internal LLM calls) and retains Safe-Docx’s security posture: DOM-based OOXML edits with conservative refusal on unsafe operations.

## Architecture

### A. Session State

Each Safe-Docx session keeps:

- `doc`: the mutable OOXML DOM (document.xml + supporting parts)
- `view`: a cached `DocumentView` derived from the DOM
- `styleRegistry`: fingerprint → stable style ID mapping (e.g., `body_1`, `section`)
- `index`: mapping from `jr_para_*` → paragraph element + supporting metadata

Edits invalidate only the affected nodes and their local neighborhood (for role models).

### B. DocumentView IR (TS)

TS `DocumentView` mirrors Python’s TOONRenderer expectations:

Node fields (minimum):
- `id`: `jr_para_*`
- `list_label`: derived from numbering/list context
- `header`: run-in header string (normalized; stripped from text column)
- `style`: stable style ID derived from fingerprint mapping
- `text`: LLM-visible text (may include `<definition>` tags; no run-in header tags)

Node metadata (JSON mode):
- `style_fingerprint`: stable hashable fingerprint
- `header_formatting`: `{ bold, italic, underline }` or similar
- `paragraph_style_id`: `w:pStyle/@w:val` if present
- `numbering`: `{ numId, ilvl }` if present
- `run_summary`: counts + key run styles for surgeon decisions

### C. Style Fingerprinting + StyleRegistry

We define a **normalized** fingerprint for each paragraph:

Inputs:
- `w:pPr` normalized (alignment, spacing, indentation, pStyle, numPr, etc.)
- “effective” header/run formatting summary (first N runs at start, bold/underline signals)
- list context (level, label kind) for stable style naming

Normalization rules (determinism):
- ignore volatile attributes (revision IDs/dates, rsid*, bookmark ids)
- canonicalize attribute ordering and whitespace
- canonicalize default namespace prefixes (match OOXML.W_NS)

Registry:
- `fingerprint -> style_id` mapping computed per-document, stable within session
- style_id naming strategy:
  - if list paragraph: `article|section|subsection` based on level + label type
  - else: `body_1`, `body_2`, … in first-seen order

We also expose an “available styles” inventory for downstream tooling/testing.

### D. Header Detection (Column-First)

Header detection is **formatting-first**:

- detect “run-in header” when the paragraph starts with a short bold/underline span followed by punctuation (`:`, `.`, `-`) and then normal body text
- fall back to pattern-based detection when formatting signal is absent but strong (ALL CAPS word + punctuation)

When a header is detected:
- populate `header` column
- store `header_formatting` metadata for edit rendering
- strip the header text from `text` column to avoid duplication

### E. Semantic Tags + Role Models

Supported semantic tags (input):
- `<definition>Term</definition>`: indicates “Term” is an explicit defined term and should match nearby definition styling.
- Header semantics:
  - canonical: `header` column in TOON
  - backward-compatible: accept `<RunInHeader>…</RunInHeader>` or `<header>…</header>` in edits, render into header column.

Auto-tagging (input convenience, Python parity):
- The system detects explicit definition patterns in inserted/replacement text (e.g., `"Term" means …`, `"Term" shall mean …`, `"Term" has the meaning …`)
- When detected, it auto-wraps the term in `<definition>` semantics internally so the role model renderer can apply consistent styling even when the caller did not include tags.

Role model lookup:
- Find nearest paragraph above the insertion/edit location that is a definition/header with a matching pattern.
- Extract its formatting style (bold/quotes/underline).
- Render semantic tags into concrete formatting tags or direct OOXML run formatting.

### F. Formatting Surgeon (Deterministic)

Goal: preserve formatting when replacing text spans, especially across run boundaries.

Key cases:
1. **Uniform formatting span**
   - Replacement text is inserted using a run template derived from the span’s effective formatting.
2. **Mixed-run formatting span**
   - Replacement is distributed across the existing run structure (or cloned per-run), preserving each run’s `w:rPr`.
   - The algorithm MUST NOT flatten the whole replacement to the start run’s style.
3. **Run-container boundaries**
   - Runs may be nested under `w:hyperlink`, content controls, etc.
   - The surgeon operates on a linearized “text atom” stream with backpointers to the owning run and container.
   - If a replacement crosses container boundaries that cannot be safely edited, the tool refuses with a structured error.
4. **Field-aware visible text**
   - Visible text includes tabs/breaks where appropriate, and must not destroy `w:fldChar` sequences.

The surgeon owns run creation. We avoid post-hoc merging unless it is provably safe and local (same parent, identical rPr, no revision/field nodes).

### G. Hook Pipeline

Tool execution (edit tools) follows:

1. Pre-hooks
   - validate inputs (balanced tags, non-zero offset rules, etc.)
   - normalize old/new strings for matching (configurable whitespace matching)
   - TOON unescape if required
2. Core operation
   - locate target paragraph via bookmark id
   - compute visible-text mapping
   - apply surgeon edit / insertion
3. Post-hooks
   - remove empty runs created by splitting
   - enforce invariants (no orphan nodes, no duplicated bookmarks, no header duplication)
   - mark view/index caches dirty

## Compatibility Strategy

- Maintain legacy output by supporting `read_file(format="simple")` for clients that still expect `#TOON id | text`.
- Default output moves to `#SCHEMA id | list_label | header | style | text`.
- Preserve existing tool names and required params; new params are optional and backward compatible.

## Test Strategy

1. Unit tests (Vitest) for:
   - fingerprint normalization stability
   - header detection
   - definition detection + role model rendering
   - mixed-run surgeon replacement across typical Word run splits

2. Golden tests:
   - Compare TS DocumentView JSON to Python DocumentView JSON (normalized) for the same fixture docs.
   - Compare final edited `.docx` structure after deterministic normalization (strip volatile attrs).

3. End-to-end:
   - “NDA terms rewrite” fixture: verify no formatting drift vs Python outputs on key paragraphs.
