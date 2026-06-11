import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  REGISTRY_DESCRIPTION_MAX,
  SERVER_JSON,
  VERSION_FILES,
  bumpVersion,
  checkVersionSync,
} from './bump_version.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fixtureRoot({ version = '1.2.3', serverOverrides = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'oa-bump-version-'));
  tempDirs.push(root);

  for (const relPath of VERSION_FILES) {
    const absPath = join(root, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, `${JSON.stringify({ name: relPath, version }, null, 2)}\n`);
  }

  const serverJson = {
    name: 'io.github.open-agreements/open-agreements',
    description: 'Test server.',
    version,
    packages: [{ identifier: '@open-agreements/contract-templates-mcp', version }],
    ...serverOverrides,
  };
  writeFileSync(join(root, SERVER_JSON), `${JSON.stringify(serverJson, null, 2)}\n`);
  return root;
}

describe('checkVersionSync', () => {
  it('passes on the real repo (all manifests in lockstep)', () => {
    const result = checkVersionSync(REPO_ROOT);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    // Every tracked manifest plus server.json's top-level and per-package
    // version fields must be represented.
    expect(result.versions.size).toBeGreaterThanOrEqual(VERSION_FILES.length + 2);
  });

  it('passes on an in-sync fixture', () => {
    const result = checkVersionSync(fixtureRoot());
    expect(result.ok).toBe(true);
  });

  it('fails when server.json top-level version drifts', () => {
    const root = fixtureRoot({ serverOverrides: { version: '0.5.0' } });
    const result = checkVersionSync(root);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('0.5.0');
  });

  it('fails when server.json packages[0].version drifts', () => {
    const root = fixtureRoot({
      serverOverrides: { packages: [{ identifier: 'x', version: '0.0.1' }] },
    });
    const result = checkVersionSync(root);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('packages[0]');
  });

  it('fails when a package.json version drifts', () => {
    const root = fixtureRoot();
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'package.json', version: '9.9.9' }, null, 2)}\n`,
    );
    const result = checkVersionSync(root);
    expect(result.ok).toBe(false);
  });

  it('fails when the registry description cap is exceeded', () => {
    const root = fixtureRoot({
      serverOverrides: { description: 'x'.repeat(REGISTRY_DESCRIPTION_MAX + 1) },
    });
    const result = checkVersionSync(root);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain(`${REGISTRY_DESCRIPTION_MAX}`);
  });

  it('enforces the registry description cap on the real server.json', () => {
    const serverJson = JSON.parse(readFileSync(join(REPO_ROOT, SERVER_JSON), 'utf8'));
    expect(serverJson.description.length).toBeLessThanOrEqual(REGISTRY_DESCRIPTION_MAX);
  });
});

describe('bumpVersion', () => {
  it('bumps every manifest including both server.json version fields', () => {
    const root = fixtureRoot();
    bumpVersion('2.0.0', root);

    for (const relPath of VERSION_FILES) {
      const pkg = JSON.parse(readFileSync(join(root, relPath), 'utf8'));
      expect(pkg.version, relPath).toBe('2.0.0');
    }
    const serverJson = JSON.parse(readFileSync(join(root, SERVER_JSON), 'utf8'));
    expect(serverJson.version).toBe('2.0.0');
    expect(serverJson.packages[0].version).toBe('2.0.0');
  });

  it('throws when the post-bump sync check fails', () => {
    const root = fixtureRoot({
      serverOverrides: { description: 'x'.repeat(REGISTRY_DESCRIPTION_MAX + 1) },
    });
    expect(() => bumpVersion('2.0.0', root)).toThrow(/description/);
  });
});
