import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import {
  CATALOG_FILE,
  CONTRACTS_GUIDE_FILE,
  LIFECYCLE_DIRS,
} from '../src/core/constants.js';
import { initializeWorkspace, planWorkspaceInitialization } from '../src/core/workspace-structure.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Platform & Distribution');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('initializeWorkspace', () => {
  it.openspec(['OA-115', 'OA-118', 'OA-119'])(
    'creates config files and agent snippets but does not create lifecycle directories',
    () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-workspace-init-'));
    tempDirs.push(root);

    const result = initializeWorkspace(root, { agents: ['claude', 'gemini'] });

    // Lifecycle directories are NOT auto-created — they surface as lint warnings
    for (const lifecycle of LIFECYCLE_DIRS) {
      expect(existsSync(join(root, lifecycle))).toBe(false);
    }
    expect(existsSync(join(root, CONTRACTS_GUIDE_FILE))).toBe(true);
    expect(existsSync(join(root, CATALOG_FILE))).toBe(true);
    expect(existsSync(join(root, '.contracts-workspace', 'agents', 'claude.md'))).toBe(true);
    expect(existsSync(join(root, '.contracts-workspace', 'agents', 'gemini.md'))).toBe(true);

    expect(result.createdDirectories).not.toContain('forms');
    expect(result.createdFiles).toContain(CONTRACTS_GUIDE_FILE);
    expect(result.createdFiles).toContain(CATALOG_FILE);
    expect(result.agentInstructions.length).toBe(2);
    }
  );

  it.openspec('OA-116')('is idempotent when re-run', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-workspace-idempotent-'));
    tempDirs.push(root);

    initializeWorkspace(root, { agents: ['claude'] });
    const second = initializeWorkspace(root, { agents: ['claude'] });

    expect(second.createdDirectories.length).toBe(0);
    expect(second.createdFiles.length).toBe(0);
    expect(second.existingFiles).toContain(CONTRACTS_GUIDE_FILE);
    expect(second.existingFiles).toContain(CATALOG_FILE);
  });

  it.openspec('OA-117')('plans workspace setup without creating files or directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-workspace-plan-'));
    tempDirs.push(root);

    const plan = planWorkspaceInitialization(root, { agents: ['claude'], topics: ['finance'] });

    expect(plan.missingDirectories).toContain('finance');
    expect(plan.missingDirectories).not.toContain('finance/forms');
    expect(plan.missingFiles).toContain(CONTRACTS_GUIDE_FILE);
    expect(plan.missingFiles).toContain(CATALOG_FILE);
    expect(plan.suggestedCommands).toContain('open-agreements-workspace status lint');
    expect(existsSync(join(root, 'finance'))).toBe(false);
    expect(existsSync(join(root, CONTRACTS_GUIDE_FILE))).toBe(false);
  });
});
