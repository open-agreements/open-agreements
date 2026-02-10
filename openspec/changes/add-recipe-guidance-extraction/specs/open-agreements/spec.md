## MODIFIED Requirements

### Requirement: DOCX Cleaner
The cleaner stage MUST remove footnotes and pattern-matched paragraphs from
a DOCX file based on a declarative `clean.json` configuration. Cleaning
operates at the OOXML level to preserve formatting of retained content.
When guidance extraction is requested, the cleaner MUST capture the text
content of all removed elements before deletion and return it as structured
data.

#### Scenario: Remove footnotes
- **WHEN** `clean.json` has `removeFootnotes: true`
- **THEN** all `<w:footnoteReference>` runs are removed from `word/document.xml`
- **AND** all normal footnotes are removed from `word/footnotes.xml`
- **AND** separator and continuationSeparator footnotes are preserved

#### Scenario: Remove paragraph patterns
- **WHEN** `clean.json` has `removeParagraphPatterns: ["^Note to Drafter:"]`
- **THEN** paragraphs whose text matches the regex are removed from the document

#### Scenario: Extract footnote guidance
- **WHEN** `clean.json` has `removeFootnotes: true`
- **AND** guidance extraction is enabled
- **THEN** the text content of each removed footnote is captured before deletion
- **AND** each entry has `source: "footnote"` and an `index` reflecting document order

#### Scenario: Extract pattern-matched guidance
- **WHEN** `clean.json` has `removeParagraphPatterns` with matching paragraphs
- **AND** guidance extraction is enabled
- **THEN** the text of each removed paragraph is captured before deletion
- **AND** each entry has `source: "pattern"` and an `index` reflecting document order

#### Scenario: Extract range-deleted guidance
- **WHEN** `clean.json` has `removeRanges` with matching start/end patterns
- **AND** guidance extraction is enabled
- **THEN** the text of all paragraphs in each matched range is captured before deletion
- **AND** paragraphs within a single range are joined with newlines into one entry
- **AND** each entry has `source: "range"` and an `index` reflecting document order

#### Scenario: No extraction by default
- **WHEN** guidance extraction is not enabled
- **THEN** `cleanDocument()` behaves identically to the current implementation
- **AND** no guidance data is returned or written

## ADDED Requirements

### Requirement: Guidance Output Schema
The guidance output MUST conform to a Zod-validated schema containing an
array of extraction entries, each with a source type, document-order index,
and text content. The output MUST also record a source identifier (document
hash or version) for staleness detection.

#### Scenario: Valid guidance.json
- **WHEN** a `guidance.json` file exists in a recipe directory
- **THEN** it MUST validate against `GuidanceOutputSchema`
- **AND** it MUST contain `extractedFrom` (string) and `entries` (array)
- **AND** each entry MUST have `source` (one of `"footnote"`, `"comment"`, `"pattern"`, `"range"`), `index` (number), and `text` (string)

#### Scenario: Staleness detection
- **WHEN** the source document changes (new version or different hash)
- **AND** `guidance.json` was extracted from a previous version
- **THEN** the `extractedFrom` field will differ from the current source hash
- **AND** re-running extraction will regenerate the file from the new source

### Requirement: Recipe Clean Guidance Flag
The `recipe clean` subcommand MUST accept an `--extract-guidance` flag that
enables guidance extraction and writes `guidance.json` to the recipe
directory.

#### Scenario: Extract guidance during clean
- **WHEN** `open-agreements recipe clean <input> -o <output> --recipe <id> --extract-guidance`
- **THEN** the clean step extracts removed content as guidance
- **AND** writes `guidance.json` to the recipe directory
- **AND** the cleaned DOCX is written to the output path as normal

#### Scenario: Clean without extraction
- **WHEN** `recipe clean` is run without `--extract-guidance`
- **THEN** no `guidance.json` is written
- **AND** the clean step behaves identically to the current implementation
