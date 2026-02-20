# Change: Add Clause-Level Similarity Scoring and Provenance

## Why

People evaluating a legal form need to answer one core question: *does this
include the types of provisions that are in other forms I trust?* Today the
only way to answer that is to manually red-line two documents side by side.
That is slow, opaque, and inaccessible to non-lawyers.

By pre-computing cosine similarity scores (via sentence embeddings) between
every clause in our templates and provisions in trusted external sources — SEC
filings, Cooley Series Seed, NVCA models, etc. — we can give users an
immediate, visual answer. A heat map on the landing page. Mouseover a
provision, see similarity scores against 3+ trusted sources. Click through to
an exact red-line comparison. This is the Law Insider model applied at the
clause level, but open and pre-computed so it costs nothing at query time.

The first concrete use case: Joey Tsang (Harvard Law JD '21) is contributing
board resolution templates derived from the Cooley Series Seed governance
consents (CC0) and SBA Form 160 (U.S. Government work, 17 U.S.C. § 105).
Similarity scoring lets users immediately see how our generalized board
resolution template compares clause-by-clause to the original Cooley and SBA
source forms.

The machine-readable layer matters equally. Each template's clause JSON gets a
companion `similarity-index.json` with per-clause scores against the top
sources. The `llms.txt` output includes a TSV-like table so AI agents can
read a clause, see its similarity to 3+ trusted sources, and gain confidence
in provenance without re-embedding anything.

## What Changes

- **Pluggable embedding provider**: `EmbeddingProvider` interface with a default
  implementation (e.g., all-MiniLM-L6-v2 sentence-transformer). Swappable for
  any model that produces fixed-dimension vectors.
- **Pre-computation pipeline**: A build-time script that extracts clauses from
  DOCX templates, embeds them, computes pairwise cosine similarity against a
  configurable source corpus, and writes `similarity-index.json` per template.
- **Source corpus interface**: Open-ended. Any document set can be registered as
  a comparison source. Initial sources: templates already in the repo (NVCA,
  YC SAFE, Common Paper, Bonterms) plus Cooley Series Seed governance consents
  and SBA Form 160.
- **Similarity index artifact**: A separate `similarity-index.json` per template,
  keyed by clause ID, containing the top-N similarity scores and source
  references. Does not pollute the clause JSON itself.
- **Landing page heat map UI**: Interactive heat map on template pages. Each
  clause gets a color band reflecting aggregate similarity. On mouseover,
  a tooltip shows per-source similarity scores. On click, shows an exact
  red-line diff against the selected source (integrates with the existing
  `add-docx-comparison-redline` pipeline).
- **`llms.txt` similarity table**: Machine-readable per-clause similarity output
  with columns for clause ID, clause text excerpt, and similarity scores
  against the top 3 sources.
- **CLI command**: `open-agreements similarity <template>` to query similarity
  data from the pre-computed index.
- **Provenance tracking**: Each clause in the similarity index includes an
  `origin` field tracing the provision's source template and version.

## Scope Boundaries

### In scope
- Pluggable embedding provider interface and default implementation
- Pre-computation pipeline (build-time, not runtime)
- Similarity index JSON artifact per template
- Landing page interactive heat map with mouseover scores and click-to-redline
- `llms.txt` machine-readable similarity table
- CLI similarity query command
- Clause provenance metadata
- Integration with redline comparison pipeline

### Out of scope
- Real-time (on-the-fly) similarity computation — precomputed only
- LLM-based semantic analysis (embeddings only, no generative AI in the loop)
- Cross-language clause comparison
- Distributing full text of proprietary source documents (similarity scores
  and red-line diffs against user-obtained copies only)

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `src/core/similarity/` (new module: provider interface, scorer, index builder)
  - `scripts/build-similarity-index.ts` (pre-computation pipeline)
  - `site/` (heat map UI components, `llms.txt` generation)
  - `src/commands/similarity.ts` (CLI command)
  - `content/similarity/` (pre-computed index artifacts)
- Compatibility: additive, no breaking changes
