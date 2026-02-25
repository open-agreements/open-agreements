## 1. Runtime Trust Data Pipeline
- [x] 1.1 Export system card runtime trust data from `allure-report/summary.json`.
- [x] 1.2 Write normalized runtime artifact to `site/_data/systemCardRuntime.json`.
- [x] 1.3 Include freshness metadata and proof links (commit + CI run).

## 2. System Card Rendering
- [x] 2.1 Update system card generation to consume runtime trust data.
- [x] 2.2 Replace repetitive percentage-heavy summary with trust metric cards.
- [x] 2.3 Add "Prove It" section with timestamp, commit, CI, and report links.
- [x] 2.4 Add expandable epic drill-down with scenario-level rows.

## 3. Binary Mapping Status Contract
- [x] 3.1 Normalize trust-facing scenario status to `covered` or `missing`.
- [x] 3.2 Collapse legacy `pending_impl` to `missing` in trust outputs.

## 4. Trust Checks and Build Wiring
- [x] 4.1 Add runtime trust data validation script for shape + freshness.
- [x] 4.2 Wire runtime export and checks into `trust:rebuild` and `trust:check`.
- [x] 4.3 Regenerate system card and CSS for local/CI reproducibility.
