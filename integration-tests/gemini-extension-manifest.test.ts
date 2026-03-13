import { describe, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MANIFEST_PATH = resolve(REPO_ROOT, 'gemini-extension.json');

describe('gemini extension manifest', () => {
  it.openspec('OA-DST-034')('includes strict required top-level fields', () => {
    const manifest = JSON.parse(
      readFileSync(MANIFEST_PATH, 'utf8'),
    ) as Record<string, unknown>;

    for (const key of ['name', 'version', 'description', 'contextFileName', 'entrypoint', 'mcpServers']) {
      expect(key in manifest).toBe(true);
    }
  });

  it.openspec('OA-DST-034')('defines local npx MCP servers without cwd overrides', () => {
    const manifest = JSON.parse(
      readFileSync(MANIFEST_PATH, 'utf8'),
    ) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; cwd?: string }>;
    };
    const servers = manifest.mcpServers ?? {};

    expect(Object.keys(servers).sort()).toEqual(['checklist-mcp', 'contract-templates-mcp', 'contracts-workspace-mcp']);
    for (const [key, server] of Object.entries(servers)) {
      expect(server.command).toBe('npx');
      expect(server.args).toContain(`@open-agreements/${key}`);
      expect(server.cwd).toBeUndefined();
    }
  });
});
