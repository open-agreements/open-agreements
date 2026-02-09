import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';

interface PackFile {
  path: string;
  size: number;
  mode: number;
}

interface PackResult {
  files: PackFile[];
}

describe('npm packaging', () => {
  let files: string[] = [];
  let available = true;

  beforeAll(() => {
    try {
      const packResult: PackResult[] = JSON.parse(
        execSync('npm pack --dry-run --json --ignore-scripts 2>/dev/null', {
          cwd: new URL('..', import.meta.url).pathname,
          encoding: 'utf-8',
          timeout: 30_000,
        })
      );
      files = packResult[0].files.map((f) => f.path);
    } catch (err) {
      if (process.env.CI) throw err; // fail hard in CI
      available = false;
    }
  });

  it('includes dist/cli/index.js', () => {
    if (!available) return;
    expect(files).toContain('dist/cli/index.js');
  });

  it('includes bin/open-agreements.js', () => {
    if (!available) return;
    expect(files).toContain('bin/open-agreements.js');
  });

  it('includes a template metadata file', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('templates/') && f.endsWith('metadata.yaml'))).toBe(
      true
    );
  });

  it('includes a recipe metadata file', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('recipes/') && f.endsWith('metadata.yaml'))).toBe(true);
  });

  it('does NOT include src/', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('src/'))).toBe(false);
  });

  it('does NOT include node_modules/', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('node_modules/'))).toBe(false);
  });
});
