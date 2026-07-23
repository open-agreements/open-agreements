import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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
      expect(actual).toContain('@usejunior/docx-core');
      expect([...actual].sort()).toEqual([...expected].sort());
    },
    30_000,
  );
});
