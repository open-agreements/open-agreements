import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors } from '../src/core/tools.js';

const it = itAllure.epic('Platform & Distribution');

function getStructuredContent(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

describe('contracts-workspace-mcp tools', () => {
  it.openspec('OA-215')('lists expected tools', () => {
    const names = listToolDescriptors().map((tool) => tool.name);
    expect(names).toEqual([
      'workspace_init',
      'catalog_validate',
      'catalog_fetch',
      'status_generate',
      'status_lint',
    ]);
  });

  it.openspec('OA-215')('returns workspace setup suggestions without mutating the filesystem', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-mcp-init-'));
    const result = await callTool('workspace_init', {
      root_dir: root,
      agents: ['claude'],
      topics: ['finance'],
    });
    const payload = getStructuredContent(result);

    expect(result.isError).toBeUndefined();
    expect(payload.root_dir).toBe(root);
    expect(payload.mode).toBe('suggest-only');
    expect((payload.missing_directories as string[])).toContain('finance');
    expect((payload.missing_directories as string[])).not.toContain('finance/forms');
    expect((payload.missing_files as string[])).toContain('CONTRACTS.md');
    expect(existsSync(join(root, 'finance'))).toBe(false);
    expect(existsSync(join(root, 'CONTRACTS.md'))).toBe(false);
  });

  it.openspec('OA-215')('reports invalid catalog entries with structured errors', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-mcp-catalog-'));
    const invalidCatalog = `
schema_version: 1
entries:
  - id: sample
    name: Sample
    source_url: https://example.com/sample.docx
    license:
      type: CC-BY-4.0
      redistribution: allowed-unmodified
`;
    writeFileSync(join(root, 'forms-catalog.yaml'), invalidCatalog.trimStart(), 'utf-8');

    const result = await callTool('catalog_validate', { root_dir: root });
    const payload = getStructuredContent(result);

    expect(result.isError).toBeUndefined();
    expect(payload.valid).toBe(false);
    expect(Array.isArray(payload.errors)).toBe(true);
  });

  it.openspec('OA-215')('generates status index and returns lint findings', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-mcp-status-'));
    for (const folder of ['forms', 'forms/corporate', 'drafts', 'incoming', 'executed', 'archive']) {
      mkdirSync(join(root, folder), { recursive: true });
    }

    writeFileSync(join(root, 'forms', 'corporate', 'example.pdf'), 'pdf', 'utf-8');

    const generated = await callTool('status_generate', { root_dir: root });
    const generatedPayload = getStructuredContent(generated);
    expect(generated.isError).toBeUndefined();
    expect(existsSync(join(root, 'contracts-index.yaml'))).toBe(true);
    expect((generatedPayload.summary as Record<string, unknown>).total_documents).toBe(1);

    const linted = await callTool('status_lint', { root_dir: root });
    const lintedPayload = getStructuredContent(linted);
    expect(linted.isError).toBeUndefined();
    expect(lintedPayload.error_count).toBe(1);
  });
});
