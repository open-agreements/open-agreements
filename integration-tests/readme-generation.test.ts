/**
 * README generation scenario bindings.
 *
 * The README generator (scripts/generate_readme.mjs) builds README.md from a
 * checked-in template plus live repo metadata, and a CI drift gate
 * (`npm run check:readme`) fails when the committed file is out of sync. These
 * tests exercise the pure builder directly.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { buildReadme } from '../scripts/generate_readme.mjs';
import { buildCatalog } from '../scripts/lib/catalog-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const it = itAllure.epic('Platform & Distribution');

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

describe('README generation', () => {
  it.openspec('OA-DST-064')(
    'README generation is deterministic with stable headings and absolute links',
    () => {
      const first = buildReadme();
      const second = buildReadme();
      expect(first).toBe(second);

      // Stable headings sourced from the checked-in template.
      expect(first).toContain('## How It Works');
      expect(first).toContain('## Available Templates');
      expect(first).toContain('## Available Skills');
      expect(first).toContain('## Packages');

      // npm-safe absolute links: repo content is linked with absolute GitHub
      // URLs (npm renders the README without repo-relative context).
      expect(first).toMatch(
        /https:\/\/github\.com\/open-agreements\/open-agreements\/(tree|blob)\/main\//,
      );
    },
  );

  it.openspec('OA-DST-065')(
    'README generator reads catalog data from a pure shared helper',
    () => {
      // The shared helper returns plain catalog data (pure read, not an
      // Eleventy data file with site-specific side effects).
      const catalog = buildCatalog({ rootDir: ROOT });
      expect(Array.isArray(catalog.templates)).toBe(true);
      expect(catalog.templates.length).toBeGreaterThan(0);
      expect(Array.isArray(catalog.categories)).toBe(true);

      // The Eleventy data file re-exports the same shared helper rather than
      // re-implementing catalog loading with site side effects.
      const catalogDataFile = readRepoFile('site/_data/catalog.js');
      expect(catalogDataFile).toContain('../../scripts/lib/catalog-data.mjs');
      expect(catalogDataFile).toContain('buildCatalog');
    },
  );

  it.openspec('OA-DST-066')(
    'committed README matches generator output (drift gate)',
    () => {
      // This is the assertion behind `npm run check:readme`: regenerating the
      // README must reproduce the committed file byte-for-byte.
      expect(buildReadme()).toBe(readRepoFile('README.md'));
    },
  );

  it.openspec('OA-DST-067')(
    'regenerated README stays in sync so the drift check passes',
    () => {
      expect(buildReadme()).toBe(readRepoFile('README.md'));
    },
  );
});
