import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const it = itAllure.epic('Discovery & Metadata');

interface ListItem {
  name: string;
  attribution_text?: string;
  category?: string;
  [key: string]: unknown;
}

interface ListResponse {
  schema_version: number;
  cli_version: string;
  items: ListItem[];
}

describe('list --json envelope', () => {
  let parsed: ListResponse | null = null;
  let available = true;

  try {
    const output = execSync(`node ${BIN} list --json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    });
    parsed = JSON.parse(output) as ListResponse;
  } catch (err) {
    if (process.env.CI) throw err;
    available = false;
  }

  it.openspec('OA-158')('has schema_version 1', () => {
    if (!available || !parsed) return;
    expect(parsed.schema_version).toBe(1);
  });

  it.openspec('OA-158')('has a cli_version string', () => {
    if (!available || !parsed) return;
    expect(typeof parsed.cli_version).toBe('string');
    expect(parsed.cli_version.length).toBeGreaterThan(0);
  });

  it.openspec('OA-158')('has items as an array', () => {
    if (!available || !parsed) return;
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it.openspec('OA-158')('items contain name and license or license_note keys', () => {
    if (!available || !parsed) return;
    expect(parsed.items.length).toBeGreaterThan(0);
    for (const item of parsed.items) {
      expect(item).toHaveProperty('name');
      const hasLicense = 'license' in item || 'license_note' in item;
      expect(hasLicense).toBe(true);
    }
  });

  it.openspec('OA-057')('items are sorted by name', () => {
    if (!available || !parsed) return;
    const names = parsed.items.map((item) => item.name);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it.openspec('OA-057')('items include full template metadata in json output', () => {
    if (!available || !parsed) return;
    const templateItems = parsed.items.filter((item) => typeof item.attribution_text === 'string');
    expect(templateItems.length).toBeGreaterThan(0);

    for (const item of templateItems) {
      expect(item).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          source_url: expect.any(String),
          source: expect.any(String),
          attribution_text: expect.any(String),
          fields: expect.any(Array),
        })
      );
    }
  });
});

describe('list options', () => {
  it.openspec('OA-059')('--templates-only filters to templates', () => {
    const output = execSync(`node ${BIN} list --json --templates-only`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    });
    const parsed = JSON.parse(output) as ListResponse;
    const names = parsed.items.map((item) => item.name);

    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('common-paper-mutual-nda');
    expect(names).toContain('openagreements-employment-offer-letter');
    expect(names).not.toContain('yc-safe-valuation-cap');
    expect(names).not.toContain('nvca-voting-agreement');

    const employmentItem = parsed.items.find((item: { name: string }) =>
      item.name === 'openagreements-employment-offer-letter'
    );
    expect(employmentItem.category).toBe('employment');
  });

  it.openspec('OA-058')('--json-strict exits non-zero on metadata errors', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-list-strict-'));
    const templatesDir = join(root, 'templates', 'bad-template');
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(
      join(templatesDir, 'metadata.yaml'),
      [
        'name: Bad Template',
        'source_url: https://example.com/template.docx',
        'version: 1.0',
        'license: MIT',
        'allow_derivatives: true',
        'attribution_text: Example',
        'fields: []',
        '',
      ].join('\n'),
      'utf-8'
    );

    try {
      expect(() =>
        execSync(`node ${BIN} list --json-strict`, {
          cwd: ROOT,
          encoding: 'utf-8',
          timeout: 10_000,
          env: {
            ...process.env,
            OPEN_AGREEMENTS_CONTENT_ROOTS: root,
          },
          stdio: 'pipe',
        })
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
