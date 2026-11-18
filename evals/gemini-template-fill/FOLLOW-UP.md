# Where the models differ

**Median token cost per completed fill** gives the models room to differ even when field accuracy is close to perfect. On the original 21 scored fills per model, Argon cost 23% less at the median under the November 18 rates. Argon was also faster at the median, but Flash had the shorter upper tail. Timing covers the generation request, excluding token counting and DOCX rendering.

| Metric | Flash 3.8 | Argon 4 |
| --- | ---: | ---: |
| Median token cost | $0.00742 | $0.00574 |
| 95th percentile token cost | $0.01211 | $0.01123 |
| Median generation time | 12.11 s | 9.45 s |
| 95th percentile generation time | 21.43 s | 29.67 s |

The 95th percentile is the 20th ordered value out of 21 (nearest rank). These are descriptive sample statistics. The cost comparison uses both models' active promotions and observed cache usage. At Argon's December 1 rates and Flash's still-active December rates, the same token usage would put median costs at $0.01148 for Argon and $0.00742 for Flash.

An exploratory accuracy challenge added approved revisions to four existing deal memos. Revisions required date arithmetic, fee and salary calculations, rounding, switching renewal options, and ignoring rejected changes. Each model got one call per case with the same prompt and provider-default thinking. Both matched **18/18 changed fields and 4/4 full DOCX renders**. This version still has an accuracy ceiling. The eight calls cost $0.0785 based on returned usage. The fixture revisions, keys and model outputs are in [reconcile.py](reconcile.py) and [reconciliation-results.json](reconciliation-results.json). To rerun with a fresh output directory, use `python3 evals/gemini-template-fill/reconcile.py /tmp/oa-reconciliation-new` after building the MCP package and configuring credentials as described in the README.
