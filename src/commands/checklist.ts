import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import {
  ChecklistPatchApplyRequestSchema,
  ChecklistPatchEnvelopeSchema,
  ClosingChecklistSchema,
  applyChecklistPatch,
  buildChecklistTemplateContext,
  validateChecklistPatch,
  humanStatus,
  createChecklist as createChecklistState,
  listChecklists as listChecklistsState,
  resolveChecklist,
  getChecklistState,
  saveChecklistState,
  appendHistory,
  getHistory,
  type ChecklistAppliedPatchRecord,
  type ChecklistAppliedPatchStore,
  type ChecklistPatchValidationArtifact,
  type ChecklistPatchValidationStore,
  type ChecklistProposedPatchRecord,
  type ChecklistProposedPatchStore,
  type HistoryRecord,
} from '../core/checklist/index.js';
import { fillTemplate } from '../core/engine.js';
import { findTemplateDir } from '../utils/paths.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function loadJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ---------------------------------------------------------------------------
// JSON file-backed stores for patch-validate / patch-apply
// ---------------------------------------------------------------------------

class JsonFileValidationStore implements ChecklistPatchValidationStore {
  constructor(private readonly filePath: string) {}

  private load(): Record<string, ChecklistPatchValidationArtifact> {
    if (!existsSync(this.filePath)) return {};
    const raw = loadJsonFile(this.filePath);
    return typeof raw === 'object' && raw !== null ? raw as Record<string, ChecklistPatchValidationArtifact> : {};
  }

  private async save(data: Record<string, ChecklistPatchValidationArtifact>): Promise<void> {
    await writeJsonFile(this.filePath, data);
  }

  async set(artifact: ChecklistPatchValidationArtifact): Promise<void> {
    const data = this.load();
    data[artifact.validation_id] = artifact;
    await this.save(data);
  }

  async get(validationId: string): Promise<ChecklistPatchValidationArtifact | null> {
    return this.load()[validationId] ?? null;
  }

  async delete(validationId: string): Promise<void> {
    const data = this.load();
    delete data[validationId];
    await this.save(data);
  }
}

class JsonFileAppliedPatchStore implements ChecklistAppliedPatchStore {
  constructor(private readonly filePath: string) {}

  private key(checklistId: string, patchId: string): string {
    return `${checklistId}:${patchId}`;
  }

  private load(): Record<string, ChecklistAppliedPatchRecord> {
    if (!existsSync(this.filePath)) return {};
    const raw = loadJsonFile(this.filePath);
    return typeof raw === 'object' && raw !== null ? raw as Record<string, ChecklistAppliedPatchRecord> : {};
  }

  private async save(data: Record<string, ChecklistAppliedPatchRecord>): Promise<void> {
    await writeJsonFile(this.filePath, data);
  }

  async get(checklistId: string, patchId: string): Promise<ChecklistAppliedPatchRecord | null> {
    return this.load()[this.key(checklistId, patchId)] ?? null;
  }

  async set(record: ChecklistAppliedPatchRecord): Promise<void> {
    const data = this.load();
    data[this.key(record.checklist_id, record.patch_id)] = record;
    await this.save(data);
  }
}

class JsonFileProposedPatchStore implements ChecklistProposedPatchStore {
  constructor(private readonly filePath: string) {}

  private key(checklistId: string, patchId: string): string {
    return `${checklistId}:${patchId}`;
  }

  private load(): Record<string, ChecklistProposedPatchRecord> {
    if (!existsSync(this.filePath)) return {};
    const raw = loadJsonFile(this.filePath);
    return typeof raw === 'object' && raw !== null ? raw as Record<string, ChecklistProposedPatchRecord> : {};
  }

  private async save(data: Record<string, ChecklistProposedPatchRecord>): Promise<void> {
    await writeJsonFile(this.filePath, data);
  }

  async get(checklistId: string, patchId: string): Promise<ChecklistProposedPatchRecord | null> {
    return this.load()[this.key(checklistId, patchId)] ?? null;
  }

