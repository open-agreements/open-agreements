import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { listTemplateItems } from '../src/core/template-listing.js';

const ENV_KEY = 'OPEN_AGREEMENTS_CONTENT_ROOTS';
const originalEnv = process.env[ENV_KEY];
const tempDirs: string[] = [];
const it = itAllure.epic('Platform & Distribution');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (originalEnv === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalEnv;
  }
});

// Provenance contract (open-agreements#533): `derived_from` and `credits` are
// validated metadata fields already present in CLI JSON output; the shared
// TemplateListItem projection must carry them too so MCP/API consumers see
// them. Credits stay structured (name/role/profile_url) — never flattened
// into display prose. Policy for WHEN templates declare them is #244.
describe('template listing provenance projection (#533)', () => {
  it('projects declared derived_from and structured credits through listTemplateItems', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-listing-provenance-'));
    tempDirs.push(root);

    // S3 layout (#1249): slugs live two levels deep as templates/<segment>/<slug>/.
    const templateDir = join(root, 'templates', 'override-cc-by-4.0', 'provenance-fixture-template');
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(
      join(templateDir, 'metadata.yaml'),
      [
        'name: Provenance Fixture Template',
        'description: Fixture template exercising provenance projection',
        'source_url: https://example.com/provenance-template.docx',
        'version: "1.0"',
        'license: CC-BY-4.0',
        'allow_derivatives: true',
        'attribution_text: Example attribution',
        'derived_from: Adapted from the ExampleCo form agreement (2024 edition).',
        'credits:',
        '  - name: Jane Drafter',
        '    role: drafter',
        '    profile_url: https://example.com/jane',
        '  - name: Sam Reviewer',
        '    role: reviewer',
        'fields:',
        '  - name: company_name',
        '    type: string',
        '    description: Company name',
        'priority_fields:',
        '  - company_name',
        '',
      ].join('\n'),
      'utf-8',
    );

    process.env[ENV_KEY] = root;

    const items = listTemplateItems();
    const item = items.find((entry) => entry.name === 'provenance-fixture-template');
    expect(item).toBeDefined();

    expect(item!.derived_from).toBe('Adapted from the ExampleCo form agreement (2024 edition).');
    // Structured role/name data passes through as-is — not flattened to prose.
    expect(item!.credits).toEqual([
      { name: 'Jane Drafter', role: 'drafter', profile_url: 'https://example.com/jane' },
      { name: 'Sam Reviewer', role: 'reviewer' },
    ]);
  });

  it('omits derived_from and yields empty credits for templates that declare neither', () => {
    delete process.env[ENV_KEY];

    const items = listTemplateItems();
    // Vendored third-party template with no provenance metadata declared.
    const item = items.find((entry) => entry.name === 'common-paper-mutual-nda');
    expect(item).toBeDefined();

    expect('derived_from' in item!).toBe(false);
    expect(item!.credits).toEqual([]);
  });
});
