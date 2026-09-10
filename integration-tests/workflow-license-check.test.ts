import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import yaml from 'js-yaml';
import {describe, expect} from 'vitest';
import {itAllure} from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const workflow = yaml.load(readFileSync(join(ROOT, '.github/workflows/validate.yml'), 'utf8')) as {
  jobs: {validate: {steps: Array<{name?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown>; 'continue-on-error'?: boolean}>}};
};
const steps = workflow.jobs.validate.steps;
const it = itAllure.epic('Compliance & Governance');

describe('validate workflow original-content protection', () => {
  it('runs the tested integrity checker as a blocking step', () => {
    const gate = steps.find(step => step.name === 'Check no CC BY-ND derivatives');
    expect(gate?.run).toBe('node scripts/check_external_source_integrity.mjs');
    expect(gate?.['continue-on-error']).not.toBe(true);
  });
  it('compares against the PR base or the complete pre-push revision', () => {
    const gate = steps.find(step => step.name === 'Check no CC BY-ND derivatives');
    expect(gate?.env?.BASE_SHA).toBe('${{ github.event.pull_request.base.sha || github.event.before }}');
    expect(steps.find(step => step.uses?.startsWith('actions/checkout@'))?.with?.['fetch-depth']).toBe(0);
  });
});
