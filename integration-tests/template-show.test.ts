import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const it = itAllure.epic('Discovery & Metadata');

interface CatalogItem {
  name: string;
  artifact_type?: string;
  stability?: string | null;
  fields: unknown[];
  [key: string]: unknown;
}

interface ShowResponse {
  schema_version: number;
  cli_version: string;
  item: CatalogItem;
}

function runCli(args: string[]): string {
  return execFileSync('node', [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 10_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

describe('template show', () => {
  it('prints stability and priority fields for a template', () => {
    const output = runCli(['template', 'show', 'openagreements-board-consent-safe']);

    expect(output).toContain('ID: openagreements-board-consent-safe');
    expect(output).toContain('Stability: experimental');
    expect(output).toMatch(/Fields \(\d+ priority \/ \d+ total\):/);
  });

  it('returns exactly the matching list catalog item with --json', () => {
    const shown = JSON.parse(
      runCli(['template', 'show', 'openagreements-board-consent-safe', '--json']),
    ) as ShowResponse;
    const listed = JSON.parse(runCli(['list', '--json'])) as { items: CatalogItem[] };

    expect(shown.schema_version).toBe(1);
    expect(shown.cli_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(shown.item).toEqual(
      listed.items.find((item) => item.name === 'openagreements-board-consent-safe'),
    );
  });

  it('inspects field-selectors through the same command', () => {
    const shown = JSON.parse(
      runCli(['template', 'show', 'nvca-stock-purchase-agreement', '--json']),
    ) as ShowResponse;

    expect(shown.item.artifact_type).toBe('field-selector');
    expect(shown.item.fields.length).toBeGreaterThan(0);
  });

  it('fails clearly for an unknown agreement ID', () => {
    expect(() => runCli(['template', 'show', 'not-a-real-template'])).toThrow(
      /Unknown agreement "not-a-real-template"/,
    );
  });
});
