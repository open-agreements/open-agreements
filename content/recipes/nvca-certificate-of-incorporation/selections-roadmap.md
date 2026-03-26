# COI Selections Roadmap

Research-informed field architecture for future selection sprints, based on Fenwick (2024), Cooley Q4 2025, and WSGR 2023-2025 data.

## Implemented

| Feature | Market Default | Frequency | Implementation |
|---|---|---|---|
| No cumulative voting | Included | >95% | boolean — computed.json |
| Common stock voting limitation | Included | >90% | boolean — computed.json |
| Authorized shares vote opt-out | Included | >95% | boolean — computed.json |
| Officer indemnification | Included | >80% | boolean — computed.json |
| Redemption cross-ref (§6.1) | Excluded | <5% | boolean — computed.json |
| Dividends (3-option radio) | Non-cumulative as-converted | >95% | selections.json — `dividends` group |
| Liquidation §2.1 (2-option radio) | Non-participating | 94-96% | selections.json — `liquidation_section_2_1` group |
| Liquidation §2.2 (2-option radio) | Non-participating | 94-96% | selections.json — `liquidation_section_2_2` group |
| Anti-dilution (2-option radio) | Broad-based weighted avg | >98% | selections.json — `anti_dilution` group |
| Pay-to-play (checkbox toggle) | Excluded | <5% | selections.json — `pay_to_play` group |
| Redemption (checkbox toggle) | Excluded | 2-5% | selections.json — `redemption_provisions` group |

## Future Sprint Priorities

### 1. Protective Provisions Checkbox Group
- 10-15 individually-toggled sub-clauses
- Most complex but each is simple include/exclude
- >80% include standard set

### 2. Deemed Liquidation Event Fields
- Additional fields within Section 2.3

### 3. QPO/Mandatory Conversion Threshold Fields
- Qualified public offering threshold parameters

### 4. Capped Participating Liquidation Preference Variant
- Third liquidation option: participating with cap
- Would extend `liquidation_section_2_1` and `liquidation_section_2_2` groups

## Architecture Notes

- Paragraph-block selections (dividends, liquidation) use markerless groups with multi-paragraph scope
- Liquidation uses two paired radio groups (§2.1 and §2.2) with explicit `subClauseStopPatterns`
- Protective provisions need per-clause checkbox groups within a single section
- Pay-to-Play and Redemption are article-level toggles (simplest selection type)
- Redemption inline bracket text handled via computed.json + replacements.json
