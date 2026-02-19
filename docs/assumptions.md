---
title: Assumptions
description: High-impact pipeline assumptions and their linked verification commands.
order: 8
section: Reference
---

# Assumptions

This document captures the highest-impact assumptions in the OpenAgreements pipeline, especially for NVCA recipe processing where source formatting and bracket semantics are complex.

Use this together with the targeted verification commands at the end of this document.

## Why this exists

- Makes implicit behavior explicit.
- Links assumptions to executable tests.
- Reduces regressions caused by “safe-looking” config or normalization changes.

## Key assumptions

### OA-ASSUMP-001: Bracket-prefixed NVCA headings are real content, not boilerplate

- Assumption: Heading lines like `[Small Business Concern` and `[Real Property Holding Corporation` must survive cleaning.
- Risk if wrong: Subsection headings disappear, leaving orphaned body paragraphs (for example `. The Company ... ]`).
- Validation: `integration-tests/nvca-assumptions.test.ts` (`clean step preserves bracket-prefixed headings while removing bracketed alternatives`).

### OA-ASSUMP-002: Alternative boilerplate blocks should still be removed in clean stage

- Assumption: Paragraphs starting with `[Alternative 1:` / `[Alternative 2:` are drafting alternatives and should be removed.
- Risk if wrong: Draft-only instructions leak into production output.
- Validation: `integration-tests/nvca-assumptions.test.ts` (same test as OA-ASSUMP-001; validates both “keep headings” and “drop alternatives”).

### OA-ASSUMP-003: Declarative normalization may run without broad paragraph rewrites

- Assumption: In declarative mode, we should avoid global text rewrites that can shift run-level style boundaries.
- Risk if wrong: Underline/bold/highlight drift and heading/body spacing artifacts.
- Validation: `src/core/recipe/bracket-normalizer.test.ts` and `integration-tests/nvca-assumptions.test.ts`.

### OA-ASSUMP-004: Heading fallback normalization can safely strip only the leading bracket

- Assumption: For short heading-like lines that start with `[`, removing only the leading bracket is safe.
- Risk if wrong: Real bracketed content could be mutated incorrectly.
- Validation: `integration-tests/nvca-assumptions.test.ts` (`declarative normalize strips heading-leading brackets and trims unmatched trailing brackets`).

### OA-ASSUMP-005: Unmatched trailing `]` should be trimmed in declarative mode

- Assumption: When closing brackets outnumber opening brackets at paragraph end, trimming trailing `]` is safe.
- Risk if wrong: Dangling punctuation and malformed legal prose remain.
- Validation: `src/core/recipe/bracket-normalizer.test.ts` and `integration-tests/nvca-assumptions.test.ts`.

### OA-ASSUMP-006: NVCA option blocks are intentionally left when no explicit selection rule exists

- Assumption: Balanced in-line option blocks (for example `[“small business concern”][“smaller business”]`) should remain unless a declarative selection rule is defined.
- Risk if wrong: We might delete legally meaningful choices implicitly.
- Validation: `integration-tests/nvca-assumptions.test.ts` (expects headings fixed but option pair still present unless separately configured).

### OA-ASSUMP-007: OpenSpec scenario coverage and implementation tests are separate quality gates

- Assumption: OpenSpec scenario traceability does not replace behavior-level tests; both must pass.
- Risk if wrong: We can have green scenario mapping with untested runtime behavior.
- Validation: `npm run check:spec-coverage` + `npm run test:run`.

### OA-ASSUMP-008: Short placeholders discovered by scan should map to explicit metadata-backed replacements

- Assumption: Any scan-discovered short placeholder that is intended for automation has an explicit mapping to metadata fields.
- Risk if wrong: Silent holes in fill coverage (placeholder is visible but never filled).
- Validation: `integration-tests/scan-metadata-completeness.test.ts`.

### OA-ASSUMP-009: Declarative cleanup must preserve run-level formatting boundaries

- Assumption: Bracket cleanup should not move underline/bold boundaries around legally significant anchors.
- Risk if wrong: Visual drift undermines trust even when values are correct.
- Validation: `integration-tests/formatting-boundary-diff.test.ts`.

### OA-ASSUMP-010: Recipe source drift canary needs both hash and structural anchor checks

- Assumption: Hash integrity alone is insufficient; anchor-level checks are needed to detect source format drift that breaks replacements/normalize rules.
- Risk if wrong: Source updates can pass hash checks (or hash can be updated manually) while runtime behavior silently breaks.
- Validation: `integration-tests/source-drift-canary.test.ts` and `npm run check:source-drift`.

### OA-ASSUMP-011: Top NVCA option clauses should follow explicit policy behavior

- Assumption: High-impact clause choices are deterministic (for example costs-of-enforcement policy and dispute-resolution mode defaults) or explicitly preserved as unresolved.
- Risk if wrong: Clause outcomes become ad hoc and difficult to audit.
- Validation: `integration-tests/nvca-option-policy.test.ts`.

### OA-ASSUMP-012: Declarative normalization rules require start/end anchor pairs plus expected match floors

- Assumption: High-impact declarative rules should target both a start anchor (`paragraph_contains`) and end anchor (`paragraph_end_contains`) and declare a minimum expected match count.
- Risk if wrong: Broad or drifting matches can silently mutate the wrong paragraph, or intended edits can stop applying without clear signal.
- Validation: `src/core/recipe/bracket-normalizer.test.ts`, `integration-tests/source-drift-canary.test.ts`, and `npm run check:source-drift`.

## Quick verification commands

```bash
# Assumption-focused regression checks
npx vitest run integration-tests/nvca-assumptions.test.ts src/core/recipe/bracket-normalizer.test.ts

# Full quality gates
npm run check:spec-coverage
npm run test:run

# Source drift canary (hash + structural anchors)
npm run check:source-drift
```
