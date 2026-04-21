import { describe, expect, beforeAll } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { seconds } from './helpers/timeouts.js';
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
          timeout: seconds(30),
        })
      );
      files = packResult[0].files.map((f) => f.path);
    } catch (err) {
      if (process.env.CI) throw err; // fail hard in CI
      available = false;
    }
  }, seconds(45));

  it.openspec('OA-DST-029')('includes dist/cli/index.js', () => {
    if (!available) return;
    expect(files).toContain('dist/cli/index.js');
  });

  it.openspec('OA-DST-029')('includes bin/open-agreements.js', () => {
    if (!available) return;
    expect(files).toContain('bin/open-agreements.js');
  });

  it.openspec('OA-DST-029')('includes a template metadata file', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('content/templates/') && f.endsWith('metadata.yaml'))).toBe(
      true
    );
  });

  it.openspec('OA-DST-029')('includes a recipe metadata file', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('content/recipes/') && f.endsWith('metadata.yaml'))).toBe(true);
  });

  it.openspec('OA-DST-029')('does NOT include src/', () => {
    if (!available) return;
    expect(files.some((f) => f.startsWith('src/'))).toBe(false);
  });

  it.openspec('OA-DST-029')('does NOT include unbundled node_modules/', () => {
    if (!available) return;
    // bundleDependencies intentionally places packages (and their transitive
    // deps) under node_modules/ inside the tarball. Only flag files that do
    // NOT originate from bundled dependency trees.
    const hasBundledDeps = files.some((f) => f.startsWith('node_modules/'));
    if (hasBundledDeps) {
      // Verify bundled files trace back to declared bundleDependencies.
      // npm hoists transitive deps to root node_modules/, so we verify
      // that each declared bundle root has files in the tarball.
      const pkg = JSON.parse(
        execSync('cat package.json', {
          cwd: new URL('..', import.meta.url).pathname,
          encoding: 'utf-8',
        })
      );
      const bundled: string[] = pkg.bundleDependencies ?? pkg.bundledDependencies ?? [];
      expect(bundled.length).toBeGreaterThan(0);
      for (const dep of bundled) {
        expect(files.some((f) => f.startsWith(`node_modules/${dep}/`))).toBe(true);
      }
    } else {
      expect(files.some((f) => f.startsWith('node_modules/'))).toBe(false);
    }
  });

  it.openspec('OA-DST-005')('installs from packed tarball and runs list --json', () => {
    if (!available) return;

    const repoRoot = new URL('..', import.meta.url).pathname;
    const sandbox = mkdtempSync(join(tmpdir(), 'oa-pack-install-'));
    let tarball = '';

    try {
      tarball = execSync('npm pack --ignore-scripts', {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: seconds(30),
      })
        .trim()
        .split('\n')
        .at(-1) ?? '';

      execSync('npm init -y', { cwd: sandbox, encoding: 'utf-8', timeout: seconds(10) });
      execSync(`npm install --ignore-scripts "${join(repoRoot, tarball)}"`, {
        cwd: sandbox,
        encoding: 'utf-8',
        timeout: seconds(60),
      });

      const output = execSync('npx open-agreements list --json', {
        cwd: sandbox,
        encoding: 'utf-8',
        timeout: seconds(30),
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
  }, seconds(30));
});