  async set(record: ChecklistProposedPatchRecord): Promise<void> {
    const data = this.load();
    data[this.key(record.checklist_id, record.patch_id)] = record;
    await this.save(data);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export interface ChecklistCreateArgs {
  dealName: string;
  data?: string;
}

export async function runChecklistCreate(args: ChecklistCreateArgs): Promise<void> {
  let initialData = undefined;
  if (args.data) {
    const raw = JSON.parse(readFileSync(args.data, 'utf-8'));
    const parsed = ClosingChecklistSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
      console.error(`Validation errors:\n${issues.join('\n')}`);
      process.exit(1);
    }
    initialData = parsed.data;
  }

  const { uuid } = createChecklistState(args.dealName, initialData);
  console.log(`Created checklist "${args.dealName}"`);
  console.log(`UUID: ${uuid}`);
}

export async function runChecklistList(): Promise<void> {
  const checklists = listChecklistsState();
  if (checklists.length === 0) {
    console.log('No checklists found.');
    return;
  }

  console.log('Checklists:\n');
  for (const c of checklists) {
    console.log(`  ${c.deal_name}`);
    console.log(`    UUID: ${c.uuid}`);
    console.log(`    Revision: ${c.revision}  Updated: ${c.updated_at}`);
    console.log('');
  }
}

export interface ChecklistShowArgs {
  nameOrId: string;
  json?: boolean;
}

export async function runChecklistShow(args: ChecklistShowArgs): Promise<void> {
  const uuid = resolveChecklist(args.nameOrId);
  if (!uuid) {
    console.error(`Checklist not found: "${args.nameOrId}"`);
    process.exit(1);
  }

  const state = getChecklistState(uuid);

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  const c = state.checklist;
  console.log(`${c.deal_name}`);
  console.log(`UUID: ${state.checklist_id}  Revision: ${state.revision}  Updated: ${c.updated_at}\n`);

  const entries = Object.values(c.checklist_entries);
  const documents = Object.values(c.documents);
  const actions = Object.values(c.action_items);
  const issues = Object.values(c.issues);

  console.log(`Documents: ${documents.length}  Entries: ${entries.length}  Actions: ${actions.length}  Issues: ${issues.length}\n`);

  for (const entry of entries) {
    const status = humanStatus(entry.status);
    const responsible = entry.responsible_party
      ? [entry.responsible_party.individual_name, entry.responsible_party.organization].filter(Boolean).join(', ')
      : '';
    console.log(`  [${status}] ${entry.title}${responsible ? `  (${responsible})` : ''}`);
  }
}

export interface ChecklistUpdateArgs {
  nameOrId: string;
  data: string;
}

export async function runChecklistUpdate(args: ChecklistUpdateArgs): Promise<void> {
  const uuid = resolveChecklist(args.nameOrId);
  if (!uuid) {
    console.error(`Checklist not found: "${args.nameOrId}"`);
    process.exit(1);
  }

  const state = getChecklistState(uuid);
  const patchRaw = loadJsonFile(args.data);

  const patchParsed = ChecklistPatchEnvelopeSchema.safeParse(patchRaw);
  if (!patchParsed.success) {
    const issues = patchParsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    console.error(`Patch validation errors:\n${issues.join('\n')}`);
    process.exit(1);
  }

  // Step 1: Validate (ephemeral, in-memory)
  const validationResult = await validateChecklistPatch({
    checklist_id: state.checklist_id,
    checklist: state.checklist,
    current_revision: state.revision,
    patch: patchParsed.data,
  });

  if (!validationResult.ok) {
    console.error('Patch validation failed:');
    for (const d of validationResult.diagnostics) {
      console.error(`  [${d.code}] ${d.message}${d.path ? ` (${d.path})` : ''}`);
    }
    process.exit(1);
  }

  // Step 2: Apply
  const applyRequest = {
    validation_id: validationResult.validation_id,
    patch: patchParsed.data,
  };

  const applyResult = await applyChecklistPatch({
    checklist_id: state.checklist_id,
    checklist: state.checklist,
    current_revision: state.revision,
    request: applyRequest,
  });

  if (!applyResult.ok) {
    console.error('Patch apply failed:');
    console.error(JSON.stringify(applyResult, null, 2));
    process.exit(1);
  }

  if (applyResult.applied && !applyResult.idempotent_replay) {
    // Auto-set updated_at
    applyResult.checklist.updated_at = new Date().toISOString().slice(0, 10);

    const nextState = {
      checklist_id: state.checklist_id,
      revision: applyResult.new_revision,
      checklist: applyResult.checklist,
    };
    saveChecklistState(uuid, nextState);

    const historyRecord: HistoryRecord = {
      patch_id: patchParsed.data.patch_id,
      applied_at: new Date().toISOString(),
      revision_before: state.revision,
      revision_after: applyResult.new_revision,
      operation_count: patchParsed.data.operations.length,
    };
    await appendHistory(uuid, historyRecord);

    console.log(`Applied patch "${patchParsed.data.patch_id}" to "${state.checklist.deal_name}"`);
    console.log(`Revision: ${state.revision} → ${applyResult.new_revision}`);
  } else {
    console.log('Checklist state unchanged (idempotent replay).');
  }
}

export interface ChecklistRenderArgs {
  nameOrId: string;
  output?: string;
}

export async function runChecklistRender(args: ChecklistRenderArgs): Promise<void> {
  const uuid = resolveChecklist(args.nameOrId);
  if (!uuid) {
    console.error(`Checklist not found: "${args.nameOrId}"`);
    process.exit(1);
  }

  const state = getChecklistState(uuid);
  const outputPath = resolve(args.output ?? 'closing-checklist.docx');

  const templateDir = findTemplateDir('closing-checklist');
  if (!templateDir) {
    console.error('Error: closing-checklist template not found');
    process.exit(1);
  }

  await fillTemplate({
    templateDir,
    values: buildChecklistTemplateContext(state.checklist) as unknown as Record<string, unknown>,
    outputPath,
  });

  console.log(`Rendered checklist for "${state.checklist.deal_name}"`);
  console.log(`Output: ${outputPath}`);
}

export interface ChecklistHistoryArgs {
  nameOrId: string;
}

export async function runChecklistHistory(args: ChecklistHistoryArgs): Promise<void> {
  const uuid = resolveChecklist(args.nameOrId);
  if (!uuid) {
    console.error(`Checklist not found: "${args.nameOrId}"`);
    process.exit(1);
  }

  const history = getHistory(uuid);
  if (history.length === 0) {
    console.log('No update history.');
    return;
  }

  console.log('Update history:\n');
  for (const record of history) {
    console.log(`  ${record.applied_at}  ${record.patch_id}`);
    console.log(`    Revision: ${record.revision_before} → ${record.revision_after}  Operations: ${record.operation_count}`);
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Advanced subcommands: patch-validate, patch-apply
// ---------------------------------------------------------------------------

export interface ChecklistPatchValidateArgs {
  state: string;
  patch: string;
  output?: string;
  validationStore?: string;
}

export interface ChecklistPatchApplyArgs {
  state: string;
  request: string;
  output?: string;
  validationStore?: string;
  appliedStore?: string;
  proposedStore?: string;
}

const ChecklistStateFileSchema = z.object({
  checklist_id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  checklist: ClosingChecklistSchema,
});

export async function runChecklistPatchValidate(args: ChecklistPatchValidateArgs): Promise<void> {
  const state = ChecklistStateFileSchema.parse(loadJsonFile(args.state));
  const patchRaw = loadJsonFile(args.patch);

  const patchParsed = ChecklistPatchEnvelopeSchema.safeParse(patchRaw);
  if (!patchParsed.success) {
    const issues = patchParsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    console.error(`Patch validation errors:\n${issues.join('\n')}`);
    process.exit(1);
  }

  const store = args.validationStore ? new JsonFileValidationStore(resolve(args.validationStore)) : undefined;
  const result = await validateChecklistPatch({
    checklist_id: state.checklist_id,
    checklist: state.checklist,
    current_revision: state.revision,
    patch: patchParsed.data,
    store,
  });

  if (args.output) {
    const out = resolve(args.output);
    await writeJsonFile(out, result);
    console.log(`Patch validation result written to: ${out}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (!result.ok) {
    process.exit(1);
  }
}

export async function runChecklistPatchApply(args: ChecklistPatchApplyArgs): Promise<void> {
  const statePath = resolve(args.state);
  const state = ChecklistStateFileSchema.parse(loadJsonFile(statePath));
  const requestRaw = loadJsonFile(args.request);

  const requestParsed = ChecklistPatchApplyRequestSchema.safeParse(requestRaw);
  if (!requestParsed.success) {
    const issues = requestParsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    console.error(`Patch apply request errors:\n${issues.join('\n')}`);
    process.exit(1);
  }

  const validationStore = args.validationStore
    ? new JsonFileValidationStore(resolve(args.validationStore))
    : undefined;
  const appliedPatchStore = args.appliedStore
    ? new JsonFileAppliedPatchStore(resolve(args.appliedStore))
    : undefined;
  const proposedPatchStore = args.proposedStore
    ? new JsonFileProposedPatchStore(resolve(args.proposedStore))
    : undefined;

  const result = await applyChecklistPatch({
    checklist_id: state.checklist_id,
    checklist: state.checklist,
    current_revision: state.revision,
    request: requestParsed.data,
    validation_store: validationStore,
    applied_patch_store: appliedPatchStore,
    proposed_patch_store: proposedPatchStore,
  });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const shouldUpdateState = result.applied && !result.idempotent_replay;
  if (shouldUpdateState) {
    const nextState = {
      checklist_id: state.checklist_id,
      revision: result.new_revision,
      checklist: result.checklist,
    };
    await writeJsonFile(statePath, nextState);
    console.log(`Checklist state updated: ${statePath}`);
  } else {
    console.log('Checklist state unchanged.');
  }

  if (args.output) {
    const out = resolve(args.output);
    await writeJsonFile(out, result);
    console.log(`Patch apply result written to: ${out}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
