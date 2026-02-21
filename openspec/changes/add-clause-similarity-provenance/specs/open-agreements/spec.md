## ADDED Requirements

### Requirement: Embedding Provider Interface
The system SHALL define a pluggable `EmbeddingProvider` interface that accepts
an array of text strings and returns an array of fixed-dimension numeric
vectors. A default implementation SHALL be provided. The provider SHALL be
configurable so that alternative embedding models can be swapped without
modifying core similarity logic.

#### Scenario: [OA-067] Default provider produces embeddings
- **WHEN** the default `EmbeddingProvider` is called with `["This agreement is entered into...", "Confidential Information means..."]`
- **THEN** it returns an array of two numeric vectors of equal dimension
- **AND** each vector has non-zero magnitude

#### Scenario: [OA-068] Custom provider can be substituted
- **WHEN** a custom `EmbeddingProvider` implementation is registered
- **THEN** the similarity pipeline uses the custom provider instead of the default
- **AND** the rest of the pipeline (scoring, index generation) works unchanged

### Requirement: Pre-Computed Similarity Index
The system SHALL provide a build-time pipeline that extracts clauses from
template DOCX files, embeds them via the configured `EmbeddingProvider`,
computes pairwise cosine similarity against a configurable source corpus,
and writes a `similarity-index.json` artifact per template. The index SHALL
NOT be computed at runtime. The index SHALL include the embedding model
identifier and generation timestamp for reproducibility.

#### Scenario: [OA-069] Build similarity index for a template
- **WHEN** `build-similarity-index` runs for template `common-paper-mutual-nda`
- **THEN** a `similarity-index.json` is written to `content/similarity/common-paper-mutual-nda/`
- **AND** the file contains a `clauses` array with one entry per extracted clause
- **AND** each entry includes `clause_id`, `heading`, `excerpt`, and `similarities` array

#### Scenario: [OA-070] Index includes model metadata
- **WHEN** the similarity index is generated
- **THEN** the index JSON includes `embedding_model`, `schema_version`, `template_id`, and `generated_at` fields

### Requirement: Source Corpus Configuration
The system SHALL support a configurable set of comparison sources. Each source
SHALL have an `id`, `name`, and `version`. Sources MAY be templates already in
the repo, external templates, or separately registered document sets. The
source configuration SHALL be open-ended so that new sources can be added
without modifying core code.

#### Scenario: [OA-071] Register a new comparison source
- **WHEN** a new source `cooley-series-seed` is added to the source corpus configuration
- **THEN** the next similarity index build includes scores against `cooley-series-seed` clauses
- **AND** existing source scores are preserved

#### Scenario: [OA-072] Source version tracking
- **WHEN** a source document is updated to a new version
- **THEN** the source configuration reflects the new version
- **AND** re-running the build pipeline produces updated similarity scores

### Requirement: Clause Extraction
The system SHALL extract clauses from DOCX templates at paragraph-level
granularity, grouped by heading. Each clause SHALL receive a stable identifier
derived from its heading hierarchy and paragraph index. The extraction SHALL
handle standard legal document structure (numbered sections, lettered
subsections, definition lists).

#### Scenario: [OA-073] Paragraph-level extraction with stable IDs
- **WHEN** a DOCX template with headings "1. Definitions", "2. Obligations" is processed
- **THEN** each paragraph under each heading is extracted as a separate clause
- **AND** each clause receives a deterministic ID like `section-1-para-1`

#### Scenario: [OA-074] Re-extraction produces identical IDs
- **WHEN** the same unmodified DOCX is extracted twice
- **THEN** the clause IDs are identical across both runs

### Requirement: Similarity CLI Command
The CLI SHALL provide `open-agreements similarity <template>` to query
pre-computed similarity data. The command SHALL output per-clause similarity
scores against configured sources. The command SHALL support `--json` for
machine-readable output and human-readable table output by default.

#### Scenario: [OA-075] Query similarity for a template
- **WHEN** `open-agreements similarity common-paper-mutual-nda`
- **THEN** the CLI outputs a table with columns: clause ID, excerpt, and similarity scores per source
- **AND** clauses are listed in document order

#### Scenario: [OA-076] JSON output for programmatic access
- **WHEN** `open-agreements similarity common-paper-mutual-nda --json`
- **THEN** the output is valid JSON matching the `similarity-index.json` schema

### Requirement: Landing Page Heat Map
The landing site SHALL display an interactive heat map on template detail
pages. Each clause SHALL be rendered with a color band reflecting its
aggregate similarity score across sources. The heat map data SHALL be loaded
from the pre-computed `similarity-index.json` at build time, with zero
runtime API calls.

#### Scenario: [OA-077] Heat map renders with color bands
- **WHEN** a user views a template detail page
- **THEN** each clause is displayed with a color band (green = high similarity, yellow = moderate, red = low)
- **AND** the color is derived from the highest similarity score across all sources

#### Scenario: [OA-078] Mouseover shows per-source scores
- **WHEN** a user hovers over a clause in the heat map
- **THEN** a tooltip appears showing similarity scores against each source
- **AND** scores are displayed as percentages with source names

#### Scenario: [OA-079] Click opens redline comparison
- **WHEN** a user clicks a source name in the similarity tooltip
- **THEN** a redline diff view opens comparing the clause text against the matching source clause
- **AND** additions and deletions are visually distinguished

### Requirement: Machine-Readable Similarity in llms.txt
The system SHALL include per-clause similarity data in `llms.txt` output as a
TSV-formatted section per template. Each row SHALL contain the clause ID,
a text excerpt, and similarity scores against the top 3 sources. This enables
AI agents to assess clause provenance without re-embedding.

#### Scenario: [OA-080] llms.txt includes similarity table
- **WHEN** `llms.txt` is generated for a template with a similarity index
- **THEN** the file includes a `## Clause Similarity: <template-id>` section
- **AND** each row contains clause_id, excerpt, and at least one source similarity score

#### Scenario: [OA-081] AI agent reads similarity context
- **WHEN** an AI agent reads `llms.txt` for a template
- **THEN** the agent can determine that clause `section-3-para-1` is 92% similar to `cooley-series-seed` section 2
- **AND** the agent can use this information to assess provenance confidence

### Requirement: Clause Provenance Tracking
Each clause in the similarity index SHALL include an `origin` field recording
the source template, version, and any modifications applied. This provides an
audit trail for every provision in the template.

#### Scenario: [OA-082] Clause origin is recorded
- **WHEN** a similarity index is built for a template
- **THEN** each clause entry includes `origin.template` and `origin.version`

#### Scenario: [OA-083] Provenance traces modification history
- **WHEN** a clause was adapted from another template (e.g., generalized from Cooley Series Seed)
- **THEN** the `origin` field includes the source template ID and a note about the adaptation
