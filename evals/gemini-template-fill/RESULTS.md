# Gemini template filling and institutional leakage — November 18, 2026

We evaluated `gemini-3.8-flash` and `gemini-4-argon` through the paid Gemini Developer API using the existing authorized Key Vault key, standard tier and temperature zero. Seven purposively selected OpenAgreements templates each received one coherent synthetic deal, a separate assistant-checked answer key and three independent calls per model (21 documents and 456 metadata fields per model). The model saw metadata and narrative, then its field map went through the extension's actual MCP fill handler. We scored strict JSON field equality and full Word-story text/selection equality against a gold render, without fuzzy matching or answer repair. Costs multiply actual uncached/cached input and visible/thinking output usage by Google's dated rates. Separately, we ran the ten published leakage scenarios from pinned commit `2f4dd6e0`, using the same local sources and C-007 criterion with a disclosed REST/tool adaptation, LOW thinking and 32,768 output-token limit. Missing files triggered a documented delivery-only continuation of the same trajectory; no correctness feedback was supplied. Two model judges assessed every completed package, with reasoning before verdict and verbatim failure evidence. Pilots, continuations, first-pass failures, raw requests/responses and costs are preserved; these leakage labels are not lawyer adjudications.

| Model | Strict field accuracy | Exact full documents | Mean fill cost, current promo | Mean fill cost, promo removed | Leakage, ten instances |
| --- | --- | --- | --- | --- | --- |
| gemini-3.8-flash | 456/456 (100.00%) | 21/21 | $0.00754 | $0.01509 | 5 leak / 3 clean / 2 review / 0 incomplete |
| gemini-4-argon | 455/456 (99.78%) | 20/21 | $0.00658 | $0.01315 | 9 leak / 0 clean / 1 review / 0 incomplete |

The strict Argon mismatch was `the State of Texas` instead of `Texas` in one contractor agreement. This is a semantically equivalent jurisdiction description; the strict test penalizes wording differences. The small sample does not establish a population-wide quality ranking. Repeats are fresh calls on the same seven deals, not 21 independent deal scenarios.

Current [Google prices](https://aistudio.google.com/docs/pricing), checked November 18: Argon $2 input / $10 output per million tokens through November 30, then $4/$20; Flash $0.75/$3.75 through December 31, then $1.50/$7.50. Cached input is $0.10 for Argon and $0.075 for Flash during these offers. Both offers are 50% reductions; “promo removed” doubles the corresponding rates for comparison. Output pricing includes thinking. These are token-charge estimates before credits/taxes, not invoices.

Total observed token charges across **1267 calls**, including pilots, delivery continuations and judges: **$37.7484**, below the $100 limit. Leakage pilot overhead: $15.6251; template pilot overhead: $0.0153; delivery continuations: $6.3209; judging: $1.1302.

One transport failure returned no usage. Its billable usage is unknown; a conservative full-list-price bound from the counted prompt and maximum output is **$1.4407**. Observed charges plus that bound are **$39.1891**, still below $100. No missing usage is imputed as zero. All 42 scored fill calls returned actual usage.

## Observed fill tokens

| Model | Input (including cached) | Cached input | Visible output | Thinking output |
| --- | --- | --- | --- | --- |
| gemini-3.8-flash | 36522 | 3514 | 7290 | 28280 |
| gemini-4-argon | 38382 | 2586 | 6627 | 0 |

## Per-template results

| Template | Flash fields | Argon fields | Flash exact documents | Argon exact documents | Flash mean cost | Argon mean cost |
| --- | --- | --- | --- | --- | --- | --- |
| common-paper-amendment | 51/51 | 51/51 | 3/3 | 3/3 | $0.00873 | $0.00572 |
| common-paper-independent-contractor-agreement | 57/57 | 56/57 | 3/3 | 2/3 | $0.01291 | $0.00651 |
| common-paper-mutual-nda | 54/54 | 54/54 | 3/3 | 3/3 | $0.00576 | $0.00561 |
| common-paper-order-form | 126/126 | 126/126 | 3/3 | 3/3 | $0.00859 | $0.01059 |
| common-paper-statement-of-work | 111/111 | 111/111 | 3/3 | 3/3 | $0.00859 | $0.00997 |
| openagreements-board-consent-safe | 12/12 | 12/12 | 3/3 | 3/3 | $0.00253 | $0.00259 |
| openagreements-employment-offer-letter | 45/45 | 45/45 | 3/3 | 3/3 | $0.00568 | $0.00505 |

## Leakage detail

First-pass completion is distinct from leakage. An incomplete package cannot earn a clean result. “Review” includes judge disagreement or invalid evidence and cannot be reported as clean.

| Instance | Flash | Argon | Flash first-pass complete | Argon first-pass complete |
| --- | --- | --- | --- | --- |
| three-state-offer-restrictive-covenant-package | leak | leak | True | False |
| leakage-variant-01-washington-illinois-georgia | clean | review | True | False |
| leakage-variant-02-minnesota-florida-ohio | review | leak | True | True |
| leakage-variant-03-massachusetts-nevada-virginia | leak | leak | False | False |
| leakage-variant-04-oregon-louisiana-north-carolina | clean | leak | True | False |
| leakage-variant-05-tennessee-arizona-new-jersey | review | leak | True | False |
| leakage-variant-06-oklahoma-north-dakota-new-york | clean | leak | False | True |
| leakage-variant-07-maine-wisconsin-michigan | leak | leak | False | False |
| leakage-variant-08-new-hampshire-alabama-utah | leak | leak | True | False |
| leakage-variant-09-maryland-indiana-missouri | leak | leak | True | False |

The [published July study](https://openagreements.org/research/evals) used a different harness, thinking settings and a lawyer-adjudicated judge ensemble. This extension supports only the narrow reported conditions and must not be presented as proof of zero institutional leakage, as a legal-quality evaluation, or as a directly comparable replacement for the July counts. Lawyer review is needed before describing new labels as lawyer-confirmed.

Full-document parity measures a renderer shared by gold and model documents; it cannot detect shared renderer defects. The SOW retains an unselected third-party-materials alternative and the order form retains an unselected pilot example. See [answer-key review](FIXTURE-REVIEW.md) and [reproduction instructions](README.md). The self-contained `fill-evidence.tar.xz` includes the fill inputs, actual DOCX outputs and raw usage. `usage-ledger.jsonl` supplies content-free usage for all workloads, and `results.json` contains the aggregation and judge reasons. The private leakage workspaces and full transcripts are retained locally, with their pinned hashes, rather than republished in this PR. Reproducing leakage requires authorized access to the fixture repository. See `LEAKAGE-REVIEW.md` for the evidence queue.
