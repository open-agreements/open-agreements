# recipes Specification

## Purpose
Defines the recipes capability after restructuring the legacy open-agreements monolith.

## Requirements
### Requirement: Recipe Pipeline
The recipe engine MUST support a multi-stage pipeline that transforms a
source DOCX into a filled agreement: download (or accept user-supplied input)
then clean then patch then fill then verify. Each stage MUST read from a file
path and write to a file path. Intermediate files MUST be written to a temp
directory and cleaned up after completion unless `--keep-intermediate` is set.

#### Scenario: [OA-RCP-001] Full pipeline with auto-download
- **WHEN** `recipe run nvca-voting-agreement --data values.json -o output.docx`
- **THEN** the engine downloads the source DOCX from `source_url` in metadata
- **AND** runs clean, patch, fill, verify stages in sequence
- **AND** writes the final filled DOCX to `output.docx`

#### Scenario: [OA-RCP-002] Full pipeline with user-supplied input
- **WHEN** `recipe run nvca-voting-agreement --input local.docx --data values.json -o output.docx`
- **THEN** the engine uses `local.docx` instead of downloading
- **AND** runs the same clean, patch, fill, verify pipeline

#### Scenario: [OA-RCP-003] Keep intermediate files
- **WHEN** `--keep-intermediate` is set
- **THEN** cleaned, patched, and filled intermediate files are preserved in temp dir
- **AND** the temp dir path is reported to the user

### Requirement: DOCX Cleaner
The cleaner stage MUST remove footnotes and pattern-matched paragraphs from
a DOCX file based on a declarative `clean.json` configuration. Cleaning
operates at the OOXML level to preserve formatting of retained content.

#### Scenario: [OA-ENG-005] Remove footnotes
- **WHEN** `clean.json` has `removeFootnotes: true`
- **THEN** all `<w:footnoteReference>` runs are removed from `word/document.xml`
- **AND** all normal footnotes are removed from `word/footnotes.xml`
- **AND** separator and continuationSeparator footnotes are preserved

#### Scenario: [OA-ENG-006] Remove paragraph patterns
- **WHEN** `clean.json` has `removeParagraphPatterns: ["^Note to Drafter:"]`
- **THEN** paragraphs whose text matches the regex are removed from the document

### Requirement: Cross-Run Patcher
The patcher stage MUST replace bracketed placeholders with template tags
across Word XML run boundaries. It MUST use a char_map algorithm that maps
each character in the concatenated paragraph text to its source run and offset.
Replacement keys MUST be sorted longest-first to prevent partial matches.

#### Scenario: [OA-RCP-007] Single-run replacement
- **WHEN** `[Company Name]` exists entirely within one `<w:r>` element
- **THEN** the text is replaced in-place within that run
- **AND** run formatting (bold, italic, etc.) is preserved

#### Scenario: [OA-RCP-008] Cross-run replacement
- **WHEN** `[Company Name]` spans two runs (`[Company` in run 1, ` Name]` in run 2)
- **THEN** the replacement text is placed in the first run
- **AND** consumed text is removed from subsequent runs
- **AND** formatting of the first run is preserved

#### Scenario: [OA-RCP-009] Smart quote handling
- **WHEN** the source DOCX uses smart/curly quotes (U+201C, U+201D, U+2019)
- **THEN** the replacement map includes both smart and straight quote variants
- **AND** both variants are matched and replaced correctly

#### Scenario: [OA-RCP-010] Table cell processing
- **WHEN** placeholders appear in table cells (e.g., signature blocks)
- **THEN** the patcher processes paragraphs within table cells

### Requirement: Post-Fill Verifier
After filling, the verifier MUST check the output DOCX to confirm that all
context values appear in the document text, no unrendered template tags remain,
and no leftover source placeholders remain.

#### Scenario: [OA-RCP-011] All values present
- **WHEN** fill values include `company_name: "Acme Corp"`
- **THEN** the verifier confirms "Acme Corp" appears in the output text

#### Scenario: [OA-RCP-012] Unrendered tags detected
- **WHEN** a `{template_tag}` remains in the output (unfilled)
- **THEN** the verifier reports it as a failure

#### Scenario: [OA-RCP-013] Leftover brackets detected
- **WHEN** a `[bracketed placeholder]` from the replacement map remains
- **THEN** the verifier reports it as a failure

### Requirement: Recipe Verifier Edge Cases
The verifier MUST normalize text (non-breaking spaces, smart quotes, whitespace)
and skip empty/whitespace-only values during output verification.

#### Scenario: [OA-RCP-040] Verifier text normalization
- **WHEN** output text contains non-breaking spaces, smart quotes, or excess whitespace
- **THEN** normalization converts them for matching purposes
- **AND** newlines are preserved and text is trimmed

#### Scenario: [OA-RCP-041] Verifier skips empty and whitespace-only values
- **WHEN** fill values include empty strings or whitespace-only strings
- **THEN** those values are skipped during verification (not flagged as missing)
- **AND** values present only in header text are found via auxiliary part scanning

### Requirement: Recipe Patcher Operations
The cross-run patcher MUST handle single-run, multi-run, and nested replacements,
preserve run formatting, process longest matches first, handle multiple occurrences,
detect infinite loops, clean empty intermediate runs, and preserve non-text children.

