import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceFile } from '../scripts/template_renderer/canonical-source.mjs';

const it = itAllure.epic('Filling & Rendering');

const repoRoot = join(import.meta.dirname, '..');

const CANONICAL_TEMPLATES = [
  'content/templates/openagreements-employee-ip-inventions-assignment/template.md',
  'content/templates/openagreements-restrictive-covenant-wyoming/template.md',
];

describe('canonical Markdown -> JSON spec sync', () => {
  for (const relPath of CANONICAL_TEMPLATES) {
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
