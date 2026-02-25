## Context

The trust system card currently reports scenario mapping but lacks direct runtime
proof and over-presents 100% metrics. Technical reviewers need drill-down,
verification metadata, and explicit limitations.

## Goals

- Combine OpenSpec traceability and latest Allure runtime outcomes.
- Expose proof metadata directly in the page (run timestamp, commit, CI link).
- Provide epic-level drill-down to scenario and mapped test references.
- Enforce binary trust-facing scenario status (`covered|missing`).

## Non-Goals

- Third-party security audit integration.
- Historical trend dashboards.
- Replacing Codecov or Allure native dashboards.

## Decisions

### Decision: Runtime artifact as committed site data
Use a generated JSON file (`site/_data/systemCardRuntime.json`) as the runtime
contract consumed by the system card generator. This avoids requiring
`allure-report/` during standard site rendering or trust checks.

### Decision: Binary trust-facing status model
Treat non-covered states (including legacy `pending_impl`) as `missing` when
rendering trust outputs. This removes ambiguous loophole semantics.

### Decision: Epic drill-down via native details/summary
Render each epic as a collapsible section containing scenario rows and mapped
test references. This adds transparency without overwhelming the default view.

### Decision: Freshness check in trust gate
Validate runtime artifact shape and max age in `trust:check` so stale proof
cannot silently pass trust verification.

## Risks / Trade-offs

- Freshness threshold that is too strict can increase CI churn; threshold is
  configurable via script flag and defaults to 24 hours.
- Collapsing `pending_impl` into `missing` simplifies trust semantics but loses
  distinction between TODO/skip and no-binding states on the trust page.

## Migration Plan

1. Add runtime export and runtime check scripts.
2. Update trust script wiring in `package.json`.
3. Regenerate system card with new runtime and drill-down sections.
4. Validate OpenSpec change package and trust checks.

## Open Questions

- None for this implementation scope.