#### Scenario: [OA-RCP-030] Multi-run and nested patcher replacements
- **WHEN** placeholders span two or three runs, are nested in hyperlinks, or mix direct and nested runs
- **THEN** replacements are placed correctly in each case
- **AND** formatting (bold, italic, etc.) of the first run is preserved

#### Scenario: [OA-RCP-031] Patcher match ordering and occurrence handling
- **WHEN** the replacement map contains overlapping keys or the same placeholder appears multiple times
- **THEN** longest match is replaced first to prevent partial matches
- **AND** all occurrences are replaced
- **AND** infinite loop conditions (value contains key) throw an error

#### Scenario: [OA-RCP-032] Patcher run preservation
- **WHEN** runs are consumed during cross-run replacement
- **THEN** empty intermediate runs are removed
- **AND** runs containing non-text children (drawings, etc.) are preserved
- **AND** paragraphs without matches are left untouched

#### Scenario: [OA-RCP-033] Patcher header and auxiliary part processing
- **WHEN** placeholders appear in header XML parts
- **THEN** the patcher processes and replaces them correctly

#### Scenario: [OA-RCP-034] Run safety classification
- **WHEN** determining whether consumed runs can be removed
- **THEN** runs with only rPr and empty text are safe to remove
- **AND** runs with drawings, breaks, tabs, or footnoteReferences are not safe to remove

### Requirement: Recipe Patcher Extensions
The patcher extensions MUST support context-aware keys (table row scoping),
nth-occurrence keys, mixed key type ordering, part clearing, range removal,
and guidance extraction.

#### Scenario: [OA-RCP-035] Context key and nth-occurrence replacements
- **WHEN** replacement keys use context (" > ") syntax or nth-occurrence (#N) syntax
- **THEN** context keys scope replacement to matching table rows
- **AND** nth keys replace only the specified occurrence without infinite looping
- **AND** context keys are processed before simple keys

#### Scenario: [OA-RCP-036] Table row context detection
- **WHEN** a paragraph is inside a table cell
- **THEN** `getTableRowContext` returns the label text from the adjacent cell
- **AND** for paragraphs not in tables, returns null

#### Scenario: [OA-RCP-037] Document part clearing and range removal
- **WHEN** `cleanDocument` is called with clearParts or removeRanges configuration
- **THEN** specified parts have their content cleared
- **AND** paragraph ranges between start and end patterns are removed
- **AND** unmatched start patterns remove through end of document
- **AND** multiple and repeated range patterns are handled correctly

#### Scenario: [OA-RCP-038] Guidance extraction from clean operations
- **WHEN** `extractGuidance` is enabled during document cleaning
- **THEN** pattern-matched text, range-deleted text with groupId, and footnote text are collected
- **AND** extraction metadata includes sourceHash and configHash
- **AND** when extractGuidance is not set, guidance is undefined

### Requirement: Replacement Key Parsing
Replacement keys MUST be parsed into simple, context-aware (" > " separator),
and nth-occurrence (#N suffix) types.

#### Scenario: [OA-RCP-039] Replacement key type parsing
- **WHEN** replacement keys are parsed
- **THEN** simple keys return as-is with type "simple"
- **AND** keys with " > " separator return context and placeholder parts
- **AND** keys with #N suffix return the nth occurrence number
- **AND** #0 and trailing # are treated as simple keys
- **AND** `extractSearchText` strips context and #N suffixes correctly

### Requirement: OOXML Part Enumeration
The part enumerator MUST discover all text-bearing OOXML parts (document.xml,
headers, footers, endnotes, footnotes) and filter non-matching files.

#### Scenario: [OA-ENG-007] OOXML part discovery
- **WHEN** a DOCX zip contains various word/ entries
- **THEN** `enumerateTextParts` finds document.xml, headers, footers, endnotes, and footnotes
- **AND** ignores non-matching files
- **AND** `getGeneralTextPartNames` returns a flat list excluding footnotes

### Requirement: Bracket Artifact Normalization
The bracket normalizer MUST remove bracket artifacts and degenerate optional-clause
leftovers, apply declarative paragraph rules with heading aliases and field
interpolation, and track expectation failures.

#### Scenario: [OA-ENG-008] Bracket artifact cleanup and declarative rules
- **WHEN** bracket normalization runs on a patched document
- **THEN** bracket artifacts and degenerate optional-clause leftovers are removed
- **AND** declarative paragraph rules with heading aliases and field interpolation are applied
- **AND** expectation failures (missing rule anchor pairs) are tracked

### Requirement: Declarative Paragraph Pruning
The declarative pruning system MUST select options via declarative anchors,
warn on missing anchors, and fill/clean targeted clauses.

#### Scenario: [OA-ENG-009] Declarative option selection and warning
- **WHEN** declarative anchors specify which option to keep
- **THEN** only the selected option is preserved
- **AND** when a selected option anchor is not found, a warning is emitted
- **AND** targeted NVCA clauses are filled and cleaned via declarative rules

### Requirement: Source Drift Detection
The source drift canary MUST verify source document integrity by checking content
hash and structural anchors against recipe configuration.

#### Scenario: [OA-RCP-028] Source drift hash and anchor verification
- **WHEN** a recipe's source document hash and structural anchors match configuration
- **THEN** drift check passes
- **AND** when hash mismatches, drift check fails
- **AND** when replacement or normalize anchors are missing, structural anchor drift is reported

#### Scenario: [OA-RCP-029] Source drift structure signature
- **WHEN** drift diagnostics run on a source document
- **THEN** a basic structure signature is emitted for drift analysis
