import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const it = itAllure.epic('Platform & Distribution');

describe('documentation interface', () => {
  it('the quick-start values produce a reviewable Mutual NDA through the CLI', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'open-agreements-docs-'));
    const output = join(workDir, 'mutual-nda.docx');
    const values = join(ROOT, 'docs/examples/mutual-nda.values.json');

    try {
      const stdout = execFileSync(
        process.execPath,
        [
          join(ROOT, 'bin/open-agreements.js'),
          'fill',
          'common-paper-mutual-nda',
          '--data',
          values,
          '--output',
          output,
        ],
        { cwd: ROOT, encoding: 'utf-8' },
      );

      expect(stdout).toContain('Filled Mutual NDA');
      expect(stdout).toContain(`Output: ${output}`);

      const archive = new AdmZip(output);
      const documentXml = archive.readAsText('word/document.xml');
      expect(documentXml).toContain('Acme Manufacturing, Inc.');
      expect(documentXml).toContain('Northeast Logistics LLC');
      expect(documentXml).toContain('Evaluating a potential logistics relationship');
      expect(documentXml).not.toMatch(/\{\{[^}]+\}\}/);

      const documentedValues = JSON.parse(readFileSync(values, 'utf-8'));
      expect(documentedValues.party_1_email).toBe('jane@example.com');
      expect(documentedValues.party_2_email).toBe('john@example.com');
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
