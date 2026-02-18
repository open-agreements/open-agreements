import { describe, expect } from 'vitest';
import {
  buildComputedArtifact,
  ComputedProfileSchema,
  evaluateComputedProfile,
} from '../src/core/recipe/computed.js';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const itVerification = itAllure.epic('Verification & Drift');

describe('computed profile evaluator', () => {
  itVerification.openspec('OA-062')('evaluates dispute-resolution interaction rules deterministically across bounded passes', async () => {
    const profile = ComputedProfileSchema.parse({
      version: '1.0',
      max_passes: 4,
      rules: [
        {
          id: 'derive-dispute-track-courts',
          when_all: [{ field: 'dispute_resolution_mode', op: 'eq', value: 'courts' }],
          set_audit: { dispute_resolution_track: 'courts' },
        },
        {
          id: 'derive-judicial-district-default-california',
          when_all: [
            { field: 'dispute_resolution_track', op: 'eq', value: 'courts' },
            { field: 'state_lower', op: 'eq', value: 'california' },
            { field: 'judicial_district', op: 'falsy' },
          ],
          set_fill: { judicial_district: 'Northern District of California' },
        },
        {
          id: 'derive-governing-law-baseline',
          set_audit: { governing_law_state: 'delaware' },
        },
        {
          id: 'derive-forum-governing-mismatch',
          when_all: [
            { field: 'dispute_resolution_track', op: 'eq', value: 'courts' },
            { field: 'state_lower', op: 'neq', value: 'delaware' },
          ],
          set_audit: { forum_governing_law_alignment: 'mismatch' },
        },
      ],
    });

    const inputValues = {
      company_name: 'Acme Corp',
      dispute_resolution_mode: 'courts',
      state_lower: 'california',
    };

    const result = await allureStep('Evaluate computed profile', () =>
      evaluateComputedProfile(profile, inputValues)
    );

    const artifact = buildComputedArtifact({
      recipeId: 'fixture-recipe',
      inputValues,
      evaluated: result,
      profileVersion: profile.version,
    });

    await allureJsonAttachment('computed-profile-evaluation.json', {
      result,
      artifact,
    });

    expect(result.fillValues.company_name).toBe('Acme Corp');
    expect(result.fillValues.judicial_district).toBe('Northern District of California');
    expect(result.auditValues).toMatchObject({
      dispute_resolution_track: 'courts',
      governing_law_state: 'delaware',
      forum_governing_law_alignment: 'mismatch',
    });
    expect(result.stabilized).toBe(true);
    expect(result.passes.length).toBeGreaterThanOrEqual(1);
    expect(result.passes[0].rules.map((r) => r.rule_id)).toEqual([
      'derive-dispute-track-courts',
      'derive-judicial-district-default-california',
      'derive-governing-law-baseline',
      'derive-forum-governing-mismatch',
    ]);
  });
});
