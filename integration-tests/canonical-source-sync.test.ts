import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceFile } from '../scripts/template_renderer/canonical-source.mjs';
import { discoverCanonicalTemplates } from '../scripts/template_renderer/canonical-sources.mjs';
import { loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';

const it = itAllure.epic('Filling & Rendering');

const repoRoot = join(import.meta.dirname, '..');
const stylePath = join(
  repoRoot,
  'scripts',
  'template-specs',
  'styles',
  'openagreements-default-v1.json'
);

const canonicalTemplates = discoverCanonicalTemplates(repoRoot);

describe('canonical Markdown -> JSON spec sync', () => {
  it.openspec('OA-TMP-035')('discovers at least one canonical template under content/templates', () => {
    expect(canonicalTemplates.length).toBeGreaterThan(0);
  });

  for (const source of canonicalTemplates) {
    it.openspec('OA-TMP-035')(`${source.slug} compiles to its committed generated JSON`, () => {
      const compiled = compileCanonicalSourceFile(join(repoRoot, source.templatePath));
      const committedJson = JSON.parse(readFileSync(join(repoRoot, source.jsonPath), 'utf-8'));

      expect(
        compiled.contractSpec,
        `Canonical source ${source.templatePath} is out of sync with committed ${source.jsonPath}. ` +
          `Run "npm run generate:templates" to regenerate.`
      ).toEqual(committedJson);
    });

    it.openspec('OA-TMP-035')(`${source.slug} renders end-to-end from canonical source`, () => {
      const compiled = compileCanonicalSourceFile(join(repoRoot, source.templatePath));
      const style = loadStyleProfile(stylePath);
      const rendered = renderFromValidatedSpec(compiled.contractSpec, style);

      expect(rendered.markdown.length).toBeGreaterThan(0);
      expect(rendered.document).toBeDefined();
    });
  }
});
