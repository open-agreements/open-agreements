# NVCA Field-selector Quality Tracker

Tracks quality audit scores and maturity tiers for all 7 NVCA field-selectors.
Updated by the `field-selector-quality-audit` skill after each audit.

## Scorecard

| Field-selector | S | B | F | Total | Tier | Fixture | Last Audit |
|--------|---|---|---|-------|------|---------|------------|
| nvca-stock-purchase-agreement | 7/7 | 4/4 | 4/4 | 15/15 | beta | spa-production-full.json | 2026-09-02 |
| nvca-certificate-of-incorporation | 7/7 | 4/4 | 4/4 | 15/15 | production | coi-production-full.json | 2026-09-01 |
| nvca-investors-rights-agreement | 7/7 | 2/4 | 4/4 | 13/15 | beta | ira-production-full.json | 2026-09-02 |
| nvca-voting-agreement | 7/7 | 2/4 | 4/4 | 13/15 | beta | voting-agreement-production-full.json | 2026-09-02 |
| nvca-rofr-co-sale-agreement | 7/7 | 2/4 | 4/4 | 13/15 | beta | rofr-co-sale-agreement-series-c.json | 2026-09-02 |
| nvca-indemnification-agreement | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |
| nvca-management-rights-letter | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |

## Priority Order

Based on legal impact in a typical Series A:

1. **SPA** — re-audit and restore production after the corrected grader exposed stale coverage and missing fixtures
2. ~~COI~~ (done — production)
3. IRA — information rights, registration rights, board observer
4. VA — drag-along, voting provisions, board composition
5. ROFR — transfer restrictions, co-sale rights
6. Indemnification — director/officer protection
7. MRL — management rights (simplest document)

## Score Key

- **S** = Structural checks (7 total): file inventory, metadata schema, field coverage, ambiguous keys, smart quotes, source SHA, test fixture
- **B** = Behavioral checks (4 total): source scan, replacement coverage ratio, unmatched underscores, clean effectiveness
- **F** = Fill checks (4 total): default-only fill, full-values fill, formatting anomalies, zero-match keys
- **Tier**: scaffold → beta → production
