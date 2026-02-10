## MODIFIED Requirements

### Requirement: DOCX Cleaner
The cleaner stage MUST remove footnotes and pattern-matched paragraphs from
a DOCX file based on a declarative `clean.json` configuration. Cleaning
operates at the OOXML level to preserve formatting of retained content.
`cleanDocument()` MUST return `{ outputPath: string; guidance?: GuidanceOutput }`.
When `extractGuidance` is true, the cleaner MUST capture the text content
of all removed elements before deletion and include them in the returned
`guidance` field.

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
- **AND** `extractGuidance` is true
- **THEN** the text content of each removed footnote is captured before deletion
- **AND** each entry has `source: "footnote"` and `part: "word/footnotes.xml"`
- **AND** entries are ordered by `footnoteReference` occurrence in `word/document.xml`

#### Scenario: Extract pattern-matched guidance
- **WHEN** `clean.json` has `removeParagraphPatterns` with matching paragraphs
- **AND** `extractGuidance` is true
- **THEN** the text of each removed paragraph is captured before deletion
- **AND** each entry has `source: "pattern"` and `part` set to the OOXML part name

#### Scenario: Extract range-deleted guidance
- **WHEN** `clean.json` has `removeRanges` with matching start/end patterns
- **AND** `extractGuidance` is true
- **THEN** each paragraph in a matched range is captured as a separate entry
- **AND** all entries from the same range match share a `groupId`
- **AND** each entry has `source: "range"` and `part` set to the OOXML part name

#### Scenario: No extraction by default
- **WHEN** `extractGuidance` is not set or is false
- **THEN** `cleanDocument()` returns `guidance: undefined`
- **AND** cleaning behavior is identical to the pre-extraction implementation

### Requirement: Recipe CLI Subcommands
The CLI MUST provide subcommands for running the full recipe pipeline and
for running individual stages independently. Individual stages support
recipe authoring and debugging.

#### Scenario: Run full pipeline
- **WHEN** `open-agreements recipe run <recipe-id> --data <json> -o <output>`
- **THEN** the full download-clean-patch-fill-verify pipeline executes

#### Scenario: Run clean stage only
- **WHEN** `open-agreements recipe clean <input> -o <output> --recipe <id>`
- **THEN** only the clean stage runs, using the recipe's `clean.json` config

#### Scenario: Run patch stage only
- **WHEN** `open-agreements recipe patch <input> -o <output> --recipe <id>`
- **THEN** only the patch stage runs, using the recipe's `replacements.json`

#### Scenario: Extract guidance during clean
- **WHEN** `open-agreements recipe clean <input> -o <output> --recipe <id> --extract-guidance /tmp/guidance.json`
- **THEN** the clean step runs with extraction enabled
- **AND** writes the guidance JSON to the specified path
- **AND** the cleaned DOCX is written to the output path as normal

## ADDED Requirements

### Requirement: Guidance Output Schema
The guidance output MUST conform to a Zod-validated schema. Each entry
records the removal source type, the OOXML part it was extracted from, a
global extraction-order index, and the text content. Range-deleted entries
share a `groupId`. The output records both the source document hash and
the clean config hash for staleness detection.

#### Scenario: Valid guidance output
- **WHEN** guidance extraction produces output
- **THEN** it MUST contain `extractedFrom: { sourceHash: string, configHash: string }`
- **AND** it MUST contain `entries` as an array
- **AND** each entry MUST have `source` (one of `"footnote"`, `"pattern"`, `"range"`), `part` (string), `index` (number), and `text` (string)
- **AND** range entries MUST have `groupId` (string)

#### Scenario: Staleness detection
- **WHEN** the source document changes (new version or different hash)
- **OR** the `clean.json` configuration changes
- **THEN** the `extractedFrom` hashes will differ from a previously generated guidance file
- **AND** re-running extraction will regenerate the file from the current source and config
