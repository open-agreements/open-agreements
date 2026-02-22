import { createHash, randomUUID } from 'node:crypto';
import { ClosingChecklistSchema, type ClosingChecklist } from './schemas.js';
import { ChecklistPatchEnvelopeSchema, type ChecklistPatchEnvelope, type ChecklistPatchOperation } from './patch-schemas.js';

export const CHECKLIST_PATCH_VALIDATION_TTL_MS = 10 * 60 * 1000;

export type ChecklistPatchValidationErrorCode =
  | 'CHECKLIST_SCHEMA_INVALID'
  | 'PATCH_SCHEMA_INVALID'
  | 'REVISION_CONFLICT'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_PATH_INVALID'
  | 'TARGET_PARENT_INVALID'
  | 'POST_PATCH_SCHEMA_INVALID';

export interface ChecklistPatchValidationDiagnostic {
  code: ChecklistPatchValidationErrorCode;
  message: string;
  path?: string;
  operation_index?: number;
}

export interface ResolvedChecklistPatchOperation {
  operation_index: number;
  op: ChecklistPatchOperation['op'];
  path: string;
  parent_path: string;
  parent_container: 'object' | 'array';
  target_exists_before: boolean;
}

export interface ChecklistPatchValidationArtifact {
  validation_id: string;
  checklist_id: string;
  patch_id: string;
  patch_hash: string;
  expected_revision: number;
  created_at_ms: number;
  expires_at_ms: number;
  resolved_operations: ResolvedChecklistPatchOperation[];
}

export interface ChecklistPatchValidationStore {
  set(artifact: ChecklistPatchValidationArtifact): Promise<void>;
  get(validationId: string): Promise<ChecklistPatchValidationArtifact | null>;
  delete(validationId: string): Promise<void>;
}

class InMemoryChecklistPatchValidationStore implements ChecklistPatchValidationStore {
  private readonly map = new Map<string, ChecklistPatchValidationArtifact>();

  async set(artifact: ChecklistPatchValidationArtifact): Promise<void> {
    this.map.set(artifact.validation_id, artifact);
  }

  async get(validationId: string): Promise<ChecklistPatchValidationArtifact | null> {
    return this.map.get(validationId) ?? null;
  }

  async delete(validationId: string): Promise<void> {
    this.map.delete(validationId);
  }
}

let validationStore: ChecklistPatchValidationStore | null = null;

export function setChecklistPatchValidationStore(store: ChecklistPatchValidationStore | null): void {
  validationStore = store;
}

export function getChecklistPatchValidationStore(): ChecklistPatchValidationStore {
  if (!validationStore) {
    validationStore = new InMemoryChecklistPatchValidationStore();
  }
  return validationStore;
}

export interface ValidateChecklistPatchInput {
  checklist_id: string;
  checklist: unknown;
  current_revision: number;
  patch: unknown;
  now_ms?: number;
  validation_ttl_ms?: number;
  store?: ChecklistPatchValidationStore;
}

export interface ChecklistPatchValidationSuccess {
  ok: true;
  validation_id: string;
  patch_hash: string;
  patch: ChecklistPatchEnvelope;
  resolved_operations: ResolvedChecklistPatchOperation[];
  resulting_state_valid: true;
  artifact_expires_at_ms: number;
}

export interface ChecklistPatchValidationFailure {
  ok: false;
  diagnostics: ChecklistPatchValidationDiagnostic[];
  patch?: ChecklistPatchEnvelope;
  resolved_operations: ResolvedChecklistPatchOperation[];
}

export type ChecklistPatchValidationResult = ChecklistPatchValidationSuccess | ChecklistPatchValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(',')}}`;
}

export function computeChecklistPatchHash(patch: ChecklistPatchEnvelope): string {
  return createHash('sha256').update(stableStringify(patch)).digest('hex');
}

function decodePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function decodePointer(path: string): string[] {
  return path.split('/').slice(1).map(decodePointerToken);
}

function encodePointer(tokens: string[]): string {
  if (tokens.length === 0) return '';
  return `/${tokens.map((token) => token.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
}

function parseArrayIndex(token: string): number | null {
  if (!/^(0|[1-9][0-9]*)$/.test(token)) {
    return null;
  }
  return Number(token);
}

interface ParentResolutionSuccess {
  ok: true;
  parent: unknown;
  parentPath: string;
  finalToken: string;
}

interface ParentResolutionFailure {
  ok: false;
  code: 'TARGET_NOT_FOUND' | 'TARGET_PATH_INVALID' | 'TARGET_PARENT_INVALID';
  message: string;
  path: string;
}

type ParentResolution = ParentResolutionSuccess | ParentResolutionFailure;

function resolveParent(root: unknown, path: string): ParentResolution {
  const tokens = decodePointer(path);
  if (tokens.length === 0) {
    return {
      ok: false,
      code: 'TARGET_PATH_INVALID',
      message: 'root path operations are not supported',
      path,
    };
  }

  let current: unknown = root;
  const parentTokens: string[] = [];

  for (const token of tokens.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(token);
      if (index === null) {
        return {
          ok: false,
          code: 'TARGET_PATH_INVALID',
          message: `array path segment "${token}" is not a valid index`,
          path: encodePointer(parentTokens.concat(token)),
        };
      }
      if (index < 0 || index >= current.length) {
        return {
          ok: false,
          code: 'TARGET_NOT_FOUND',
          message: `array index ${index} is out of bounds`,
          path: encodePointer(parentTokens.concat(token)),
        };
      }
      current = current[index];
      parentTokens.push(token);
      continue;
    }

    if (isRecord(current)) {
      if (!(token in current)) {
        return {
          ok: false,
          code: 'TARGET_NOT_FOUND',
          message: `object key "${token}" does not exist`,
          path: encodePointer(parentTokens.concat(token)),
        };
      }
      current = current[token];
      parentTokens.push(token);
      continue;
    }

    return {
      ok: false,
      code: 'TARGET_PARENT_INVALID',
      message: 'path traverses through a non-container value',
      path: encodePointer(parentTokens),
    };
  }

  return {
    ok: true,
    parent: current,
    parentPath: encodePointer(parentTokens),
    finalToken: tokens[tokens.length - 1]!,
  };
}

