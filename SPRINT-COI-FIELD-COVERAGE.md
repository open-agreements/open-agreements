# Sprint: NVCA COI Field Coverage — Close the Remaining 33 Bracket Gaps

**Date**: 2026-03-26
**Recipe**: `content/recipes/nvca-certificate-of-incorporation/`
**Current version**: 0.6.0 (just released)
**Branch strategy**: Use a worktree (`git worktree add`) to avoid conflicting with the Concerto integration spike on the main working tree.

---

## Where We Are

### Scorecard (post-0.6.0, run on `main`)
```
Score: 13/15 (beta) — continuous: 14.134/15
  Structural: 7/7
  Behavioral: 4/4
  Fill:       2/4

Key metrics:
  B2 Coverage ratio: 88/121 bracket patterns covered (72.7%)
  S3 Field coverage: 39/43 metadata fields referenced in replacements/computed
  F1 Default fill: FAIL — "Context values present" + "Leftover source placeholders"
  F2 Full fill: FAIL — same issues + missing context values for selection fields
```

### What Was Done in v0.6.0
- **6 selection groups** added (dividends 3-way, liquidation 2x2-way, anti-dilution 2-way, pay-to-play checkbox, redemption checkbox)
- **5 new metadata fields** (dividend_type, liquidation_participation, anti_dilution_type, include_pay_to_play, include_redemption)
- **3 computed rules** for redemption inline text and cross-ref forcing
- **Bold formatting fix** for Series designation replacement
- **100 replacement keys** total

### What's Left: 33 Uncovered Bracket Patterns
The B2 check reports 88/121 bracket patterns covered. The remaining 33 are bracket occurrences in the source DOCX that have no matching replacement key. These are the sprint target.

### F1/F2 Failures to Fix
1. **"Context values present"** — The verifier checks that field values appear in the filled output. Selection-only fields (`dividend_type`, `liquidation_participation`, `anti_dilution_type`, `include_pay_to_play`) don't map to text replacements, so their string values never appear in the document. The S3 check also flags these 4 fields as "uncovered". Fix: either add these fields to a computed rule's `set_audit` (which exempts them from context checks), or adjust the verifier/grader to recognize selection-trigger fields.
2. **"Leftover source placeholders"** — Two items flagged:
   - `[_________]` — A genuine uncovered placeholder (long underscore fill-in-the-blank). Needs a replacement mapping.
   - `A Preferred Stock` — **False positive**. This is the search text from the split designation replacement. When `series_designation = "A"`, the filled text equals the search text, triggering the leftover check. Not a real issue.
3. **"dividend_formula_alt" context value missing** — The verifier expects `"the sum of"` to appear in the output, but this text only appears in the cumulative dividend alternative (which is removed when the default as-converted dividend is selected). Fix: either exempt this from context checks when the cumulative alternative is not selected, or ensure the fixture's `dividend_formula_alt` value appears somewhere else.

---

## Architecture: Metadata → Computed → Flat Fill → Replace

The pipeline is: **metadata fields** (user-facing inputs) → **computed.json** (conditional logic producing flat key-value pairs) → **replacements.json** (maps source text to fill values).

### Key Design Principle
Rather than exposing every single bracket as a separate field to the AI, group related brackets under **one metadata field** that flows through computed logic to produce multiple fill values. Example:

```
metadata: include_redemption (boolean)
  → computed rule: no-redemption-statement-include → sets no_redemption_clause = "Other than..."
  → computed rule: no-redemption-statement-exclude → sets no_redemption_clause = ""
  → computed rule: redemption-cross-ref-force-off → sets redemption_cross_ref_clause = ""
  → replacement: "Redemption. > [...]" → {no_redemption_clause}
```

One user toggle (`include_redemption`) drives 3 computed rules and 1+ replacement targets.

### Grammar/Plural Computed Patterns (Emerging)
The SPA recipe recently introduced subject-verb agreement via computed fields. Example pattern:

