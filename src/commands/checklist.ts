import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  ChecklistPatchApplyRequestSchema,
  ChecklistPatchEnvelopeSchema,
  ClosingChecklistSchema,
  applyChecklistPatch,
  buildChecklistTemplateContext,
  type ChecklistAppliedPatchRecord,
  type ChecklistAppliedPatchStore,
  type ChecklistPatchValidationArtifact,
  type ChecklistPatchValidationStore,
  type ChecklistProposedPatchRecord,
  type ChecklistProposedPatchStore,
  validateChecklistPatch,
} from '../core/checklist/index.js';
import { fillTemplate } from '../core/engine.js';
import { findTemplateDir } from '../utils/paths.js';

export interface ChecklistCreateArgs {
  data: string;
  output?: string;
}

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

const ChecklistStateSchema = z.object({
  checklist_id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  checklist: ClosingChecklistSchema,
});

type ChecklistState = z.infer<typeof ChecklistStateSchema>;

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function loadJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

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
    const data = this.load();
    return data[validationId] ?? null;
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
    const data = this.load();
    return data[this.key(checklistId, patchId)] ?? null;
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
    const data = this.load();
    return data[this.key(checklistId, patchId)] ?? null;
  }

  async set(record: ChecklistProposedPatchRecord): Promise<void> {
    const data = this.load();
    data[this.key(record.checklist_id, record.patch_id)] = record;
    await this.save(data);
  }
}

export async function runChecklistCreate(args: ChecklistCreateArgs): Promise<void> {
  const raw = JSON.parse(readFileSync(args.data, 'utf-8'));
  const outputPath = resolve(args.output ?? 'closing-checklist.docx');

  // Pre-validate with the Zod schema for good error messages
  const parseResult = ClosingChecklistSchema.safeParse(raw);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(
      (i) => `  ${i.path.join('.')}: ${i.message}`
    );
    console.error(`Validation errors:\n${issues.join('\n')}`);
    process.exit(1);
  }

  const c = parseResult.data;

  try {
    const templateDir = findTemplateDir('closing-checklist');
    if (!templateDir) {
      console.error('Error: closing-checklist template not found');
      process.exit(1);
    }

    await fillTemplate({
      templateDir,
      values: buildChecklistTemplateContext(c) as unknown as Record<string, unknown>,
      outputPath,
    });

    const countItems = (collection: unknown[] | Record<string, unknown>) =>
      Array.isArray(collection) ? collection.length : Object.keys(collection).length;

    console.log(`Created closing checklist for "${c.deal_name}"`);
    console.log(`Output: ${outputPath}`);
    console.log(`Documents: ${countItems(c.documents)}`);
    console.log(`Checklist entries: ${countItems(c.checklist_entries)}`);
    console.log(`Action items: ${countItems(c.action_items)}`);
    console.log(`Issues: ${countItems(c.issues)}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export async function runChecklistPatchValidate(args: ChecklistPatchValidateArgs): Promise<void> {
  const state = ChecklistStateSchema.parse(loadJsonFile(args.state));
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
  const state = ChecklistStateSchema.parse(loadJsonFile(statePath));
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
    const nextState: ChecklistState = {
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
