import { afterEach, describe, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { itAllure } from './helpers/allure-test.js';
import {
  acquirePackageArtifactLock,
  type PackageArtifactLock,
} from './helpers/package-artifact-lock.js';

const it = itAllure.epic('Platform & Distribution');

describe('package artifact lock', () => {
  const locks: PackageArtifactLock[] = [];
  const roots: string[] = [];

  afterEach(() => {
    for (const lock of locks.splice(0)) lock.release();
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('keeps a second package operation out until the first releases', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-package-lock-test-'));
    roots.push(root);
    const first = await acquirePackageArtifactLock(root, 1_000);
    locks.push(first);

    let secondEntered = false;
    const secondPromise = acquirePackageArtifactLock(root, 1_000).then((lock) => {
      locks.push(lock);
      secondEntered = true;
      return lock;
    });

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    expect(secondEntered).toBe(false);

    first.release();
    await secondPromise;
    expect(secondEntered).toBe(true);
  });

  it('does not serialize independent worktrees', async () => {
    const rootA = mkdtempSync(join(tmpdir(), 'oa-package-lock-a-'));
    const rootB = mkdtempSync(join(tmpdir(), 'oa-package-lock-b-'));
    roots.push(rootA, rootB);

    const [lockA, lockB] = await Promise.all([
      acquirePackageArtifactLock(rootA, 1_000),
      acquirePackageArtifactLock(rootB, 1_000),
    ]);
    locks.push(lockA, lockB);

    expect(lockA.path).not.toBe(lockB.path);
  });
});
