/**
 * End-to-end guard against a selections option that matches zero paragraphs (#720).
 *
 * `processMarkerlessGroup()` used to `continue` when an option's marker matched
 * nothing. For an UNSELECTED option that inverts the intent: "remove this
 * alternative" silently becomes "keep it", so the filled document ships BOTH
 * alternatives. It renders cleanly, it fills cleanly, and every existing check
 * passes — which is exactly what makes it dangerous.
 *
 * A marker only has to drift by one word for this to fire, and the markers are
 * verbatim source prose from a form that is reissued periodically, so drift is
 * expected rather than hypothetical.
 *
 * The fixtures below are built with the shared synthetic DOCX builder so the
 * alternatives sit in real clause prose rather than in isolation, and none of
 * the prose is copied from a non-redistributable source.
 */

import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { CleanConfigSchema, type FieldDefinition } from '../src/core/metadata.js';
import { runFillPipeline } from '../src/core/unified-pipeline.js';
import type { SelectionsConfig } from '../src/core/selector.js';
import {
  createSyntheticDocxFixture,
  extractDocxText,
  type RunSplit,
} from './helpers/synthetic-docx.js';

const it = itAllure.epic('FieldSelectors');

// ---------------------------------------------------------------------------
// Fixture — invented prose carrying two mutually-exclusive alternatives.
// ---------------------------------------------------------------------------

const HEADING_PARAGRAPH =
  'Dispute Resolution. This Agreement is governed by the laws of the State of [state].';

const ARBITRATION_PARAGRAPH =
  'Any dispute, claim or controversy arising out of this Agreement shall be resolved by ' +
  'binding arbitration before a single arbitrator sitting in the county in which the ' +
  'Company maintains its principal executive offices.';

const COURTS_PARAGRAPH =
  'Each party irrevocably submits to the exclusive jurisdiction of the state courts of ' +
  '[state] for the resolution of any dispute, claim or controversy arising out of this Agreement.';

const REPLACEMENTS: Record<string, string> = {
  'laws of the State of [state]': 'laws of the State of {forum_state}',
  'state courts of [state]': 'state courts of {forum_state}',
};

const FIELDS: FieldDefinition[] = [
  { name: 'forum_state', type: 'string', description: 'Forum state, as a proper noun.' },
];

const VALUES = { forum_state: 'Delaware' };

/** The prose actually in the fixture. */
const ACCURATE_ARBITRATION_MARKER = 'shall be resolved by binding arbitration before a single arbitrator';
/** One word away from it — the upstream-drift shape this guard exists to catch. */
const DRIFTED_ARBITRATION_MARKER = 'shall be resolved by arbitration before a single arbitrator';

const COURTS_MARKER = 'irrevocably submits to the exclusive jurisdiction of the state courts of';

function disputeConfig(arbitrationMarker: string): SelectionsConfig {
  return {
    groups: [{
      id: 'dispute_resolution',
      type: 'radio',
      markerless: true,
      options: [
        {
          marker: arbitrationMarker,
          trigger: { field: 'dispute_resolution_mode', equals: 'arbitration' },
        },
        { marker: COURTS_MARKER, trigger: 'default' },
      ],
    }],
  };
}

async function runFixture(
  selectionsConfig: SelectionsConfig,
  options: {
    runSplit?: RunSplit;
    paragraphs?: string[];
    values?: Record<string, unknown>;
    zeroMatchPolicy?: 'error' | 'warn';
  } = {},
) {
  const fixture = createSyntheticDocxFixture(
    options.paragraphs ?? [HEADING_PARAGRAPH, ARBITRATION_PARAGRAPH, COURTS_PARAGRAPH],
    { runSplit: options.runSplit ?? 'single', prefix: 'zero-match-guard-' },
  );
  try {
    const result = await runFillPipeline({
      inputPath: fixture.inputPath,
      outputPath: fixture.outputPath,
      values: { ...VALUES, ...options.values },
      fields: FIELDS,
      cleanPatch: { cleanConfig: CleanConfigSchema.parse({}), replacements: REPLACEMENTS },
      selectionsConfig,
      selectionsZeroMatchPolicy: options.zeroMatchPolicy,
      verify: () => ({ passed: true, checks: [] }),
    });
    return { result, text: extractDocxText(fixture.outputPath) };
  } finally {
    fixture.cleanup();
  }
}