type ApplyOperationSuccess = {
  ok: true;
  resolved: ResolvedChecklistPatchOperation;
};

type ApplyOperationFailure = {
  ok: false;
  diagnostic: ChecklistPatchValidationDiagnostic;
};

function applyOperationDryRun(
  root: ClosingChecklist,
  operation: ChecklistPatchOperation,
  operationIndex: number,
): ApplyOperationSuccess | ApplyOperationFailure {
  const parentResult = resolveParent(root, operation.path);
  if (!parentResult.ok) {
    return {
      ok: false,
      diagnostic: {
        code: parentResult.code,
        message: parentResult.message,
        path: parentResult.path,
        operation_index: operationIndex,
      },
    };
  }

  const { parent, parentPath, finalToken } = parentResult;

  if (Array.isArray(parent)) {
    if (finalToken === '-') {
      if (operation.op !== 'add') {
        return {
          ok: false,
          diagnostic: {
            code: 'TARGET_PATH_INVALID',
            message: `"${operation.op}" cannot target "-" append index`,
            path: operation.path,
            operation_index: operationIndex,
          },
        };
      }

      parent.push(cloneValue(operation.value));
      return {
        ok: true,
        resolved: {
          operation_index: operationIndex,
          op: operation.op,
          path: operation.path,
          parent_path: parentPath,
          parent_container: 'array',
          target_exists_before: false,
        },
      };
    }

    const index = parseArrayIndex(finalToken);
    if (index === null) {
      return {
        ok: false,
        diagnostic: {
          code: 'TARGET_PATH_INVALID',
          message: `array segment "${finalToken}" is not a valid index`,
          path: operation.path,
          operation_index: operationIndex,
        },
      };
    }

    if (operation.op === 'add') {
      if (index < 0 || index > parent.length) {
        return {
          ok: false,
          diagnostic: {
            code: 'TARGET_NOT_FOUND',
            message: `array index ${index} is out of bounds for add`,
            path: operation.path,
            operation_index: operationIndex,
          },
        };
      }
      const existed = index < parent.length;
      parent.splice(index, 0, cloneValue(operation.value));
      return {
        ok: true,
        resolved: {
          operation_index: operationIndex,
          op: operation.op,
          path: operation.path,
          parent_path: parentPath,
          parent_container: 'array',
          target_exists_before: existed,
        },
      };
    }

    if (index < 0 || index >= parent.length) {
      return {
        ok: false,
        diagnostic: {
          code: 'TARGET_NOT_FOUND',
          message: `array index ${index} does not exist`,
          path: operation.path,
          operation_index: operationIndex,
        },
      };
    }

    if (operation.op === 'replace') {
      parent[index] = cloneValue(operation.value);
    } else {
      parent.splice(index, 1);
    }

    return {
      ok: true,
      resolved: {
        operation_index: operationIndex,
        op: operation.op,
        path: operation.path,
        parent_path: parentPath,
        parent_container: 'array',
        target_exists_before: true,
      },
    };
  }

  if (!isRecord(parent)) {
    return {
      ok: false,
      diagnostic: {
        code: 'TARGET_PARENT_INVALID',
        message: 'target parent is not an object or array',
        path: parentPath,
        operation_index: operationIndex,
      },
    };
  }

  const existed = Object.prototype.hasOwnProperty.call(parent, finalToken);
  if (operation.op !== 'add' && !existed) {
    return {
      ok: false,
      diagnostic: {
        code: 'TARGET_NOT_FOUND',
        message: `object key "${finalToken}" does not exist`,
        path: operation.path,
        operation_index: operationIndex,
      },
    };
  }

  if (operation.op === 'remove') {
    delete parent[finalToken];
  } else {
    parent[finalToken] = cloneValue(operation.value);
  }

  return {
    ok: true,
    resolved: {
      operation_index: operationIndex,
      op: operation.op,
      path: operation.path,
      parent_path: parentPath,
      parent_container: 'object',
      target_exists_before: existed,
    },
  };
}

