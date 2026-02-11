## 1. Implementation
- [x] 1.1 Add/adjust trust signals in `README.md` so CI, coverage, and test framework are explicitly visible.
- [x] 1.2 Add/adjust trust signals on `site/index.html` so visitors can verify CI and Codecov evidence quickly.
- [x] 1.3 Extend CI to emit machine-readable unit test results (JUnit XML) from the active JS test runner and upload them to Codecov test-results ingestion.
- [x] 1.4 Keep Codecov coverage upload green in CI and ensure badge/link targets remain valid.
- [x] 1.5 Document any required configuration assumptions (tokenless upload vs secret fallback) in workflow comments or docs.
- [x] 1.6 Add `codecov.yml` with initial trust-first gates: patch target `85%` with `5%` threshold; project target `auto` with `0.5%` threshold.
- [x] 1.7 Add ratchet notes for project coverage floor increases (for example `50%` then `55%`) after baseline stabilizes.
- [x] 1.8 Expand canonical `open-agreements` scenarios for currently implemented behavior where coverage is shallow or implicit.
- [x] 1.9 Add/expand Allure-reported behavior tests keyed to those scenarios (not only sentinel mappings) and keep `check:spec-coverage` green.

## 2. Validation
- [x] 2.1 Run `npm run test:run`.
- [x] 2.2 Run `npm run test:coverage`.
- [x] 2.3 Run `npm run check:spec-coverage`.
- [x] 2.4 Run `openspec validate add-trust-signals-evidence --strict`.
