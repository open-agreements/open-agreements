import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceFile } from '../scripts/template_renderer/canonical-source.mjs';

const it = itAllure.epic('Filling & Rendering');

const repoRoot = join(import.meta.dirname, '..');

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function discoverCanonicalTemplates(): string[] {
  const templatesDir = join(repoRoot, 'content', 'templates');
  const results: string[] = [];
  for (const entry of readdirSync(templatesDir)) {
    const candidate = join(templatesDir, entry, 'template.md');
    try {
      if (!statSync(candidate).isFile()) continue;
    } catch {
      continue;
    }
    const raw = readFileSync(candidate, 'utf-8');
    const match = raw.match(FRONTMATTER_RE);
    if (!match) continue;
    // The canonical-employment-template pipeline requires source_json in the
    // frontmatter so the generator can write back the regenerated JSON spec.
    // Other markdown templates (e.g. Contract IR consents) use different
    // frontmatter shapes and are out of scope for this guardrail.
    if (/^source_json\s*:/m.test(match[1])) {
      results.push(relative(repoRoot, candidate));
    }
  }
  return results.sort();
}

const canonicalTemplates = discoverCanonicalTemplates();

describe('canonical Markdown -> JSON spec sync', () => {
  it.openspec('OA-TMP-035')('discovers at least one canonical template under content/templates', () => {
    expect(canonicalTemplates.length).toBeGreaterThan(0);
  });

  for (const relPath of canonicalTemplates) {
    it.openspec('OA-TMP-035')(`${relPath} compiles to its committed source_json`, () => {
      const compiled = compileCanonicalSourceFile(join(repoRoot, relPath));
      expect(compiled.sourceJsonPath, `${relPath} frontmatter must declare source_json`).toBeTruthy();

      const committedJsonPath = join(repoRoot, compiled.sourceJsonPath);
      const committedJson = JSON.parse(readFileSync(committedJsonPath, 'utf-8'));

      expect(
        compiled.contractSpec,
        `Canonical source ${relPath} is out of sync with committed ${compiled.sourceJsonPath}. ` +
          `Run "npm run generate:employment-templates" to regenerate.`
      ).toEqual(committedJson);
    });
  }
});