export type ChecklistPatchOperationApplyResult =
  | { ok: true; resolved_operations: ResolvedChecklistPatchOperation[] }
  | { ok: false; diagnostic: ChecklistPatchValidationDiagnostic };

export function applyChecklistPatchOperations(
  root: ClosingChecklist,
  operations: ChecklistPatchOperation[],
): ChecklistPatchOperationApplyResult {
  const resolvedOperations: ResolvedChecklistPatchOperation[] = [];

  for (const [index, operation] of operations.entries()) {
    const applyResult = applyOperationDryRun(root, operation, index);
    if (!applyResult.ok) {
      return { ok: false, diagnostic: applyResult.diagnostic };
    }
    resolvedOperations.push(applyResult.resolved);
  }

  return { ok: true, resolved_operations: resolvedOperations };
}

function issuePath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return '<root>';
  return path
    .map((segment) => (typeof segment === 'symbol' ? segment.toString() : String(segment)))
    .join('.');
}

export async function getChecklistPatchValidationArtifact(
  validationId: string,
  opts?: {
    now_ms?: number;
    store?: ChecklistPatchValidationStore;
  },
): Promise<ChecklistPatchValidationArtifact | null> {
  const store = opts?.store ?? getChecklistPatchValidationStore();
  const now = opts?.now_ms ?? Date.now();
  const artifact = await store.get(validationId);
  if (!artifact) return null;
  if (artifact.expires_at_ms <= now) {
    await store.delete(validationId);
    return null;
  }
  return artifact;
}

export async function validateChecklistPatch(input: ValidateChecklistPatchInput): Promise<ChecklistPatchValidationResult> {
  const diagnostics: ChecklistPatchValidationDiagnostic[] = [];
  let resolvedOperations: ResolvedChecklistPatchOperation[] = [];

  const checklistResult = ClosingChecklistSchema.safeParse(input.checklist);
  if (!checklistResult.success) {
    diagnostics.push(
      ...checklistResult.error.issues.map((issue) => ({
        code: 'CHECKLIST_SCHEMA_INVALID' as const,
        message: issue.message,
        path: issuePath(issue.path),
      })),
    );
    return { ok: false, diagnostics, resolved_operations: resolvedOperations };
  }

  const patchResult = ChecklistPatchEnvelopeSchema.safeParse(input.patch);
  if (!patchResult.success) {
    diagnostics.push(
      ...patchResult.error.issues.map((issue) => ({
        code: 'PATCH_SCHEMA_INVALID' as const,
        message: issue.message,
        path: issuePath(issue.path),
      })),
    );
    return { ok: false, diagnostics, resolved_operations: resolvedOperations };
  }

  const patch = patchResult.data;
  if (patch.expected_revision !== input.current_revision) {
    diagnostics.push({
      code: 'REVISION_CONFLICT',
      message: `expected_revision ${patch.expected_revision} does not match current revision ${input.current_revision}`,
      path: 'expected_revision',
    });
    return { ok: false, diagnostics, patch, resolved_operations: resolvedOperations };
  }

  const simulatedChecklist = cloneValue(checklistResult.data);

  const applyResult = applyChecklistPatchOperations(simulatedChecklist, patch.operations);
  if (!applyResult.ok) {
    diagnostics.push(applyResult.diagnostic);
    return { ok: false, diagnostics, patch, resolved_operations: resolvedOperations };
  }
  resolvedOperations = applyResult.resolved_operations;

  const postPatchResult = ClosingChecklistSchema.safeParse(simulatedChecklist);
  if (!postPatchResult.success) {
    diagnostics.push(
      ...postPatchResult.error.issues.map((issue) => ({
        code: 'POST_PATCH_SCHEMA_INVALID' as const,
        message: issue.message,
        path: issuePath(issue.path),
      })),
    );
    return { ok: false, diagnostics, patch, resolved_operations: resolvedOperations };
  }

  const now = input.now_ms ?? Date.now();
  const ttl = input.validation_ttl_ms ?? CHECKLIST_PATCH_VALIDATION_TTL_MS;
  const validationId = `val_${randomUUID().replace(/-/g, '')}`;
  const patchHash = computeChecklistPatchHash(patch);

  const artifact: ChecklistPatchValidationArtifact = {
    validation_id: validationId,
    checklist_id: input.checklist_id,
    patch_id: patch.patch_id,
    patch_hash: patchHash,
    expected_revision: patch.expected_revision,
    created_at_ms: now,
    expires_at_ms: now + ttl,
    resolved_operations: resolvedOperations,
  };

  const store = input.store ?? getChecklistPatchValidationStore();
  await store.set(artifact);

  return {
    ok: true,
    validation_id: validationId,
    patch_hash: patchHash,
    patch,
    resolved_operations: resolvedOperations,
    resulting_state_valid: true,
    artifact_expires_at_ms: artifact.expires_at_ms,
  };
}
