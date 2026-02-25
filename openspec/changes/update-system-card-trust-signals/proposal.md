# Change: Upgrade System Card Trust Signals

## Why

The current trust system card over-emphasizes mapping percentages and does not
provide enough direct evidence for skeptical technical reviewers. It also uses
status semantics that can be interpreted as loopholes (`pending_impl`) instead
of a clear binary view.

We need a verifiable trust surface that combines:
- spec-to-test traceability,
- latest runtime test outcomes,
- direct links to proof artifacts,
- and scenario drill-down by test epic.

## What Changes

- Add a runtime trust data export artifact at `site/_data/systemCardRuntime.json`
  sourced from `allure-report/summary.json`.
- Update system card generation to show runtime trust cards (pass rate, fail
  count, missing scenarios), plus a "Prove It" block with timestamp, commit,
  and CI run links.
- Add expandable epic drill-down sections showing scenario-level rows and
  mapped tests.
- Normalize trust-facing scenario mapping status to binary values:
  `covered` or `missing`.
- Add runtime-data freshness validation in trust checks.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `scripts/generate_system_card.mjs`
  - `scripts/export_allure_summary.mjs`
  - `scripts/check_system_card_runtime.mjs` (new)
  - `site/src/input.css`
  - `site/trust/system-card.md` (generated)
  - `site/_data/systemCardRuntime.json` (generated)
  - `package.json` trust scripts
- CI impact:
  - trust checks include runtime trust data validation
