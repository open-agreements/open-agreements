/**
 * Synthetic clause-SHAPE rendering contracts (#721).
 *
 * open-agreements#707 added assertions for two real rendering defects found in a
 * clean-room fill — a doubled `District of Northern District of California` and
 * a lower-cased `state courts of california`. Those assertions live under
 * `describeWithCoiSource` / `describeWithSource` in `selector-contracts.test.ts`,
 * which resolve to `describe.skip` unless a cached NVCA source is on disk. The
 * source is non-redistributable, so it is never on a CI runner and both
 * regressions were effectively unguarded.
 *
 * The pre-existing synthetic builder could not cover them either: it emits every
 * placeholder ALONE in its own paragraph, and both defects are properties of the
 * literal text AROUND the placeholder.
 *
 * This file closes that gap with fixtures built from `helpers/synthetic-docx.ts`,
 * which takes real paragraph prose with embedded placeholders. Everything here
 * runs on every CI job. The source-gated assertions stay in place as the
 * higher-fidelity check when a cached source exists; these are additive.
 *
 * ## The prose is paraphrased on purpose
 *
 * The NVCA forms are non-redistributable. Not one sentence below is copied from
 * them. Each is an invented, equivalent-SHAPED sentence that exercises the same
 * binding mechanics: a shared literal prefix across two adjacent bracketed
 * alternatives, a context-anchored key, and a proper noun that has to survive
 * substitution.
 *
 * ## Why these tests are load-bearing
 *
 * Each shape is asserted twice: once against the CORRECTED binding map (the
 * shape upstream legal-explainer#2394 landed) and once against the LEGACY map
 * that produced the defect. The legacy run asserts the defect REPRODUCES. A
 * fixture that cannot produce the bug cannot guard against its return, so that
 * proof is checked in rather than performed by hand once.
 */

import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { CleanConfigSchema, type FieldDefinition } from '../src/core/metadata.js';
import { runFillPipeline } from '../src/core/unified-pipeline.js';
import {
  ALL_RUN_SPLITS,
  countOccurrences,
  createSyntheticDocxFixture,
  extractDocxText,
  runSplitLabel,
  type RunSplit,
} from './helpers/synthetic-docx.js';

const it = itAllure.epic('FieldSelectors');

// ---------------------------------------------------------------------------
// Fixture prose — invented, NOT NVCA text. Shape-equivalent only.
// ---------------------------------------------------------------------------

/**
 * Forum-selection clause. Carries two of the three shapes at once:
 *
 *  - a proper noun (`[state]`) inside a lower-case carrier phrase
 *    ("…the state courts of [state]…"), which must render `California`, not
 *    `california`;
 *  - two ADJACENT bracketed alternatives that share the literal prefix
 *    "District Court for the District of ", each of which must bind to its own
 *    key and must absorb that prefix so a full district value does not double
 *    it into "District of Northern District of California".
 */
const FORUM_PARAGRAPH =
  'Governing Law and Forum. This Agreement is governed by the laws of the State of [state], ' +
  'without regard to its conflict of laws principles. Each party irrevocably submits to the ' +
  'exclusive jurisdiction of the state courts of [state] and, for any action that may properly ' +
  'be brought in a federal forum, [to the U.S. District Court for the District of [_____]] ' +
  '[to the United States District Court for the District of [judicial district]], in each case ' +
  'sitting in that state.';

/**
 * Price-adjustment clause. Carries the third shape: a context-absorbing key
 * (`"[or decrease] > [specify percentage]"`) that has to claim the SECOND of two
 * identical placeholders without re-emitting — and so doubling — the `[or
 * decrease]` literal it anchors on. A plain simple key then sweeps the first.
 */
const ADJUSTMENT_PARAGRAPH =
  'Price Adjustment. No adjustment shall be made for any change of less than [specify percentage]. ' +
  'The per share purchase price shall be proportionately adjusted for any increase [or decrease] ' +
  'in the number of outstanding shares of [specify percentage] or more effected after the date of ' +
  'this Agreement.';

const FIXTURE_PARAGRAPHS = [FORUM_PARAGRAPH, ADJUSTMENT_PARAGRAPH];

// ---------------------------------------------------------------------------
// Binding maps
// ---------------------------------------------------------------------------

/**
 * The corrected binding shape. Each key absorbs exactly the literal that its
 * value re-emits, and the forum state binds to the proper-noun field.
 */
const CORRECTED_REPLACEMENTS: Record<string, string> = {
  'laws of the State of [state]': 'laws of the State of {forum_state}',
  'state courts of [state]': 'state courts of {forum_state}',
  'U.S. District Court for the District of [_____]': 'U.S. District Court for the {judicial_district}',
  'District Court for the District of [judicial district]': 'District Court for the {judicial_district}',
  '[or decrease] > [specify percentage]': '{adjustment_threshold}',
  '[specify percentage]': '{de_minimis_threshold}',
};

/**
 * The binding shape BEFORE the upstream fix. Two defects, both invisible to a
 * fixture that isolates its placeholders:
 *
 *  - `[state]` binds to the lower-cased audit field, so the proper noun is lost;
 *  - `[judicial district]` binds bare, leaving the literal `District of ` in
 *    front of a value that already begins with `Northern District of`.
 */
