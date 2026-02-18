import { describe, expect, beforeAll } from 'vitest';
import { itAllure } from '../tests/helpers/allure-test.js';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const it = itAllure.epic('Platform & Distribution');

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
  }, 45_000);

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

  it.openspec('OA-060')('installs from packed tarball and runs list --json', () => {
    if (!available) return;

    const repoRoot = new URL('..', import.meta.url).pathname;
    const sandbox = mkdtempSync(join(tmpdir(), 'oa-pack-install-'));
    let tarball = '';

    try {
      tarball = execSync('npm pack --ignore-scripts', {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 30_000,
      })
        .trim()
        .split('\n')
        .at(-1) ?? '';

      execSync('npm init -y', { cwd: sandbox, encoding: 'utf-8', timeout: 10_000 });
      execSync(`npm install --ignore-scripts "${join(repoRoot, tarball)}"`, {
        cwd: sandbox,
        encoding: 'utf-8',
        timeout: 60_000,
      });

      const output = execSync('npx open-agreements list --json', {
        cwd: sandbox,
        encoding: 'utf-8',
        timeout: 30_000,
      });
      const parsed = JSON.parse(output);
      expect(parsed.schema_version).toBe(1);
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items.length).toBeGreaterThan(0);
    } finally {
      if (tarball) {
        rmSync(join(repoRoot, tarball), { force: true });
      }
      rmSync(sandbox, { recursive: true, force: true });
    }
  }, 30_000);
});
