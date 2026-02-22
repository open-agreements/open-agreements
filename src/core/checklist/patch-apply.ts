import { ClosingChecklistSchema, type ClosingChecklist } from './schemas.js';
import { ChecklistPatchApplyRequestSchema, type ChecklistPatchApplyRequest } from './patch-schemas.js';
import {
  applyChecklistPatchOperations,
  computeChecklistPatchHash,
  getChecklistPatchValidationArtifact,
  getChecklistPatchValidationStore,
  type ChecklistPatchValidationDiagnostic,
  type ChecklistPatchValidationStore,
  type ResolvedChecklistPatchOperation,
} from './patch-validator.js';

export interface ChecklistAppliedPatchRecord {
  checklist_id: string;
  patch_id: string;
  patch_hash: string;
  applied_at_ms: number;
  revision_before: number;
  revision_after: number;
}

export interface ChecklistAppliedPatchStore {
  get(checklistId: string, patchId: string): Promise<ChecklistAppliedPatchRecord | null>;
  set(record: ChecklistAppliedPatchRecord): Promise<void>;
}

class InMemoryChecklistAppliedPatchStore implements ChecklistAppliedPatchStore {
  private readonly map = new Map<string, ChecklistAppliedPatchRecord>();

  private key(checklistId: string, patchId: string): string {
    return `${checklistId}:${patchId}`;
  }

  async get(checklistId: string, patchId: string): Promise<ChecklistAppliedPatchRecord | null> {
    return this.map.get(this.key(checklistId, patchId)) ?? null;
  }

  async set(record: ChecklistAppliedPatchRecord): Promise<void> {
    this.map.set(this.key(record.checklist_id, record.patch_id), record);
  }
}

let appliedPatchStore: ChecklistAppliedPatchStore | null = null;

export function setChecklistAppliedPatchStore(store: ChecklistAppliedPatchStore | null): void {
  appliedPatchStore = store;
}

export function getChecklistAppliedPatchStore(): ChecklistAppliedPatchStore {
  if (!appliedPatchStore) {
    appliedPatchStore = new InMemoryChecklistAppliedPatchStore();
  }
  return appliedPatchStore;
}

export type ChecklistPatchApplyErrorCode =
  | 'CHECKLIST_SCHEMA_INVALID'
  | 'APPLY_REQUEST_SCHEMA_INVALID'
  | 'VALIDATION_REQUIRED'
  | 'VALIDATION_MISMATCH'
  | 'REVISION_CONFLICT'
  | 'PATCH_ID_CONFLICT'
  | 'APPLY_OPERATION_FAILED'
  | 'POST_PATCH_SCHEMA_INVALID'
  | 'MODE_NOT_SUPPORTED';

export interface ChecklistPatchApplyFailure {
  ok: false;
  error_code: ChecklistPatchApplyErrorCode;
  message: string;
  diagnostics: ChecklistPatchValidationDiagnostic[];
}

export interface ChecklistPatchApplySuccess {
  ok: true;
  checklist: ClosingChecklist;
  previous_revision: number;
  new_revision: number;
  patch_id: string;
  patch_hash: string;
  idempotent_replay: boolean;
  resolved_operations: ResolvedChecklistPatchOperation[];
}

export type ChecklistPatchApplyResult = ChecklistPatchApplySuccess | ChecklistPatchApplyFailure;

export interface ApplyChecklistPatchInput {
  checklist_id: string;
  checklist: unknown;
  current_revision: number;
  request: unknown;
  now_ms?: number;
  validation_store?: ChecklistPatchValidationStore;
  applied_patch_store?: ChecklistAppliedPatchStore;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function issuePath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return '<root>';
  return path
    .map((segment) => (typeof segment === 'symbol' ? segment.toString() : String(segment)))
    .join('.');
}

function parsedChecklistOrFailure(checklist: unknown): { ok: true; checklist: ClosingChecklist } | ChecklistPatchApplyFailure {
  const parsed = ClosingChecklistSchema.safeParse(checklist);
  if (parsed.success) {
    return { ok: true, checklist: parsed.data };
  }
  return {
    ok: false,
    error_code: 'CHECKLIST_SCHEMA_INVALID',
    message: 'Checklist payload failed schema validation.',
    diagnostics: parsed.error.issues.map((issue) => ({
      code: 'CHECKLIST_SCHEMA_INVALID',
      message: issue.message,
      path: issuePath(issue.path),
    })),
  };
}

function parsedRequestOrFailure(request: unknown): { ok: true; request: ChecklistPatchApplyRequest } | ChecklistPatchApplyFailure {
  const parsed = ChecklistPatchApplyRequestSchema.safeParse(request);
  if (parsed.success) {
    return { ok: true, request: parsed.data };
  }
  return {
    ok: false,
    error_code: 'APPLY_REQUEST_SCHEMA_INVALID',
    message: 'Patch apply request failed schema validation.',
    diagnostics: parsed.error.issues.map((issue) => ({
      code: 'PATCH_SCHEMA_INVALID',
      message: issue.message,
      path: issuePath(issue.path),
    })),
  };
}

