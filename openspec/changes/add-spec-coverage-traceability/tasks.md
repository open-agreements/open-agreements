## 1. Coverage validator

- [x] 1.1 Add `scripts/validate_openspec_coverage.mjs`
- [x] 1.2 Parse canonical scenarios from `openspec/specs/*/spec.md`
- [x] 1.3 Parse Allure story mappings from `*.allure.test.ts`
- [x] 1.4 Detect missing/extra mappings and skipped/todo/pending markers
- [x] 1.5 Generate traceability matrix markdown output

## 2. Traceability tests

- [x] 2.1 Add `tests/open_agreements_traceability.allure.test.ts`
- [x] 2.2 Map every `open-agreements` OpenSpec scenario to an Allure story
- [x] 2.3 Use scenario-first naming (`Scenario: ...`) for semantic clarity

## 3. Tooling and CI

- [x] 3.1 Add `npm run check:spec-coverage` script
- [x] 3.2 Add CI workflow gate to run the spec-coverage validator
- [x] 3.3 Ensure generated matrix file is committed and updated

## 4. Validation

- [x] 4.1 Run `npm run check:spec-coverage`
- [x] 4.2 Run `npm run test:run`
- [x] 4.3 Run `openspec validate add-spec-coverage-traceability --strict`
