# COI Selections Roadmap

Research-informed field architecture for future selection sprints, based on Fenwick (2024), Cooley Q4 2025, and WSGR 2023-2025 data.

## Research-Confirmed Defaults (Implemented This Sprint)

| Feature | Market Default | Frequency | Field Type |
|---|---|---|---|
| No cumulative voting | Included | >95% | boolean — computed.json |
| Common stock voting limitation | Included | >90% | boolean — computed.json |
| Authorized shares vote opt-out | Included | >95% | boolean — computed.json |
| Officer indemnification | Included | >80% | boolean — computed.json |
| Redemption cross-ref (§6.1) | Excluded | <5% | boolean — computed.json |

## Future Sprint Priorities

### 1. Dividends Radio Selection
- 3 mutually exclusive alternatives at paragraph-block level
- Options: non-cumulative (>95%), cumulative, as-converted only
- Requires markerless selections with multi-paragraph groups
- Highest legal impact

### 2. Liquidation Preference Radio
- 3 alternatives: non-participating 1x (94-96%), participating with cap, full participating
- Also paragraph-block level, second highest impact

### 3. Protective Provisions Checkbox Group
- 10-15 individually-toggled sub-clauses
- Most complex but each is simple include/exclude
- >80% include standard set

### 4. Anti-Dilution Radio
- 2 clause blocks: broad-based weighted average (98-100%) vs full ratchet
- Clean swap between alternatives

### 5. Pay-to-Play + Redemption
- Optional sections (entire articles)
- Pay-to-Play: <5% of deals
- Redemption: 2-5% of deals
- Can use markerless selection to remove entire articles

## Architecture Notes

- Paragraph-block selections (dividends, liquidation) need markerless groups with multi-paragraph scope
- Protective provisions need per-clause checkbox groups within a single section
- Anti-dilution is a clean 2-option radio swap
- Pay-to-Play and Redemption are article-level toggles (simplest selection type)
