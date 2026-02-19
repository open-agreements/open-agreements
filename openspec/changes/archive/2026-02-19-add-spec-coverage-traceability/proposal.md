# Change: Add OpenSpec-to-Allure traceability validation

## Why

OpenAgreements currently has specs and tests, but no automated gate that proves
every OpenSpec scenario is mapped to an Allure story. That makes traceability
manual and prone to drift.

## What Changes

- Add a programmatic traceability validator: `npm run check:spec-coverage`
- Parse canonical OpenSpec scenarios from `openspec/specs/*/spec.md`
- Parse scenario mappings from `*.allure.test.ts` files
- Detect and report:
  - missing scenario mappings
  - extra stories not present in specs
  - skipped/todo scenario tests
  - pending markers in traceability tests
- Generate a traceability matrix markdown file each run
- Add a dedicated Allure traceability suite for the `open-agreements` capability
- Add a CI gate that runs the coverage validator on pull requests and pushes

## Impact

- Affected specs:
  - `open-agreements` (new traceability requirement)
- Affected code:
  - new validator script under `scripts/`
  - new `*.allure.test.ts` traceability tests under `tests/`
  - package scripts and CI workflow updates
  - generated matrix under `tests/`
- Compatibility:
  - additive; no runtime behavior changes for the agreement engine
