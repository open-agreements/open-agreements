import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const PREPARE_SCRIPT = join(REPO_ROOT, 'scripts', 'prepare_scoped_open_agreements_package.mjs');
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function bundledPackages(packageDir) {
  const npmCacheDir = tempDir('oa-scoped-pack-cache-');
  const output = execFileSync(
    NPM_COMMAND,
    ['pack', '--dry-run', '--json', '--ignore-scripts', '--offline', '--cache', npmCacheDir],
    {
      cwd: packageDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        NO_UPDATE_NOTIFIER: '1',
        npm_config_update_notifier: 'false',
      },
      maxBuffer: 50 * 1024 * 1024,
    },
  );
  return JSON.parse(output)[0]?.bundled ?? [];
}

describe('prepare_scoped_open_agreements_package', () => {
  it('keeps successful capability checks silent for npm pack JSON consumers', () => {
    expect(execFileSync(process.execPath, ['scripts/check_runtime_capabilities.mjs'], {
      cwd: REPO_ROOT, encoding: 'utf8',
    })).toBe('');
  });

  it('refuses a capability declaration that exceeds the built runtime before copying', () => {
    const fixture = tempDir('oa-incompatible-package-');
    mkdirSync(join(fixture, 'scripts'));
    mkdirSync(join(fixture, 'dist/core'), { recursive: true });
    cpSync(join(REPO_ROOT, 'scripts/check_runtime_capabilities.mjs'), join(fixture, 'scripts/check_runtime_capabilities.mjs'));
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ type: 'module', files: ['dist/'] }));
    writeFileSync(join(fixture, 'dist/core/runtime-capabilities.js'), 'export const RUNTIME_CAPABILITIES = {schema_version:1,capabilities:[]};');
    writeFileSync(join(fixture, 'runtime-capabilities.json'), JSON.stringify({ schema_version: 1, capabilities: ['selections.bounded-removal.v1'] }));
    const outDir = tempDir('oa-incompatible-destination-');
    writeFileSync(join(outDir, 'sentinel'), 'unchanged');

    expect(() => execFileSync(process.execPath, [PREPARE_SCRIPT, '--out-dir', outDir], { cwd: fixture, stdio: 'pipe' })).toThrow();
    expect(readFileSync(join(outDir, 'sentinel'), 'utf8')).toBe('unchanged');
    expect(existsSync(join(outDir, 'dist'))).toBe(false);
  });

  it(
    'stages the same bundled dependency tree as the root package',
    () => {
      const expected = bundledPackages(REPO_ROOT);
      const outDir = tempDir('oa-scoped-package-');

      execFileSync(process.execPath, [PREPARE_SCRIPT, '--out-dir', outDir], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });

      const actual = bundledPackages(outDir);
      expect(JSON.parse(readFileSync(join(outDir, 'runtime-capabilities.json'), 'utf8'))).toEqual(
        JSON.parse(readFileSync(join(REPO_ROOT, 'runtime-capabilities.json'), 'utf8')),
      );
      expect(actual).toContain('@usejunior/docx-core');
      expect([...actual].sort()).toEqual([...expected].sort());
      expect(
        existsSync(join(outDir, 'concerto', 'openagreements-employee-ip-inventions-assignment.cto')),
      ).toBe(true);
    },
    60_000,
  );
});
