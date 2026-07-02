import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');
const ROOT = new URL('..', import.meta.url).pathname;

function read(name: string): string {
  return readFileSync(join(ROOT, name), 'utf-8');
}

describe('root llms.txt / llms-full.txt', () => {
  it('llms.txt follows the llmstxt.org shape (H1 + summary blockquote)', () => {
    const txt = read('llms.txt');
    expect(txt.startsWith('# OpenAgreements')).toBe(true);
    expect(txt).toMatch(/\n> Open, primary-source-backed U\.S\. legal content/);
    // Content-first sections present, tooling demoted under Optional.
    for (const section of ['## Practice Guides', '## Law Surveys', '## Checklists', '## Templates', '## Optional']) {
      expect(txt, `missing section ${section}`).toContain(section);
    }
    // MCP/tooling lives under Optional, not in the lead sections.
    const optionalIndex = txt.indexOf('## Optional');
    expect(txt.indexOf('MCP')).toBeGreaterThan(optionalIndex);
  });

  it('llms-full.txt enumerates individual templates by category', () => {
    const full = read('llms-full.txt');
    expect(full).toContain('### SAFEs');
    // At least one concrete template link into the templates/ tree.
    expect(full).toMatch(/- \[[^\]]+\]\(https:\/\/github\.com\/open-agreements\/open-agreements\/tree\/main\/templates\//);
  });

  it('is in sync with the generator (no drift)', () => {
    // Regenerates in --check mode; exits non-zero on drift.
    expect(() =>
      execFileSync('node', ['scripts/generate_llms_txt.mjs', '--check'], { cwd: ROOT }),
    ).not.toThrow();
  });
});
