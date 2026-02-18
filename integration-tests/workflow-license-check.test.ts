import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import {
  allureAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const VALIDATE_WORKFLOW = readFileSync(join(ROOT, '.github/workflows/validate.yml'), 'utf-8');
const it = itAllure.epic('Compliance & Governance');

describe('validate workflow license-diff logic', () => {
  it.openspec('OA-010')('uses PR base SHA for pull_request events', async () => {
    await allureParameter('workflow', '.github/workflows/validate.yml');
    await allureAttachment('workflow-snippet.txt', VALIDATE_WORKFLOW);

    await allureStep('Assert pull_request branch base SHA logic', () => {
      expect(VALIDATE_WORKFLOW).toContain('if [ "${{ github.event_name }}" = "pull_request" ]; then');
      expect(VALIDATE_WORKFLOW).toContain('BASE_SHA="${{ github.event.pull_request.base.sha }}"');
    });
  });

  it.openspec('OA-011')('uses HEAD~1 for push events', async () => {
    await allureParameter('workflow', '.github/workflows/validate.yml');

    await allureStep('Assert push-event base SHA fallback', () => {
      expect(VALIDATE_WORKFLOW).toContain('BASE_SHA="HEAD~1"');
    });
  });

  it.openspec('OA-042')('checks modified allow_derivatives=false templates and exits non-zero', async () => {
    await allureParameter('workflow', '.github/workflows/validate.yml');

    await allureStep('Assert non-derivative enforcement block', () => {
      expect(VALIDATE_WORKFLOW).toContain('allow_derivatives:');
      expect(VALIDATE_WORKFLOW).toContain('if [ "$allow" = "false" ]; then');
      expect(VALIDATE_WORKFLOW).toContain('git diff --name-only "$BASE_SHA"');
      expect(VALIDATE_WORKFLOW).toContain('exit 1');
    });
  });
});
