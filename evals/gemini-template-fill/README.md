# Gemini template filling and institutional leakage

This benchmark has two separate workloads. Filling extracts a complete field map from a synthetic deal narrative and invokes the template MCP handlers used by `gemini-extension.json`. Leakage executes the published ten-instance legal drafting family against its pinned, local knowledge library. Neither workload uses client data or external legal research.

## Reproduce

Requires Node >=20, Python >=3.12, git, and a Gemini paid-tier API key. Use `GEMINI_API_KEY` in the process environment, or authenticate Azure CLI to read `oa-harvey-gemini-api-key` from `junior-internal-tools-kv`. The runner never writes or prints credentials. It uses the authorized existing Gemini key, rather than Vertex, so prices correspond to the Gemini Developer API.

```sh
npm ci --ignore-scripts
npm run build
npm run build:contract-templates-mcp
python3 -m unittest discover -s evals/gemini-template-fill -p 'test_*.py'
python3 evals/gemini-template-fill/benchmark.py prepare --out /tmp/oa-gemini-fill
python3 evals/gemini-template-fill/benchmark.py fill --out /tmp/oa-gemini-fill --budget 5 --repeats 3

git clone https://github.com/open-agreements/harvey-labs-openagreements /tmp/oa-leakage-source
python3 evals/gemini-template-fill/run-leakage-matrix.py \
  --source-repo /tmp/oa-leakage-source --out /tmp/oa-gemini-leakage \
  --workers 4 --budget-per-instance 3
python3 evals/gemini-template-fill/judge-leakage.py \
  --runs /tmp/oa-gemini-leakage --out /tmp/oa-gemini-judges --budget 3
```

The commands allocate $38 total in separate output-directory budgets. Use fresh output directories for a fresh run. Existing completed cells are skipped, not rerolled. Never launch two writers against the same output directory. `--input-cache` can share an already exported leakage snapshot between shards; its file hashes must match the recorded manifest. Run `prepare` and review its `gold/*/review.txt` before paid filling. Keep source files and fixture hashes fixed for a run.

Prices are a dated snapshot in `benchmark.py`, sourced from [Google's pricing page](https://aistudio.google.com/docs/pricing). Argon prices expire November 30, 2026; Flash prices expire December 31, 2026. The runner refuses paid calls after those dates until the snapshot is deliberately updated. Costs use uncached input, cached input, visible output **and thinking tokens** at their respective rates. Dollar figures estimate token charges before credits and taxes, not an invoice. Count-token calls precede generation; maximum output and full list-price input are reserved before each paid call. A missing usage record stops the run. There are no automatic retries.

## Measurement

Seven purposively chosen templates span Common Paper commercial forms and OpenAgreements employment and corporate forms. Three independent calls per template/model yield 21 documents per model. Every top-level metadata field is scored with exact JSON type and value, including optional fields and inactive choices; an array is one field requiring exact agreement on every member and nested value. No fuzzy matching or post-answer repairs. Full-document parity separately compares every paragraph in every Word story part (body, headers, footers, footnotes, endnotes and comments), preserving checkbox text, symbols, tabs and breaks. It ignores ZIP timestamps and run segmentation; it does not measure visual layout. The model receives metadata and the narrative, not the answer key or the full rendered gold. Both keys and generated values use the actual `get_template`/`fill_template` MCP implementation. Discovery and Gemini CLI orchestration are outside this controlled harness.

Leakage uses exactly the original and variants 01–09, never held-out variants 10–17. The task snapshot is commit `2f4dd6e072219a573b581ab5de18b43c4d8ba967`, including the original's corrected freeze-v2b workspace. The headline July freeze commit predates those variants and corrections; using it alone would not reproduce the published family. Per-task git trees and SHA-256 hashes of every input are recorded. `git archive` reads objects, never dirty checkout files. Agent-visible inputs include all workspace documents but exclude task configuration, provenance and grading criteria.

This is a disclosed harness adaptation: direct Gemini REST calls with closed-universe list/read/search/write tools, rather than LAB's bash/read/write/edit/glob/grep tools and binary-format skills. Tasks, deal facts, knowledge library and C-007 criterion remain pinned. Both models run at temperature zero, explicit LOW thinking, max 32,768 output tokens per response, and at most 80 turns. Thinking signatures are returned unchanged in subsequent requests. Missing deliverables, truncation, provider failures and budget stops remain incomplete and never count as clean. Judge calls use both requested models, temperature zero, LOW thinking and reasoning-before-verdict JSON; failures must include verifiable verbatim evidence. These are model judgments with assistant review of flags, not lawyer adjudications. The published July models used different thinking and judge settings, so comparisons across those runs are descriptive.

Initial leakage pilots used provider-default thinking and 16,384 output tokens; the first exhausted that cap without writing files. They are retained and charged to overhead. The entire ten-instance production matrix was restarted under the uniform explicit settings, without choosing between pilot and production answers by outcome. See `FIXTURE-REVIEW.md` for template preflight exclusions. The final report must distinguish these pilots from scored production cells.
