import { describe, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');
const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);

describe('gemini extension manifest', () => {
  it.openspec('OA-DST-034')('includes strict required top-level fields', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'gemini-extension.json'), 'utf8'),
    ) as Record<string, unknown>;

    for (const key of ['name', 'version', 'description', 'contextFileName', 'entrypoint', 'mcpServers']) {
      expect(key in manifest).toBe(true);
    }
  });

  it.openspec('OA-DST-034')('defines two local npx MCP servers without cwd overrides', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'gemini-extension.json'), 'utf8'),
    ) as {
      mcpServers?: Record<string, { command?: string; args?: string[]; cwd?: string }>;
    };
    const servers = manifest.mcpServers ?? {};

    expect(Object.keys(servers).sort()).toEqual(['contract-templates-mcp', 'contracts-workspace-mcp']);
    expect(servers['contracts-workspace-mcp'].command).toBe('npx');
    expect(servers['contracts-workspace-mcp'].args).toContain('@open-agreements/contracts-workspace-mcp');
    expect(servers['contract-templates-mcp'].command).toBe('npx');
    expect(servers['contract-templates-mcp'].args).toContain('@open-agreements/contract-templates-mcp');
    expect(servers['contracts-workspace-mcp'].cwd).toBeUndefined();
    expect(servers['contract-templates-mcp'].cwd).toBeUndefined();
  });
});
