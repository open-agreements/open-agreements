## Context

Users and AI agents need to evaluate how closely our templates' provisions
match trusted external forms. The transcript vision is "Law Insider-style"
sentence-level similarity, but open, free, and pre-computed. The result must
serve three audiences: humans browsing the landing page (heat map + tooltips),
AI agents reading `llms.txt` (TSV similarity table), and developers querying
via CLI.

Initial comparison sources: Cooley Series Seed governance consents (CC0),
SBA Form 160 (U.S. Government work), and templates already in the repo.

## Goals / Non-Goals

- Goals:
  - Pre-computed clause-level cosine similarity against configurable sources
  - Interactive heat map on landing page with mouseover and click-to-redline
  - Machine-readable similarity data in `llms.txt` and JSON index
  - Pluggable embedding model (no lock-in to a specific transformer)
  - Zero runtime compute cost for end users

- Non-Goals:
  - Real-time embedding or scoring
  - Distributing proprietary source document text
  - LLM-based semantic analysis
  - Cross-language support

## Decisions

### Embedding provider is a pluggable interface

**Decision**: Define `EmbeddingProvider` interface with `embed(texts: string[]): Promise<number[][]>`.
Ship a default implementation using a sentence-transformer model
(e.g., all-MiniLM-L6-v2 via `@xenova/transformers` for Node.js or a Python
subprocess calling `sentence-transformers`).

**Alternatives considered**:
- Hard-code a specific model: Rejected — locks users into one model and makes
  testing harder.
- TF-IDF baseline: Rejected as default — misses semantic similarity (e.g.,
  "terminate" vs. "cancel"). Could be offered as a fallback provider.
- OpenAI embeddings: Rejected as default — adds API cost and external dependency.
  Could be offered as an optional provider.

### Similarity index is a separate artifact, not inline

**Decision**: Each template gets a `similarity-index.json` file in
`content/similarity/<template-id>/`. The clause JSON representation is not
modified.

**Rationale**: Keeps the clause JSON clean and focused on template structure.
Similarity data can be rebuilt independently. Different source corpora can
produce different indexes without touching clause definitions.

### Clause extraction uses paragraph-level granularity

**Decision**: Extract clauses at the DOCX paragraph level, grouped by heading.
Each clause gets a stable ID derived from its heading hierarchy and paragraph
index (e.g., `section-3.2-para-1`).

**Alternatives considered**:
- Sentence-level: Too granular for legal text where provisions span multiple
  sentences. Could produce noisy scores.
- Section-level: Too coarse — misses variation within sections.
- Paragraph-level grouped by heading: Best balance. Matches how lawyers
  think about provisions.

### Heat map renders on the landing page with mouseover + click-to-redline

**Decision**: Full-stack UI. Each template page on the landing site shows
clauses with a color-coded similarity band. Mouseover shows a tooltip with
per-source scores. Clicking a source opens a red-line diff view (integrating
with the `add-docx-comparison-redline` pipeline).

**Implementation**: Static data from `similarity-index.json` loaded at build
time. Heat map colors computed from aggregate similarity. No runtime API calls.

### `llms.txt` includes per-clause similarity table

**Decision**: Append a TSV-like section to `llms.txt` for each template:
```
## Clause Similarity: common-paper-mutual-nda
clause_id	excerpt	source_1	sim_1	source_2	sim_2	source_3	sim_3
section-1-para-1	"This Agreement is entered..."	cooley-series-seed	0.92	nvca-spa	0.87	yc-safe	0.81
```

**Rationale**: AI agents can read the form and immediately see provenance
scores without re-embedding. The TSV format is trivially parseable.

## Similarity Index Schema

```jsonc
{
  "schema_version": "1.0",
  "template_id": "common-paper-mutual-nda",
  "generated_at": "2026-02-19T00:00:00Z",
  "embedding_model": "all-MiniLM-L6-v2",
  "sources": [
    { "id": "cooley-series-seed", "name": "Cooley Series Seed Board Consent", "version": "2024" }
  ],
  "clauses": [
    {
      "clause_id": "section-1-para-1",
      "heading": "1. Definition of Confidential Information",
      "excerpt": "\"Confidential Information\" means any information...",
      "origin": { "template": "common-paper-mutual-nda", "version": "2.0" },
      "similarities": [
        { "source_id": "cooley-series-seed", "clause_ref": "section-2-para-1", "score": 0.92 },
        { "source_id": "nvca-spa", "clause_ref": "section-5-para-3", "score": 0.87 }
      ]
    }
  ]
}
```

## Risks / Trade-offs

- **Embedding model size**: Sentence-transformer models are 20-90 MB. Shipping
  one in the npm package is impractical → download on first use or use a Python
  subprocess. Mitigation: pre-computed indexes ship in the package; the
  embedding model is only needed for rebuilding.
- **Source document licensing**: We cannot distribute proprietary source text.
  Mitigation: similarity scores are derived facts (not copyrightable expression).
  Red-line diffs require the user to have a legal copy of the source document
  (same model as recipes).
- **Stale indexes**: If a source document updates, pre-computed scores become
  stale. Mitigation: version-pin sources in the index metadata; CI can
  flag when a source version changes.
- **Paragraph segmentation instability**: Different DOCX editing histories may
  produce different paragraph boundaries. Mitigation: use heading-based
  grouping as the primary anchor, with paragraph index as tiebreaker.

## Open Questions

- Should the pre-computation pipeline run in CI (GitHub Actions) or only
  locally? CI would ensure indexes are always fresh but adds build time.
- What is the minimum number of sources needed before the heat map is
  meaningful? Proposal says 3, but some templates may only have 1-2
  comparable sources initially.
- Should the click-to-redline feature require the user to supply the source
  document (like recipes), or can we show a text-only diff from our
  pre-extracted clause text?
