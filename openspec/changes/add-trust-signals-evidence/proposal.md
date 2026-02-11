# Change: Add CI-Backed Trust Signals for Public Evaluation

## Why
Prospective users and AI agents need fast, verifiable proof that OpenAgreements is actively tested and maintained. The project already has CI and coverage, but the trust evidence can be clearer and more explicit about the active JavaScript test runner.
In addition, trust is stronger when coverage policy is codified in-repo and behavior tests are demonstrably tied to canonical specs.

## What Changes
- Add explicit public trust signals for test quality and maintenance posture across README and landing page surfaces.
- Keep Codecov as a first-class trust signal and add machine-readable test-result publishing from CI.
- Surface the active JS test framework in trust-facing content (Vitest today; equivalent Jest wording if framework changes).
- Add a repository-owned `codecov.yml` with practical trust-first gates:
  - patch target `85%` with `5%` threshold (effective floor `80%`)
  - project target `auto` with `0.5%` threshold (non-regression baseline protection)
  - staged ratchet guidance to raise project floor after baseline improves
- Expand spec-driven Allure coverage depth by retroactively adding canonical scenarios for already-implemented behavior where needed and mapping them to executable tests.
- Keep implementation minimal: no new paid dependencies and no complex dashboards required.

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `README.md`
  - `site/index.html`
  - `.github/workflows/ci.yml`
  - `codecov.yml`
  - optional small script/package updates for JUnit output
  - `openspec/specs/open-agreements/spec.md`
  - `tests/*.allure.test.ts`