describe('selections zero-match guard (#720)', () => {
  it('[OA-SEL-024] an accurate marker removes the unselected alternative and reports no anomaly', async () => {
    const { result, text } = await runFixture(disputeConfig(ACCURATE_ARBITRATION_MARKER));

    expect(text).not.toContain('binding arbitration');
    expect(text).toContain('the state courts of Delaware');
    expect(result.warnings).toEqual([]);
  });

  for (const runSplit of ['single', 'straddle'] as RunSplit[]) {
    it(`[OA-SEL-025] a drifted marker on the UNSELECTED alternative is reported instead of passing silently (runs: ${String(runSplit)})`, async () => {
      const { result, text } = await runFixture(disputeConfig(DRIFTED_ARBITRATION_MARKER), { runSplit });

      // The document really does carry BOTH alternatives — this is the output
      // the pre-fix code produced with `warnings: []` and no other signal.
      expect(text).toContain('binding arbitration before a single arbitrator');
      expect(text).toContain('the state courts of Delaware');

      // What changed is that it is no longer silent.
      const reported = result.warnings.filter((w) => w.includes('carries BOTH alternatives'));
      expect(reported).toHaveLength(1);
      expect(reported[0]).toContain('dispute_resolution[0]');
      expect(reported[0]).toContain('[matched 0, removed 0]');
    });

    it(`[OA-SEL-028] the same drift rejects the fill outright under the 'error' policy (runs: ${String(runSplit)})`, async () => {
      await expect(
        runFixture(disputeConfig(DRIFTED_ARBITRATION_MARKER), { runSplit, zeroMatchPolicy: 'error' }),
      ).rejects.toThrow(/unselected option\(s\) were not removed/);
      await expect(
        runFixture(disputeConfig(DRIFTED_ARBITRATION_MARKER), { runSplit, zeroMatchPolicy: 'error' }),
      ).rejects.toThrow(/dispute_resolution\[0\]/);
    });
  }

  it('[OA-SEL-026] a group that matches nothing at all warns rather than failing the fill', async () => {
    // Neither alternative is in this document, so nothing was left half-removed:
    // the group simply does not apply here. That must not block a fill, because
    // partial fixtures and variant sources legitimately produce it.
    const { result, text } = await runFixture(disputeConfig(ACCURATE_ARBITRATION_MARKER), {
      paragraphs: [HEADING_PARAGRAPH],
    });

    expect(text).toContain('the laws of the State of Delaware');
    // The unselected arbitration branch is the inert-group warning; the
    // selected courts branch is separately reported as an absent kept clause.
    expect(result.warnings.some((w) => w.includes('dispute_resolution[0]') && w.includes('does not apply'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('dispute_resolution[1]') && w.includes('meant to be kept is absent'))).toBe(true);
  });

  it('[OA-SEL-027] a SELECTED alternative that matches nothing warns that the kept clause is absent', async () => {
    // The arbitration branch is chosen, but the document only carries the courts
    // clause. The chosen alternative is missing — visible, so a warning.
    const { result } = await runFixture(disputeConfig(ACCURATE_ARBITRATION_MARKER), {
      paragraphs: [HEADING_PARAGRAPH, COURTS_PARAGRAPH],
      values: { dispute_resolution_mode: 'arbitration' },
    });

    expect(result.warnings.some((w) => w.includes('dispute_resolution[0]') && w.includes('meant to be kept is absent'))).toBe(true);
  });
});
