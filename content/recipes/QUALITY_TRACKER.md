# NVCA Recipe Quality Tracker

Tracks quality audit scores and maturity tiers for all 7 NVCA recipes.
Updated by the `recipe-quality-audit` skill after each audit.

## Scorecard

| Recipe | S | B | F | Total | Tier | Fixture | Last Audit |
|--------|---|---|---|-------|------|---------|------------|
| nvca-stock-purchase-agreement | 7/7 | 4/4 | 4/4 | 15/15 | production | spa-*.json | 2026-03-15 |
| nvca-certificate-of-incorporation | 6/7 | 3/4 | 2/4 | 11/15 | beta | coi-imim-series-c.json | 2026-03-15 |
| nvca-investors-rights-agreement | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |
| nvca-voting-agreement | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |
| nvca-rofr-co-sale-agreement | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |
| nvca-indemnification-agreement | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |
| nvca-management-rights-letter | ?/7 | ?/4 | ?/4 | ?/15 | beta | — | — |

## Priority Order

Based on legal impact in a typical Series A:

1. ~~SPA~~ (done — production)
2. **COI** — defines share structure, liquidation preferences, anti-dilution
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