const LEGACY_REPLACEMENTS: Record<string, string> = {
  'laws of the State of [state]': 'laws of the State of {forum_state}',
  'state courts of [state]': 'state courts of {forum_state_lower}',
  '[_____]': '{judicial_district}',
  '[judicial district]': '{judicial_district}',
  '[or decrease] > [specify percentage]': '{adjustment_threshold}',
  '[specify percentage]': '{de_minimis_threshold}',
};

const FIELDS: FieldDefinition[] = [
  { name: 'forum_state', type: 'string', description: 'Forum state, as a proper noun.' },
  { name: 'forum_state_lower', type: 'string', description: 'Lower-cased forum state (audit input).' },
  { name: 'judicial_district', type: 'string', description: 'Federal judicial district, full name.' },
  { name: 'adjustment_threshold', type: 'string', description: 'Adjustment trigger threshold.' },
  { name: 'de_minimis_threshold', type: 'string', description: 'De minimis change threshold.' },
];

const VALUES = {
  forum_state: 'California',
  forum_state_lower: 'california',
  judicial_district: 'Northern District of California',
  adjustment_threshold: 'five percent (5%)',
  de_minimis_threshold: 'one percent (1%)',
};

/**
 * Build the fixture at the given run split, push it through the real
 * clean → patch → fill pipeline, and return the rendered text.
 */
async function renderFixture(
  replacements: Record<string, string>,
  runSplit: RunSplit,
): Promise<string> {
  const fixture = createSyntheticDocxFixture(FIXTURE_PARAGRAPHS, {
    runSplit,
    prefix: 'clause-shape-',
  });
  try {
    await runFillPipeline({
      inputPath: fixture.inputPath,
      outputPath: fixture.outputPath,
      values: VALUES,
      fields: FIELDS,
      cleanPatch: { cleanConfig: CleanConfigSchema.parse({}), replacements },
      verify: () => ({ passed: true, checks: [] }),
    });
    return extractDocxText(fixture.outputPath);
  } finally {
    fixture.cleanup();
  }
}

// ---------------------------------------------------------------------------
// The corrected binding shape renders correctly — at every run split.
// ---------------------------------------------------------------------------

describe('synthetic clause-shape rendering contracts (#721)', () => {
  for (const runSplit of ALL_RUN_SPLITS) {
    const label = runSplitLabel(runSplit);

    it(`[OA-SEL-030] a proper noun survives substitution into a lower-case carrier phrase (runs: ${label})`, async () => {
      const text = await renderFixture(CORRECTED_REPLACEMENTS, runSplit);

      expect(text).toContain('the state courts of California');
      expect(text).not.toContain('state courts of california');
      expect(text).toContain('the laws of the State of California');
      expect(text).not.toContain('[state]');
    });

    it(`[OA-SEL-031] two adjacent alternatives sharing a literal prefix each absorb it exactly once (runs: ${label})`, async () => {
      const text = await renderFixture(CORRECTED_REPLACEMENTS, runSplit);

      // Both alternatives render their own full district name…
      expect(text).toContain('U.S. District Court for the Northern District of California');
      expect(text).toContain('United States District Court for the Northern District of California');
      // …and neither doubles the shared `District of` prefix.
      expect(text).not.toContain('District of Northern District');
      expect(countOccurrences(text, 'Northern District of California')).toBe(2);
      expect(countOccurrences(text, 'District of Northern District of California')).toBe(0);
      // No source placeholder survives either alternative.
      expect(text).not.toContain('[_____]');
      expect(text).not.toContain('[judicial district]');
    });

    it(`[OA-SEL-032] a context-anchored key claims the right occurrence without doubling its anchor literal (runs: ${label})`, async () => {
      const text = await renderFixture(CORRECTED_REPLACEMENTS, runSplit);

      // The context key claimed the occurrence AFTER `[or decrease]`; the simple
      // key swept the one before it. Neither claimed the other's target.
      expect(text).toContain('any change of less than one percent (1%)');
      expect(text).toContain('outstanding shares of five percent (5%) or more');
      // The anchor literal is still present exactly once — it is absorbed for
      // matching, not re-emitted alongside the value.
      expect(countOccurrences(text, '[or decrease]')).toBe(1);
      expect(text).not.toContain('[specify percentage]');
    });
  }
});

// ---------------------------------------------------------------------------
// The fixture is load-bearing: the legacy binding shape still reproduces the
// defects. A regression test that passes against the unfixed code is worthless,
// so this proof is checked in rather than run by hand once.
// ---------------------------------------------------------------------------

describe('the synthetic fixture reproduces the pre-fix defect shape (#721)', () => {
  it('[OA-SEL-033] the legacy `[state]` binding renders the lower-cased forum state the fixture must catch', async () => {
    const text = await renderFixture(LEGACY_REPLACEMENTS, 'single');

    expect(text).toContain('state courts of california');
    expect(text).not.toContain('the state courts of California');
  });

  it('[OA-SEL-034] the legacy bare `[judicial district]` binding doubles the shared `District of` prefix', async () => {
    const text = await renderFixture(LEGACY_REPLACEMENTS, 'single');

    expect(text).toContain('District of Northern District of California');
    expect(countOccurrences(text, 'District of Northern District of California')).toBeGreaterThan(0);
  });

  it('[OA-SEL-035] the defect also reproduces when the placeholder straddles runs', async () => {
    const text = await renderFixture(LEGACY_REPLACEMENTS, 'straddle');

    expect(text).toContain('state courts of california');
    expect(text).toContain('District of Northern District of California');
  });
});
