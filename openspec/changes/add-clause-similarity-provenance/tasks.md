## 1. Embedding Provider
- [ ] 1.1 Define `EmbeddingProvider` interface in `src/core/similarity/types.ts`
- [ ] 1.2 Implement default provider (sentence-transformer via `@xenova/transformers` or Python subprocess)
- [ ] 1.3 Add provider configuration in project settings
- [ ] 1.4 Unit tests for default provider (produces vectors, correct dimensions)

## 2. Clause Extraction
- [ ] 2.1 Build clause extractor from DOCX paragraphs grouped by heading
- [ ] 2.2 Implement stable clause ID generation (heading hierarchy + paragraph index)
- [ ] 2.3 Unit tests for extraction determinism (same DOCX → same IDs)

## 3. Source Corpus
- [ ] 3.1 Define source corpus configuration schema (id, name, version, path or URL)
- [ ] 3.2 Register initial sources: repo templates + Cooley Series Seed + SBA Form 160
- [ ] 3.3 Extract and embed source document clauses

## 4. Similarity Scoring Pipeline
- [ ] 4.1 Implement cosine similarity scorer between clause embedding vectors
- [ ] 4.2 Build `similarity-index.json` writer with schema version, model metadata, and per-clause scores
- [ ] 4.3 Create `scripts/build-similarity-index.ts` build-time pipeline
- [ ] 4.4 Generate initial similarity indexes for all templates in the repo
- [ ] 4.5 Unit tests for cosine similarity correctness
- [ ] 4.6 Integration test: full pipeline from DOCX → index JSON

## 5. CLI Command
- [ ] 5.1 Add `similarity <template>` command to CLI
- [ ] 5.2 Implement human-readable table output (clause ID, excerpt, scores)
- [ ] 5.3 Implement `--json` output matching index schema
- [ ] 5.4 Tests for CLI output format

## 6. Landing Page Heat Map UI
- [ ] 6.1 Load `similarity-index.json` at site build time
- [ ] 6.2 Render clause color bands based on aggregate similarity scores
- [ ] 6.3 Implement mouseover tooltip showing per-source scores with percentages
- [ ] 6.4 Implement click-to-redline: open diff view against selected source clause
- [ ] 6.5 Integrate with `add-docx-comparison-redline` pipeline for diff rendering

## 7. Machine-Readable Output
- [ ] 7.1 Add per-clause similarity TSV section to `llms.txt` generation
- [ ] 7.2 Include clause_id, excerpt, and top-3 source similarity scores
- [ ] 7.3 Test that generated `llms.txt` is parseable and correct

## 8. Provenance
- [ ] 8.1 Add `origin` field to similarity index clause entries
- [ ] 8.2 Populate origin data for existing templates
- [ ] 8.3 Document provenance schema in `docs/similarity.md`
