import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appendJsonl, readJsonl } from './jsonl-stores.js';
import { ClosingChecklistSchema, type ClosingChecklist } from './schemas.js';

const STATE_ROOT = join(homedir(), '.open-agreements', 'checklists');

export const ChecklistStateSchema = z.object({
  checklist_id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  checklist: ClosingChecklistSchema,
});

export type ChecklistState = z.infer<typeof ChecklistStateSchema>;

export interface ChecklistMeta {
  deal_name: string;
  created_at: string;
  uuid: string;
}

export interface ChecklistSummary extends ChecklistMeta {
  revision: number;
  updated_at: string;
}

export interface HistoryRecord {
  patch_id: string;
  applied_at: string;
  revision_before: number;
  revision_after: number;
  operation_count: number;
}

function stateRoot(root?: string): string {
  return root ?? STATE_ROOT;
}

function checklistDir(uuid: string, root?: string): string {
  return join(stateRoot(root), uuid);
}

function statePath(uuid: string, root?: string): string {
  return join(checklistDir(uuid, root), 'state.json');
}

function metaPath(uuid: string, root?: string): string {
  return join(checklistDir(uuid, root), 'meta.json');
}

function historyPath(uuid: string, root?: string): string {
  return join(checklistDir(uuid, root), 'history.jsonl');
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

export function createChecklist(
  dealName: string,
  initialData?: ClosingChecklist,
  opts?: { root?: string },
): { uuid: string; dir: string } {
  const uuid = randomUUID();
  const dir = checklistDir(uuid, opts?.root);
  mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString().slice(0, 10);
  const checklist: ClosingChecklist = initialData ?? {
    deal_name: dealName,
    updated_at: now,
    documents: {},
    checklist_entries: {},
    action_items: {},
    issues: {},
  };

  const state: ChecklistState = {
    checklist_id: uuid,
    revision: 0,
    checklist,
  };

  const meta: ChecklistMeta = {
    deal_name: dealName,
    created_at: now,
    uuid,
  };

  writeJson(statePath(uuid, opts?.root), state);
  writeJson(metaPath(uuid, opts?.root), meta);

  return { uuid, dir };
}

export function listChecklists(opts?: { root?: string }): ChecklistSummary[] {
  const root = stateRoot(opts?.root);
  if (!existsSync(root)) return [];

  const entries = readdirSync(root, { withFileTypes: true });
  const results: ChecklistSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mp = metaPath(entry.name, opts?.root);
    const sp = statePath(entry.name, opts?.root);
    if (!existsSync(mp) || !existsSync(sp)) continue;

    try {
      const meta = readJson<ChecklistMeta>(mp);
      const state = readJson<ChecklistState>(sp);
      results.push({
        ...meta,
        revision: state.revision,
        updated_at: state.checklist.updated_at,
      });
    } catch {
      // Skip corrupt entries
    }
  }

  return results.sort((a, b) => a.deal_name.localeCompare(b.deal_name));
}

export function resolveChecklist(nameOrId: string, opts?: { root?: string }): string | null {
  const root = stateRoot(opts?.root);
  if (!existsSync(root)) return null;

  // Exact UUID match
  const exactDir = checklistDir(nameOrId, opts?.root);
  if (existsSync(join(exactDir, 'state.json'))) return nameOrId;

  // Fuzzy match by deal name
  const entries = readdirSync(root, { withFileTypes: true });
  const needle = nameOrId.toLowerCase();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mp = metaPath(entry.name, opts?.root);
    if (!existsSync(mp)) continue;

    try {
      const meta = readJson<ChecklistMeta>(mp);
      if (meta.deal_name.toLowerCase() === needle) return entry.name;
    } catch {
      // Skip
    }
  }

  // Substring match as fallback
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mp = metaPath(entry.name, opts?.root);
    if (!existsSync(mp)) continue;

    try {
      const meta = readJson<ChecklistMeta>(mp);
      if (meta.deal_name.toLowerCase().includes(needle)) return entry.name;
    } catch {
      // Skip
    }
  }

  return null;
}

export function getChecklistState(uuid: string, opts?: { root?: string }): ChecklistState {
  const path = statePath(uuid, opts?.root);
  return ChecklistStateSchema.parse(readJson(path));
}

export function saveChecklistState(uuid: string, state: ChecklistState, opts?: { root?: string }): void {
  writeJson(statePath(uuid, opts?.root), state);
}

export async function appendHistory(uuid: string, record: HistoryRecord, opts?: { root?: string }): Promise<void> {
  await appendJsonl(historyPath(uuid, opts?.root), record);
}

export function getHistory(uuid: string, opts?: { root?: string }): HistoryRecord[] {
  return readJsonl<HistoryRecord>(historyPath(uuid, opts?.root));
}
