import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findTemplateDir, listTemplateEntries } from '../src/utils/paths.js';

const ENV_KEY = 'OPEN_AGREEMENTS_CONTENT_ROOTS';
const originalEnv = process.env[ENV_KEY];
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }

  if (originalEnv === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalEnv;
  }
});

describe('content root overrides', () => {
  it('finds template directories from OPEN_AGREEMENTS_CONTENT_ROOTS', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-'));
    tempDirs.push(root);

    const customTemplateDir = join(root, 'templates', 'custom-template');
    mkdirSync(customTemplateDir, { recursive: true });

    process.env[ENV_KEY] = root;

    expect(findTemplateDir('custom-template')).toBe(customTemplateDir);
  });

  it('deduplicates IDs by precedence with env roots first', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-priority-'));
    tempDirs.push(root);

    const overriddenId = 'common-paper-mutual-nda';
    const overrideDir = join(root, 'templates', overriddenId);
    mkdirSync(overrideDir, { recursive: true });

    process.env[ENV_KEY] = root;

    const entries = listTemplateEntries();
    const match = entries.find((entry) => entry.id === overriddenId);

    expect(match).toBeDefined();
    expect(match!.dir).toBe(overrideDir);
  });
});
