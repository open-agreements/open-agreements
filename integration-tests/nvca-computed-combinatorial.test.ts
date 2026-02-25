import { describe, expect } from 'vitest';
import { join } from 'node:path';
import {
  evaluateComputedProfile,
  loadComputedProfile,
  type ComputedValueMap,
  type EvaluatedComputedProfile,
} from '../src/core/recipe/computed.js';
import {
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

type FactorValue = string;
type FactorDomains = Record<string, FactorValue[]>;
type FactorCase = Record<string, FactorValue>;

const RECIPE_ID = 'nvca-stock-purchase-agreement';
const RECIPE_DIR = join(import.meta.dirname, '..', 'content', 'recipes', RECIPE_ID);
const profile = loadComputedProfile(RECIPE_DIR);
if (!profile) {
  throw new Error(`Expected computed.json for ${RECIPE_ID}`);
}

const itVerification = itAllure.withLabels({
  epic: 'NVCA SPA Template',
  feature: 'NVCA SPA Computed Coverage',
  suite: 'Computed Interaction Strategy',
  subSuite: 'Verification & Drift',
});

const ARBITRATION_LOCATION_DEFAULT = 'San Francisco, California';
const DISTRICT_DEFAULTS: Record<string, string> = {
  california: 'Northern District of California',
  delaware: 'District of Delaware',
  'new york': 'Southern District of New York',
};

const FACTOR_DOMAINS: FactorDomains = {
  dispute_resolution_mode: ['arbitration', 'courts'],
  state_lower: ['california', 'delaware', 'new york'],
  judicial_district_input: ['', 'Northern District of California', 'District of Delaware'],
  arbitration_location_input: ['', 'Austin, Texas', 'Wilmington, Delaware'],
};

function toInput(caseConfig: FactorCase): ComputedValueMap {
  const input: ComputedValueMap = {
    company_name: 'Acme Robotics, Inc.',
    dispute_resolution_mode: caseConfig.dispute_resolution_mode,
    state_lower: caseConfig.state_lower,
  };

  const district = caseConfig.judicial_district_input;
  if (district !== '') {
    input.judicial_district = district;
  }

  const arbitrationLocation = caseConfig.arbitration_location_input;
  if (arbitrationLocation !== '') {
    input.arbitration_location = arbitrationLocation;
  }

  return input;
}

function evaluateCase(caseConfig: FactorCase): EvaluatedComputedProfile {
  return evaluateComputedProfile(profile, toInput(caseConfig));
}

function assertCoreInvariants(caseConfig: FactorCase, evaluated: EvaluatedComputedProfile): void {
  const mode = caseConfig.dispute_resolution_mode;
  const state = caseConfig.state_lower;
  const districtInput = caseConfig.judicial_district_input;
  const arbitrationLocationInput = caseConfig.arbitration_location_input;

  const audit = evaluated.auditValues;
  const fill = evaluated.fillValues;

  expect(audit.governing_law_state).toBe('delaware');

  if (mode === 'courts') {
    expect(audit.dispute_resolution_track).toBe('courts');
    expect(audit.forum_governing_law_alignment).toBe(state === 'delaware' ? 'aligned' : 'mismatch');

    if (districtInput === '') {
      expect(fill.judicial_district).toBe(DISTRICT_DEFAULTS[state]);
    } else {
      expect(fill.judicial_district).toBe(districtInput);
    }
    return;
  }

  expect(audit.dispute_resolution_track).toBe('arbitration');
  expect(audit.forum_governing_law_alignment).toBe('n/a-arbitration');

  if (arbitrationLocationInput === '') {
    expect(fill.arbitration_location).toBe(ARBITRATION_LOCATION_DEFAULT);
  } else {
    expect(fill.arbitration_location).toBe(arbitrationLocationInput);
  }
}

function valueToken(value: FactorValue): string {
  if (value === '') return '<empty>';
  return String(value);
}

function pairToken(aName: string, aValue: FactorValue, bName: string, bValue: FactorValue): string {
  return `${aName}=${valueToken(aValue)}|${bName}=${valueToken(bValue)}`;
}

function enumerateCases(domains: FactorDomains): FactorCase[] {
  const entries = Object.entries(domains);
  const cases: FactorCase[] = [];

  function recurse(index: number, current: FactorCase): void {
    if (index >= entries.length) {
      cases.push({ ...current });
      return;
    }

    const [factorName, values] = entries[index];
    for (const value of values) {
      current[factorName] = value;
      recurse(index + 1, current);
    }
  }

  recurse(0, {});
  return cases;
}

function enumerateRequiredPairs(domains: FactorDomains): Set<string> {
  const names = Object.keys(domains);
  const required = new Set<string>();

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const aName = names[i];
      const bName = names[j];
      for (const aValue of domains[aName]) {
        for (const bValue of domains[bName]) {
          required.add(pairToken(aName, aValue, bName, bValue));
        }
      }
    }
  }

  return required;
}