export async function applyChecklistPatch(input: ApplyChecklistPatchInput): Promise<ChecklistPatchApplyResult> {
  const checklistParsed = parsedChecklistOrFailure(input.checklist);
  if (!checklistParsed.ok) return checklistParsed;

  const requestParsed = parsedRequestOrFailure(input.request);
  if (!requestParsed.ok) return requestParsed;

  const request = requestParsed.request;
  if (request.patch.mode !== 'APPLY') {
    return {
      ok: false,
      error_code: 'MODE_NOT_SUPPORTED',
      message: `Patch mode "${request.patch.mode}" is not supported by apply; use validate/proposed flow.`,
      diagnostics: [],
    };
  }

  const patchHash = computeChecklistPatchHash(request.patch);
  const validationStore = input.validation_store ?? getChecklistPatchValidationStore();
  const validationArtifact = await getChecklistPatchValidationArtifact(request.validation_id, {
    now_ms: input.now_ms,
    store: validationStore,
  });

  if (!validationArtifact) {
    return {
      ok: false,
      error_code: 'VALIDATION_REQUIRED',
      message: 'Missing or expired validation_id. Re-run validate before apply.',
      diagnostics: [],
    };
  }

  if (validationArtifact.checklist_id !== input.checklist_id) {
    return {
      ok: false,
      error_code: 'VALIDATION_MISMATCH',
      message: 'validation_id does not belong to this checklist.',
      diagnostics: [],
    };
  }

  if (validationArtifact.patch_hash !== patchHash) {
    return {
      ok: false,
      error_code: 'VALIDATION_MISMATCH',
      message: 'Patch payload does not match the validated patch hash.',
      diagnostics: [],
    };
  }

  if (validationArtifact.patch_id !== request.patch.patch_id) {
    return {
      ok: false,
      error_code: 'VALIDATION_MISMATCH',
      message: 'Patch ID does not match the validated patch.',
      diagnostics: [],
    };
  }

  const appliedStore = input.applied_patch_store ?? getChecklistAppliedPatchStore();
  const existing = await appliedStore.get(input.checklist_id, request.patch.patch_id);
  if (existing) {
    if (existing.patch_hash === patchHash) {
      return {
        ok: true,
        checklist: checklistParsed.checklist,
        previous_revision: input.current_revision,
        new_revision: input.current_revision,
        patch_id: request.patch.patch_id,
        patch_hash: patchHash,
        idempotent_replay: true,
        resolved_operations: validationArtifact.resolved_operations,
      };
    }

    return {
      ok: false,
      error_code: 'PATCH_ID_CONFLICT',
      message: `patch_id "${request.patch.patch_id}" already exists with different payload hash.`,
      diagnostics: [],
    };
  }

  if (request.patch.expected_revision !== input.current_revision) {
    return {
      ok: false,
      error_code: 'REVISION_CONFLICT',
      message: `expected_revision ${request.patch.expected_revision} does not match current revision ${input.current_revision}.`,
      diagnostics: [],
    };
  }

  if (validationArtifact.expected_revision !== input.current_revision) {
    return {
      ok: false,
      error_code: 'REVISION_CONFLICT',
      message: `Validated revision ${validationArtifact.expected_revision} does not match current revision ${input.current_revision}.`,
      diagnostics: [],
    };
  }

  const updatedChecklist = cloneValue(checklistParsed.checklist);
  const applyResult = applyChecklistPatchOperations(updatedChecklist, request.patch.operations);
  if (!applyResult.ok) {
    return {
      ok: false,
      error_code: 'APPLY_OPERATION_FAILED',
      message: 'Patch operation failed during apply.',
      diagnostics: [applyResult.diagnostic],
    };
  }

  const postPatch = ClosingChecklistSchema.safeParse(updatedChecklist);
  if (!postPatch.success) {
    return {
      ok: false,
      error_code: 'POST_PATCH_SCHEMA_INVALID',
      message: 'Patched checklist failed schema validation.',
      diagnostics: postPatch.error.issues.map((issue) => ({
        code: 'POST_PATCH_SCHEMA_INVALID',
        message: issue.message,
        path: issuePath(issue.path),
      })),
    };
  }

  const appliedAt = input.now_ms ?? Date.now();
  await appliedStore.set({
    checklist_id: input.checklist_id,
    patch_id: request.patch.patch_id,
    patch_hash: patchHash,
    applied_at_ms: appliedAt,
    revision_before: input.current_revision,
    revision_after: input.current_revision + 1,
  });

  return {
    ok: true,
    checklist: postPatch.data,
    previous_revision: input.current_revision,
    new_revision: input.current_revision + 1,
    patch_id: request.patch.patch_id,
    patch_hash: patchHash,
    idempotent_replay: false,
    resolved_operations: applyResult.resolved_operations,
  };
}
