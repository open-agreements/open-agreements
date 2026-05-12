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
      'Partial: CI step "Validate generated README freshness" asserts committed README matches one generator run. Determinism across runs and the "stable headings + npm-safe absolute links" criteria are not separately verified — no dedicated vitest test yet.',
      () => {},
    );

  it
    .openspec('OA-DST-065')
    .skip(
      'No automated coverage yet. site/_data/catalog.js re-exports the pure shared helper scripts/lib/catalog-data.mjs, but neither the site build nor a vitest test asserts the no-side-effects property in CI.',
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
