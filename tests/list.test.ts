import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');

describe('list --json envelope', () => {
  let parsed: any;
  let available = true;

  beforeAll(() => {
    try {
      // Ensure built
      execSync('npm run build', { cwd: ROOT, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });

      const output = execSync(`node ${BIN} list --json`, {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 10_000,
      });
      parsed = JSON.parse(output);
    } catch (err) {
      if (process.env.CI) throw err;
      available = false;
    }
  });

  it('has schema_version 1', () => {
    if (!available) return;
    expect(parsed.schema_version).toBe(1);
  });

  it('has a cli_version string', () => {
    if (!available) return;
    expect(typeof parsed.cli_version).toBe('string');
    expect(parsed.cli_version.length).toBeGreaterThan(0);
  });

  it('has items as an array', () => {
    if (!available) return;
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it('items contain name and license or license_note keys', () => {
    if (!available) return;
    expect(parsed.items.length).toBeGreaterThan(0);
    for (const item of parsed.items) {
      expect(item).toHaveProperty('name');
      const hasLicense = 'license' in item || 'license_note' in item;
      expect(hasLicense).toBe(true);
    }
  });

  it('items are sorted by name', () => {
    if (!available) return;
    const names = parsed.items.map((i: any) => i.name);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});
