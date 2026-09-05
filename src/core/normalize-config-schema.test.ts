import { describe, expect, it } from 'vitest';
import { NormalizeConfigSchema } from './metadata.js';

const rule = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  section_heading: '',
  ignore_heading: true,
  paragraph_contains: id,
  ...overrides,
});

describe('NormalizeConfigSchema staged source-drift declarations', () => {
  it('accepts an ordered post-transform dependency graph with fail-closed bounds', () => {
    expect(() => NormalizeConfigSchema.parse({ paragraph_rules: [
      rule('first', { expected_min_matches: 1, expected_max_matches: 1, source_drift: { stage: 'post_transform', prerequisites: ['clean'] } }),
      rule('second', { expected_min_matches: 1, expected_max_matches: 2, source_drift: { stage: 'post_transform', prerequisites: ['rule:first'] } }),
    ] })).not.toThrow();
  });

  it.each([
    ['missing prerequisite', { stage: 'post_transform', prerequisites: [] }],
    ['unknown stage', { stage: 'after_magic', prerequisites: ['clean'] }],
    ['unknown prerequisite', { stage: 'post_transform', prerequisites: ['magic'] }],
  ])('rejects %s', (_label, source_drift) => {
    expect(() => NormalizeConfigSchema.parse({ paragraph_rules: [
      rule('post', { expected_min_matches: 1, expected_max_matches: 1, source_drift }),
    ] })).toThrow();
  });

  it('rejects missing runtime bounds and inverted bounds', () => {
    expect(() => NormalizeConfigSchema.parse({ paragraph_rules: [
      rule('unbounded', { source_drift: { stage: 'post_transform', prerequisites: ['fill'] } }),
    ] })).toThrow(/expected_min_matches and expected_max_matches/);
    expect(() => NormalizeConfigSchema.parse({ paragraph_rules: [
      rule('inverted', { expected_min_matches: 2, expected_max_matches: 1, source_drift: { stage: 'post_transform', prerequisites: ['fill'] } }),
    ] })).toThrow(/greater than or equal/);
  });

  it('rejects duplicate ids as ambiguous', () => {
    expect(() => NormalizeConfigSchema.parse({ paragraph_rules: [rule('same'), rule('same')] })).toThrow(/duplicate normalize rule id/);
  });

  it('rejects forward dependencies and cycles', () => {
    expect(() => NormalizeConfigSchema.parse({ paragraph_rules: [
      rule('first', { expected_min_matches: 1, expected_max_matches: 1, source_drift: { stage: 'post_transform', prerequisites: ['rule:second'] } }),
      rule('second', { expected_min_matches: 1, expected_max_matches: 1, source_drift: { stage: 'post_transform', prerequisites: ['rule:first'] } }),
    ] })).toThrow(/must precede|cycle/);
  });
});
