/**
 * README generation scenario bindings.
 *
 * The README generator (scripts/generate_readme.mjs) and its drift gate
 * (`npm run check:readme` step in CI) are exercised by the workflow, not
 * by vitest. These pending bindings document the scenario IDs while the
 * test-side implementation remains CI-only.
 */

import { describe } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

describe('README generation', () => {
  it
    .openspec('OA-DST-064')
    .skip(
      'Covered by CI step "Validate generated README freshness" (npm run generate:readme && git diff --exit-code -- README.md). No vitest binding yet.',
      () => {},
    );

  it
    .openspec('OA-DST-065')
    .skip(
      'Covered indirectly by Eleventy site build remaining green while scripts/lib/catalog-data.mjs powers both site/_data/catalog.js and the README generator. No vitest binding yet.',
      () => {},
    );

  it
    .openspec('OA-DST-066')
    .skip(
      'Enforced by CI workflow step "Validate generated README freshness" (.github/workflows/ci.yml).',
      () => {},
    );

  it
    .openspec('OA-DST-067')
    .skip(
      'Enforced by CI workflow step "Validate generated README freshness" (.github/workflows/ci.yml).',
      () => {},
    );
});
