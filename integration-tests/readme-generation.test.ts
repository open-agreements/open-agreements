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
import { buildCatalogReference, buildReadme } from '../scripts/generate_readme.mjs';
import { buildCatalog } from '../scripts/lib/catalog-data.mjs';
import { buildLibrary } from '../scripts/lib/library-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const it = itAllure.epic('Platform & Distribution');

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

describe('README generation', () => {
  it(
    'README generation is deterministic with stable headings and absolute links',
    () => {
      const first = buildReadme();
      const second = buildReadme();
      expect(first).toBe(second);

      // Stable headings sourced from the checked-in template.
      expect(first).toContain('## What OpenAgreements does');
      expect(first).toContain('## Fill your first agreement');
      expect(first).toContain('## Understand the workflow');
      expect(first).toContain('docs/quickstart.md');

      // Exhaustive inventories live in the generated reference, not the front door.
      expect(first).not.toContain('## Available Templates');
      expect(first).not.toContain('## Available Skills');
      expect(first).not.toContain('| Template | HTML | Source | License | Repo |');
      expect(first).toContain('docs/reference/catalog.md');

      // npm-safe absolute links: repo content is linked with absolute GitHub
      // URLs (npm renders the README without repo-relative context).
      expect(first).toMatch(
        /https:\/\/github\.com\/open-agreements\/open-agreements\/(tree|blob)\/main\//,
      );

      // Content-first cleanup (#1246): no MCP status badge, no demo GIF, and
      // content tables use concrete FORMAT labels (HTML/Markdown) rather than
      // navigational words (Browse/Live/Website/Web) as column headers.
      expect(first).not.toContain('MCP Server Status');
      expect(first).not.toContain('demo-fill-nda.gif');
      expect(first).not.toContain('## Contents');

      // Public documentation does not name a private implementation repository.
      expect(first).not.toContain('UseJunior/legal-explainer');
    },
  );

  it('catalog reference is generated from repository metadata', () => {
    const catalog = buildCatalogReference();
    expect(catalog).toContain('## Choose an agreement template');
    expect(catalog).toContain('## Install an agent skill');
    expect(catalog).toContain('| Template | HTML | Source | License | Repo |');
    expect(catalog).toMatch(/https:\/\/openagreements\.org\/practice-guides\/non-compete/);
    expect(catalog).toBe(readRepoFile('docs/reference/catalog.md'));
  });

  it(
    'README generator reads catalog data from a pure shared helper',
    () => {
      // The shared helper returns plain catalog data (pure read, not an
      // Eleventy data file with site-specific side effects).
      const catalog = buildCatalog({ rootDir: ROOT });
      expect(Array.isArray(catalog.templates)).toBe(true);
      expect(catalog.templates.length).toBeGreaterThan(0);
      expect(Array.isArray(catalog.categories)).toBe(true);

      // The Legal Practice Library index is likewise a pure read of the
      // committed OKF tree; counts are derived, never hard-coded.
      const library = buildLibrary({ rootDir: ROOT });
      expect(library.practiceGuides.length).toBeGreaterThan(0);
      expect(library.practiceGuideCount).toBeGreaterThan(0);
      expect(library.surveys.length).toBeGreaterThan(0);
      expect(library.checklistCount).toBeGreaterThan(0);
    },
  );

  it(
    'committed README matches generator output (drift gate)',
    () => {
      // This is the assertion behind `npm run check:readme`: regenerating the
      // README must reproduce the committed file byte-for-byte.
      expect(buildReadme()).toBe(readRepoFile('README.md'));
    },
  );

  it(
    'regenerated README stays in sync so the drift check passes',
    () => {
      expect(buildReadme()).toBe(readRepoFile('README.md'));
    },
  );
});
