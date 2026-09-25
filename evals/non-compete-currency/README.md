# Non-compete currency eval

Do language models know the *current* state of U.S. non-compete law, and does an OpenAgreements practice guide in context change the answer? This directory holds everything behind the published numbers: prompts, answer key, model runs, audit, and scorer. Nothing here calls a model unless you run `run` explicitly.

Numbers: [`RESULTS.md`](RESULTS.md) (generated) and [`results.json`](results.json) (the single source for any published figure).

## What was run

- **Models:** `gemini-3.5-flash-lite` (all three conditions); `gemini-3.8-flash` and `gemini-3.1-pro-preview` (cold only). Gemini API `generateContent`, temperature 0, JSON response mode, no web search or tools, one run per item on 2026-09-23.
- **Conditions:** `cold` (question only), `oa` (the target state's guide in context), `control` (the *next* state's guide alphabetically in context, a negative control).
- **Guides:** read from commit `30b1281e` of this repo via `git show`, never the working tree. The corpus is updated daily; commit #877 on 2026-09-24 rewrote 39 of these guides. `results.json` records a SHA-256 for every guide at that commit.
- **Question families** (`longtail.py`, prompts verbatim in `Q`): 2026 earnings threshold, statutes effective on or after 2024-01-01 (recency), consideration for mid-employment covenants, statutory duration, choice-of-law bar, advance-notice days, and court narrowing. **Narrowing is excluded from every aggregate:** narrow/void is ill-posed for strict blue-pencil and near-ban states.

## How the answer key was built

1. Labelling agents proposed a label plus a verbatim guide quote per state (`truth2/SPEC.md`, outputs `truth2/*.json`; their helper scripts are kept for provenance).
2. `gate_truth2.py` keeps an item only if every quote is an exact substring of the pinned guide and every number or date appears inside the quote. Its self-test includes cases that must fail.
3. Yes/no labels were reviewed by a person; items where a defensible answer would be scored wrong are dropped with a reason in `review_drops.json`.
4. **Independent audit.** `sample_audit.py` draws a seeded, family-stratified sample of 25 retained items, including items where `cold` and `oa` agree. Agents barred from openagreements.org checked each against primary sources (`audit/audit_*_verdicts.json`): 23 confirmed (two via secondary reproductions of the official text), 2 partly correct, 0 contradicted. Both partly-correct items were dropped from the key. This is an agent primary-source spot-check, not lawyer adjudication.
5. `audit/spot_*` is an earlier check of 20 items sampled only from cold/oa disagreements (all 20 confirmed); it is kept for the record but cannot estimate key accuracy. `audit/audit_evidence.json` records the Tennessee and Indiana source checks.

The short-form test (`run_bench.py`, `score_bench.py`, `runs/runs.jsonl`) asked for each state's controlling statute; its hand-curated citations are gated by `score_bench.py --gate`.

## Reading the results

- The answer key comes from the same guides shown in `oa`. The `oa` scores show a model can take the keyed fact from the guide; they are not an independent measure of legal accuracy. The `control` condition shows the answers depend on the *correct* state's guide. External accuracy rests on the audit, with its stated scope.
- Every recency item is positive (each keyed state did enact a qualifying statute). The recency score is effective-date recall on selected positive cases, not a test of telling changed states from unchanged ones. `results.json` breaks failures into `enacted_false`, `no_matching_date` and `refusal`, and reports an always-true comparator.
- One vendor, one temperature-0 run per item: a snapshot, not a reliability estimate.

## Reproduce

```bash
cd evals/non-compete-currency
python3 -B gate_truth2.py --selftest && python3 -B longtail.py score --selftest && python3 -B score_bench.py --selftest
python3 -B score_bench.py --gate          # short-form citation key vs pinned guides
python3 -B gate_truth2.py                 # regenerates truth2.jsonl from truth2/*.json + review_drops.json
python3 -B longtail.py results            # regenerates results.json + RESULTS.md
git diff --exit-code -- truth2.jsonl results.json RESULTS.md   # must be clean
python3 -B longtail.py score --detail     # per-item view
```

CI runs the same steps (`.github/workflows/evals-non-compete-currency.yml`). Re-running the models (`longtail.py run`, `run_bench.py`) needs `GEMINI_API_KEY` and produces new run files; outputs will differ as hosted models change.
