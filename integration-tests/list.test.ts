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
  authors?: Array<{
    name: string;
    slug?: string;
    role?: string;
    profile_url?: string;
  }>;
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

  it.openspec('OA-CLI-023')('has schema_version 1', () => {
    if (!available || !parsed) return;
    expect(parsed.schema_version).toBe(1);
  });

  it.openspec('OA-CLI-023')('has a cli_version string', () => {
    if (!available || !parsed) return;
    expect(typeof parsed.cli_version).toBe('string');
    expect(parsed.cli_version.length).toBeGreaterThan(0);
  });

  it.openspec('OA-CLI-023')('has items as an array', () => {
    if (!available || !parsed) return;
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it.openspec('OA-CLI-023')('items contain name and license or license_note keys', () => {
    if (!available || !parsed) return;
    expect(parsed.items.length).toBeGreaterThan(0);
    for (const item of parsed.items) {
      expect(item).toHaveProperty('name');
      const hasLicense = 'license' in item || 'license_note' in item;
      expect(hasLicense).toBe(true);
    }
  });

  it.openspec('OA-CLI-012')('items are sorted by name', () => {
    if (!available || !parsed) return;
    const names = parsed.items.map((item) => item.name);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it.openspec('OA-CLI-012')('items include full template metadata in json output', () => {
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

  it.openspec('OA-CLI-024')('includes structured authors when template metadata provides them', () => {
    if (!available || !parsed) return;
    const wyomingTemplate = parsed.items.find(
      (item) => item.name === 'openagreements-restrictive-covenant-wyoming'
    );
    expect(wyomingTemplate).toBeDefined();
    expect(wyomingTemplate?.authors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Joey Tsang',
          slug: 'joey-tsang',
          role: 'primary_author',
          profile_url: 'https://www.linkedin.com/in/joey-t-b90912b1/',
        }),
      ])
    );
  });
});

describe('list options', () => {
  it.openspec('OA-CLI-013')('--json-strict exits non-zero on metadata errors', () => {
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
