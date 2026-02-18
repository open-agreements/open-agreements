# Assumption Test Matrix

This matrix ties key assumptions to executable tests and commands.

## Matrix

| Assumption ID | Assumption | Primary test(s) | How to run |
| --- | --- | --- | --- |
| OA-ASSUMP-001 | Bracket-prefixed NVCA headings are retained during cleaning | `tests/nvca-assumptions.test.ts` → `clean step preserves bracket-prefixed headings while removing bracketed alternatives` | `npx vitest run tests/nvca-assumptions.test.ts` |
| OA-ASSUMP-002 | `[Alternative 1/2]` boilerplate is removed during cleaning | `tests/nvca-assumptions.test.ts` → same test as OA-ASSUMP-001 | `npx vitest run tests/nvca-assumptions.test.ts` |
| OA-ASSUMP-003 | Declarative normalization avoids broad rewrite artifacts | `tests/bracket-normalizer.test.ts` + `tests/nvca-assumptions.test.ts` | `npx vitest run tests/bracket-normalizer.test.ts tests/nvca-assumptions.test.ts` |
| OA-ASSUMP-004 | Heading fallback strips only leading `[` on heading-like lines | `tests/nvca-assumptions.test.ts` → `declarative normalize strips heading-leading brackets and trims unmatched trailing brackets` | `npx vitest run tests/nvca-assumptions.test.ts` |
| OA-ASSUMP-005 | Unmatched trailing `]` is trimmed | `tests/bracket-normalizer.test.ts` + `tests/nvca-assumptions.test.ts` | `npx vitest run tests/bracket-normalizer.test.ts tests/nvca-assumptions.test.ts` |
| OA-ASSUMP-006 | In-line balanced option blocks stay unless explicit selection exists | `tests/nvca-assumptions.test.ts` → `declarative normalize strips heading-leading brackets and trims unmatched trailing brackets` | `npx vitest run tests/nvca-assumptions.test.ts` |
| OA-ASSUMP-007 | Spec traceability and behavior tests are both required | `tests/open_agreements_traceability.allure.test.ts` plus full suite | `npm run check:spec-coverage && npm run test:run` |
| OA-ASSUMP-008 | Scan-discovered short placeholders map to metadata-backed replacements | `tests/scan-metadata-completeness.test.ts` | `npx vitest run tests/scan-metadata-completeness.test.ts` |
| OA-ASSUMP-009 | Declarative cleanup preserves run-level style boundaries | `tests/formatting-boundary-diff.test.ts` | `npx vitest run tests/formatting-boundary-diff.test.ts` |
| OA-ASSUMP-010 | Source drift canary must enforce hash + structural anchors | `tests/source-drift-canary.test.ts` + canary script | `npx vitest run tests/source-drift-canary.test.ts && npm run check:source-drift` |
| OA-ASSUMP-011 | Top NVCA option clauses follow explicit policy | `tests/nvca-option-policy.test.ts` | `npx vitest run tests/nvca-option-policy.test.ts` |
| OA-ASSUMP-012 | Declarative normalize rules use start/end anchors and expected match floors | `tests/bracket-normalizer.test.ts` + `tests/source-drift-canary.test.ts` | `npx vitest run tests/bracket-normalizer.test.ts tests/source-drift-canary.test.ts` |

## Notes

- This matrix is intentionally small and assumption-focused; it does not replace `tests/OPENSPEC_TRACEABILITY.md`.
- Update this file when behavior changes introduce or remove core assumptions.
