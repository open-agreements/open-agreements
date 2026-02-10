import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CATALOG_FILE,
  CONTRACTS_GUIDE_FILE,
  LIFECYCLE_DIRS,
} from '../src/core/constants.js';
import { initializeWorkspace } from '../src/core/workspace-structure.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('initializeWorkspace', () => {
  it('creates lifecycle directories, guide, catalog, and optional agent snippets', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-workspace-init-'));
    tempDirs.push(root);

    const result = initializeWorkspace(root, { agents: ['claude', 'gemini'] });

    for (const lifecycle of LIFECYCLE_DIRS) {
      expect(existsSync(join(root, lifecycle))).toBe(true);
    }
    expect(existsSync(join(root, CONTRACTS_GUIDE_FILE))).toBe(true);
    expect(existsSync(join(root, CATALOG_FILE))).toBe(true);
    expect(existsSync(join(root, '.contracts-workspace', 'agents', 'claude.md'))).toBe(true);
    expect(existsSync(join(root, '.contracts-workspace', 'agents', 'gemini.md'))).toBe(true);

    expect(result.createdDirectories.length).toBeGreaterThan(0);
    expect(result.createdFiles).toContain(CONTRACTS_GUIDE_FILE);
    expect(result.createdFiles).toContain(CATALOG_FILE);
    expect(result.agentInstructions.length).toBe(2);
  });

  it('is idempotent when re-run', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-workspace-idempotent-'));
    tempDirs.push(root);

    initializeWorkspace(root, { agents: ['claude'] });
    const second = initializeWorkspace(root, { agents: ['claude'] });

    expect(second.createdDirectories.length).toBe(0);
    expect(second.createdFiles.length).toBe(0);
    expect(second.existingDirectories.length).toBeGreaterThan(0);
    expect(second.existingFiles).toContain(CONTRACTS_GUIDE_FILE);
    expect(second.existingFiles).toContain(CATALOG_FILE);
  });
});