function coveredPairs(caseConfig: FactorCase, factorNames: string[]): Set<string> {
  const covered = new Set<string>();
  for (let i = 0; i < factorNames.length; i += 1) {
    for (let j = i + 1; j < factorNames.length; j += 1) {
      const aName = factorNames[i];
      const bName = factorNames[j];
      covered.add(pairToken(aName, caseConfig[aName], bName, caseConfig[bName]));
    }
  }
  return covered;
}

function generatePairwiseCases(domains: FactorDomains): {
  selected: FactorCase[];
  totalCombinations: number;
  requiredPairs: number;
} {
  const factorNames = Object.keys(domains);
  const candidates = enumerateCases(domains);
  const uncovered = enumerateRequiredPairs(domains);
  const selected: FactorCase[] = [];

  while (uncovered.size > 0 && candidates.length > 0) {
    let bestIndex = 0;
    let bestGain = -1;

    for (let idx = 0; idx < candidates.length; idx += 1) {
      const pairs = coveredPairs(candidates[idx], factorNames);
      let gain = 0;
      for (const pair of pairs) {
        if (uncovered.has(pair)) {
          gain += 1;
        }
      }
      if (gain > bestGain) {
        bestGain = gain;
        bestIndex = idx;
      }
    }

    const [chosen] = candidates.splice(bestIndex, 1);
    selected.push(chosen);
    const chosenPairs = coveredPairs(chosen, factorNames);
    for (const pair of chosenPairs) {
      uncovered.delete(pair);
    }
  }

  return {
    selected,
    totalCombinations: enumerateCases(domains).length,
    requiredPairs: enumerateRequiredPairs(domains).size,
  };
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(items: T[], rng: () => number): T {
  const idx = Math.floor(rng() * items.length);
  return items[idx];
}

describe('NVCA computed interaction strategy', () => {
  itVerification.openspec('OA-FIL-002')('achieves MC/DC-style coverage for dispute-resolution forum and governing-law alignment chain', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    await allureParameter('strategy', 'mcdc');

    const baseCase: FactorCase = {
      dispute_resolution_mode: 'courts',
      state_lower: 'delaware',
      judicial_district_input: '',
      arbitration_location_input: '',
    };
    const modeToggleCase: FactorCase = {
      ...baseCase,
      dispute_resolution_mode: 'arbitration',
    };
    const stateToggleCase: FactorCase = {
      ...baseCase,
      state_lower: 'california',
    };

    const base = await allureStep('Evaluate base case (courts + delaware)', () => evaluateCase(baseCase));
    const modeToggle = await allureStep('Toggle dispute_resolution_mode=arbitration with state fixed', () =>
      evaluateCase(modeToggleCase)
    );
    const stateToggle = await allureStep('Toggle state_lower=california with courts mode fixed', () =>
      evaluateCase(stateToggleCase)
    );

    await allureStep('Assert dispute_resolution_mode independently flips track/alignment branch', () => {
      expect(base.auditValues.dispute_resolution_track).toBe('courts');
      expect(base.auditValues.forum_governing_law_alignment).toBe('aligned');
      expect(modeToggle.auditValues.dispute_resolution_track).toBe('arbitration');
      expect(modeToggle.auditValues.forum_governing_law_alignment).toBe('n/a-arbitration');
      expect(modeToggle.fillValues.arbitration_location).toBe(ARBITRATION_LOCATION_DEFAULT);
    });

    await allureStep('Assert state_lower independently flips courts alignment and default district', () => {
      expect(base.auditValues.forum_governing_law_alignment).toBe('aligned');
      expect(stateToggle.auditValues.forum_governing_law_alignment).toBe('mismatch');
      expect(base.fillValues.judicial_district).toBe('District of Delaware');
      expect(stateToggle.fillValues.judicial_district).toBe('Northern District of California');
    });
  });

  itVerification.openspec('OA-RCP-022')('uses pairwise reduction to cover interaction space without full Cartesian explosion', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    await allureParameter('strategy', 'pairwise');

    const factorNames = Object.keys(FACTOR_DOMAINS);
    const requiredPairs = enumerateRequiredPairs(FACTOR_DOMAINS);
    const reduction = generatePairwiseCases(FACTOR_DOMAINS);
    const covered = new Set<string>();

    for (const caseConfig of reduction.selected) {
      const evaluated = evaluateCase(caseConfig);
      assertCoreInvariants(caseConfig, evaluated);
      for (const pair of coveredPairs(caseConfig, factorNames)) {
        covered.add(pair);
      }
    }

    expect(covered.size).toBe(requiredPairs.size);
    expect(reduction.selected.length).toBeLessThan(reduction.totalCombinations);
  });

  itVerification.openspec('OA-FIL-002')('enforces dispute-resolution invariants across deterministic pseudo-random generated states', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    await allureParameter('strategy', 'property-invariants');

    const rng = createSeededRng(20260213);
    const trials = 120;

    for (let idx = 0; idx < trials; idx += 1) {
      const caseConfig: FactorCase = {
        dispute_resolution_mode: pick(FACTOR_DOMAINS.dispute_resolution_mode, rng),
        state_lower: pick(FACTOR_DOMAINS.state_lower, rng),
        judicial_district_input: pick(FACTOR_DOMAINS.judicial_district_input, rng),
        arbitration_location_input: pick(FACTOR_DOMAINS.arbitration_location_input, rng),
      };
      const evaluated = evaluateCase(caseConfig);
      assertCoreInvariants(caseConfig, evaluated);
    }

    expect(trials).toBeGreaterThanOrEqual(100);
  });

  itVerification.openspec('OA-FIL-002')('applies metamorphic checks when dispute-resolution mode toggles from courts to arbitration', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    await allureParameter('strategy', 'metamorphic');

    const baseCase: FactorCase = {
      dispute_resolution_mode: 'courts',
      state_lower: 'california',
      judicial_district_input: '',
      arbitration_location_input: '',
    };

    const toggledCase: FactorCase = {
      ...baseCase,
      dispute_resolution_mode: 'arbitration',
    };

    const base = evaluateCase(baseCase);
    const toggled = evaluateCase(toggledCase);

    await allureStep('Assert governing-law baseline remains constant', () => {
      expect(base.auditValues.governing_law_state).toBe('delaware');
      expect(toggled.auditValues.governing_law_state).toBe('delaware');
    });

    await allureStep('Assert only forum branch outputs change as expected', () => {
      expect(base.auditValues.dispute_resolution_track).toBe('courts');
      expect(toggled.auditValues.dispute_resolution_track).toBe('arbitration');

      expect(base.auditValues.forum_governing_law_alignment).toBe('mismatch');
      expect(toggled.auditValues.forum_governing_law_alignment).toBe('n/a-arbitration');

      expect(base.fillValues.judicial_district).toBe('Northern District of California');
      expect(toggled.fillValues.arbitration_location).toBe(ARBITRATION_LOCATION_DEFAULT);
    });
  });
});
