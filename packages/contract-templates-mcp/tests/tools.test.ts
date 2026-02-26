import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors } from '../src/core/tools.js';

const it = itAllure.epic('Platform & Distribution');

function getPayload(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

describe('contract-templates-mcp tools', () => {
  it.openspec('OA-DST-033')('lists expected tools', () => {
    const names = listToolDescriptors().map((tool) => tool.name);
    expect(names).toEqual([
      'list_templates',
      'get_template',
      'fill_template',
    ]);
  });

  it.openspec('OA-DST-033')('returns a full template list payload', async () => {
    const result = await callTool('list_templates', { mode: 'full' });
    const payload = getPayload(result);

    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    expect(payload.tool).toBe('list_templates');
    const data = payload.data as Record<string, unknown>;
    expect(data.mode).toBe('full');
    const templates = data.templates as Array<Record<string, unknown>>;
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
  });

  it.openspec('OA-DST-033')('returns TEMPLATE_NOT_FOUND for an unknown template id', async () => {
    const result = await callTool('get_template', { template_id: 'nonexistent-template-id' });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    expect(payload.tool).toBe('get_template');
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
  });
});