```json
{
  "id": "purchaser-plural-verb",
  "when_all": [{ "field": "purchaser_count", "op": "eq", "value": "plural" }],
  "set_fill": { "purchaser_verb_agrees": "agree", "purchaser_pronoun": "their" }
}
```

Apply this pattern in the COI where singular/plural or conditional grammar affects bracket text. The COI has several `[director[s]]` and `[a majority[, by voting power,]]` style brackets that need conditional grammar.

### Computed Engine Capabilities
File: `src/core/recipe/computed.ts` (326 lines)
- Multi-pass (max 4 passes, stabilization detection)
- Predicates: `eq`, `neq`, `in`, `truthy`, `falsy`, `defined`
- Conditional: `when_all` (AND), `when_any` (OR)
- Field interpolation: `${field_name}` in set_fill values
- Dual output: `set_fill` (document values) and `set_audit` (verification metadata)

---

## The 15-Point Scorecard

Run with: `npx tsx scripts/lib/recipe-grader.ts nvca-certificate-of-incorporation`

| Check | Current | Target | Notes |
|-------|---------|--------|-------|
| S1 File inventory | PASS | PASS | |
| S2 Metadata valid | PASS | PASS | |
| S3 Field coverage | PASS (39/43) | PASS (43/43) | Fix 4 selection-only fields |
| S4 Ambiguous keys | PASS | PASS | |
| S5 Smart quotes | PASS | PASS | |
| S6 Source SHA | PASS | PASS | |
| S7 Test fixture | PASS (4) | PASS | |
| B1 Source scan | PASS (31) | PASS | |
| B2 Coverage ratio | PASS (72.7%) | ≥85% | Close 15+ of 33 gaps |
| B3 Unmatched underscores | PASS | PASS | |
| B4 Clean effectiveness | PASS | PASS | |
| F1 Default fill | **FAIL** | PASS | Fix verifier issues |
| F2 Full fill | **FAIL** | PASS | Fix verifier issues |
| F3 Formatting anomalies | PASS | PASS | |
| F4 Zero-match keys | PASS | PASS | |

**Goal: 15/15 with continuous ≥ 14.8**

---

## Sprint Plan

### Phase 1: Fix Verifier Failures (F1/F2) — Score 13→15

1. **Add `set_audit` for selection-trigger fields** in computed.json so S3 and F1/F2 context checks pass:
   ```json
   {
     "id": "selection-audit-fields",
     "when_all": [{ "field": "dividend_type", "op": "defined" }],
     "set_audit": {
       "dividend_type_audit": "${dividend_type}",
       "liquidation_participation_audit": "${liquidation_participation}",
       "anti_dilution_type_audit": "${anti_dilution_type}"
     }
   }
   ```

2. **Map `[_________]` placeholder** — Find the remaining long-underscore bracket in the source, determine what field it represents, and add a replacement.

3. **Fix `dividend_formula_alt` context issue** — Ensure fixture values that are conditionally absent don't trigger false failures.

### Phase 2: Close Bracket Gaps — B2 72.7% → 85%+

Run the hardening loop with Codex to discover and map the remaining 33 uncovered bracket patterns. The loop:
1. Scans the source DOCX for all `[...]` bracket patterns
2. Cross-references against replacement keys
3. For each uncovered pattern, determines the appropriate metadata field
4. Adds replacement keys (with context `>` syntax for disambiguation)
5. Adds metadata fields if needed
6. Adds computed rules for conditional patterns

**Strategy for the 33 gaps**:
- Many will be simple bracket→field mappings (e.g., `[Date]` → `{effective_date}`)
- Some will be duplicates of the same placeholder in different contexts (need `>` disambiguation)
- Some will be conditional brackets needing computed rules (e.g., `[director[s]]`)
- Some may be inside selection-removed paragraphs and only need coverage in the non-default path

### Phase 3: Grammar/Plural Computed Fields

Add computed rules for:
- `[director[s]]` — singular/plural based on `preferred_director_seats`
- `[a majority[, by voting power,]]` — optional voting power qualifier
- Other conditional grammar patterns discovered during bracket gap analysis

