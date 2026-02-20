import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const it = itAllure.epic('Platform & Distribution');

describe('SafeDocX externalization', () => {
  it.openspec('OA-067')('does not vendor safe-docx suite package directories', () => {
    const packageDirs = [
      'safe-docx',
      'docx-primitives',
      'docx-comparison',
      'safe-docx-mcpb',
    ];

    for (const dir of packageDirs) {
      expect(existsSync(join(ROOT, 'packages', dir))).toBe(false);
    }
  });

  it.openspec('OA-068')('configures mcp.json to use @usejunior/safedocx', () => {
    const mcpPath = join(ROOT, 'mcp.json');
    const parsed = JSON.parse(readFileSync(mcpPath, 'utf-8')) as {
      mcpServers?: Record<string, { args?: string[] }>;
    };
    const safeDocx = parsed.mcpServers?.['safe-docx'];

    expect(safeDocx).toBeDefined();
    expect(safeDocx?.args).toContain('@usejunior/safedocx');
  });
});
