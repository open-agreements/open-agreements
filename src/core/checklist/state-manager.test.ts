import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createChecklist,
  listChecklists,
  resolveChecklist,
  getChecklistState,
  saveChecklistState,
  appendHistory,
  getHistory,
} from './state-manager.js';

const tempDirs: string[] = [];

function makeTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-state-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('state-manager', () => {
  it('creates a checklist with default empty data', () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Acme / Apex NDA', undefined, { root });

    expect(uuid).toMatch(/^[0-9a-f-]{36}$/);

    const state = getChecklistState(uuid, { root });
    expect(state.checklist_id).toBe(uuid);
    expect(state.revision).toBe(0);
    expect(state.checklist.deal_name).toBe('Acme / Apex NDA');
  });

  it('creates a checklist with initial data', () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Series A', {
      deal_name: 'Series A',
      updated_at: '2026-02-28',
      documents: {
        'doc-spa': { document_id: 'doc-spa', title: 'SPA', labels: [] },
      },
      checklist_entries: {},
      action_items: {},
      issues: {},
    }, { root });

    const state = getChecklistState(uuid, { root });
    expect(Object.keys(state.checklist.documents)).toHaveLength(1);
  });

  it('lists checklists', () => {
    const root = makeTempRoot();
    createChecklist('Deal A', undefined, { root });
    createChecklist('Deal B', undefined, { root });

    const list = listChecklists({ root });
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.deal_name).sort()).toEqual(['Deal A', 'Deal B']);
  });

  it('resolves by exact UUID', () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Test Deal', undefined, { root });

    expect(resolveChecklist(uuid, { root })).toBe(uuid);
  });

  it('resolves by deal name (case-insensitive)', () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Acme NDA', undefined, { root });

    expect(resolveChecklist('acme nda', { root })).toBe(uuid);
  });

  it('resolves by substring match', () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Acme / Apex NDA v2', undefined, { root });

    expect(resolveChecklist('Apex NDA', { root })).toBe(uuid);
  });

  it('returns null for unresolvable name', () => {
    const root = makeTempRoot();
    expect(resolveChecklist('nonexistent', { root })).toBeNull();
  });

  it('saves and reads state', () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Test', undefined, { root });

    const state = getChecklistState(uuid, { root });
    state.revision = 5;
    state.checklist.updated_at = '2026-03-01';
    saveChecklistState(uuid, state, { root });

    const reloaded = getChecklistState(uuid, { root });
    expect(reloaded.revision).toBe(5);
    expect(reloaded.checklist.updated_at).toBe('2026-03-01');
  });

  it('appends and reads history', async () => {
    const root = makeTempRoot();
    const { uuid } = createChecklist('Test', undefined, { root });

    await appendHistory(uuid, {
      patch_id: 'p1',
      applied_at: '2026-02-28T10:00:00Z',
      revision_before: 0,
      revision_after: 1,
      operation_count: 3,
    }, { root });

    await appendHistory(uuid, {
      patch_id: 'p2',
      applied_at: '2026-02-28T11:00:00Z',
      revision_before: 1,
      revision_after: 2,
      operation_count: 1,
    }, { root });

    const history = getHistory(uuid, { root });
    expect(history).toHaveLength(2);
    expect(history[0].patch_id).toBe('p1');
    expect(history[1].patch_id).toBe('p2');
  });
});