### Phase 4: Fix Selector Bookmark Orphaning Bug

**Priority**: HIGH — affects safe-docx redline comparison (causes rebuild fallback).

The selector's `processMarkerlessGroup` in `src/core/selector.ts` removes `<w:p>` elements for unselected alternatives, but doesn't clean up bookmark cross-references. When a removed paragraph contains a `<w:bookmarkStart>` whose matching `<w:bookmarkEnd>` is in a surviving paragraph (or vice versa), the result is orphaned bookmarks.

**Concrete evidence** (traced through pipeline stages):
- Pre-select: 357 starts, 357 ends (balanced)
- Post-select: 290 starts, 292 ends (2 orphaned ends)
- Orphaned bookmark IDs:
  - **107** (`_Ref_ContractCompanion_9kb9Ur04C`) — `bookmarkStart` was in participating liquidation 2.1 paragraph, removed by `liquidation_section_2_1` group
  - **368** (`_cp_text_1_150`) — `bookmarkStart` was in redemption "Interest" paragraph, removed by `redemption_provisions` group

**Fix**: After removing a paragraph in the selector, scan the removed element for `bookmarkStart`/`bookmarkEnd` elements. For each, find and remove the matching counterpart in the document. Add a helper like `cleanupOrphanedBookmarks(doc, removedElements)`.

**Test**: Assert bookmark balance in the post-select output: `bookmarkStart` count === `bookmarkEnd` count, and every start ID has a matching end ID.

### Phase 5: Protective Provisions Selection Group (Stretch)

The selections-roadmap.md lists this as the next selection group:
- 10-15 individually-toggled sub-clauses within protective provisions section
- Each is a simple include/exclude checkbox
- >80% of deals include the standard set

---

## Hardening Loop Configuration

The overnight hardening script is at `scripts/overnight-hardening.ts`. Key settings:
- **Max loops**: 20 per recipe
- **Stall limit**: 7 consecutive no-improvement iterations
- **Pareto protection**: Any regression on any check triggers revert
- **Edit policy**: Only recipe config files + fixtures + journal
- **Codex invocation**: `codex exec --full-auto` with 10-minute timeout

To run manually:
```bash
npx tsx scripts/overnight-hardening.ts --recipe nvca-certificate-of-incorporation --max-loops 10
```

Or run the grader standalone:
```bash
npx tsx scripts/lib/recipe-grader.ts nvca-certificate-of-incorporation
```

---

## Files to Modify

| File | Action |
|------|--------|
| `content/recipes/nvca-certificate-of-incorporation/metadata.yaml` | Add new fields for uncovered brackets |
| `content/recipes/nvca-certificate-of-incorporation/replacements.json` | Add replacement keys for 33 gaps |
| `content/recipes/nvca-certificate-of-incorporation/computed.json` | Add grammar/plural rules + selection audit fields |
| `integration-tests/fixtures/certificate-of-incorporation-series-c.json` | Add values for new fields |
| `integration-tests/fixtures/coi-imim-series-c.json` | Add values for new fields |

---

## Important Context

- **Use a worktree**: `git worktree add .claude/worktrees/coi-coverage feat/coi-coverage` — the main working tree has a Concerto integration spike in progress
- **Concerto is separate**: Don't touch `concerto/`, `src/core/concerto-bridge.ts`, or `scripts/generate_concerto_types.mjs`
- **Always use `>` context syntax** for replacement keys, even when the placeholder seems unique (per project convention)
- **Run the grader after each batch** to measure progress deterministically
- **Reproduce bugs before fixing** — replicate any issue with a minimal example before implementing
- **`@usejunior/docx-core`** handles all OOXML operations — never reimplement run/text/formatting manipulation
- **Computed fields are the lever** — prefer one metadata field + computed logic over many individual fill fields
- **B2 coverage carries ~5x weight** in the scorecard for bracket coverage — prioritize it
