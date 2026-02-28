import { describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allurePrettyJsonAttachment,
  allureStep,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';
import {
  renderChecklistDocx,
  attachChecklistDocxPreview,
} from '../../../integration-tests/helpers/docx-evidence.js';
import {
  CHECKLIST_PATCH_VALIDATION_TTL_MS,
  getChecklistPatchValidationArtifact,
  setChecklistPatchValidationStore,
  validateChecklistPatch,
  applyChecklistPatchOperations,
} from './patch-validator.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Patch Validation' });

type ValidateChecklistPatchArgs = Parameters<typeof validateChecklistPatch>[0];
type ValidateChecklistPatchResult = Awaited<ReturnType<typeof validateChecklistPatch>>;

async function validateWithEvidence(
  label: string,
  input: ValidateChecklistPatchArgs,
): Promise<ValidateChecklistPatchResult> {
  const slug = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  await allureStep(`Given ${label} input payload`, async () => {
    await allurePrettyJsonAttachment(`${slug}-input-pretty.html`, input);
    await allureJsonAttachment(`${slug}-input.json`, input);
    const docx = await renderChecklistDocx(input.checklist);
    await attachChecklistDocxPreview(
      `${slug}-checklist-before-word-like.html`,
      docx,
      { title: 'Checklist before patch validation' },
    );
  });

  const result = await allureStep(`When validateChecklistPatch runs for ${label}`, async () =>
    validateChecklistPatch(input)
  );

  await allurePrettyJsonAttachment(`${slug}-result-pretty.html`, result);
  await allureJsonAttachment(`${slug}-result.json`, result);
  return result;
}

describe('validateChecklistPatch', () => {
  const baseChecklist = {
    deal_name: 'Project Atlas',
    updated_at: '2026-02-22',
    documents: {
      'doc-spa': {
        document_id: 'doc-spa',
        title: 'Stock Purchase Agreement',
      },
    },
    checklist_entries: {
      'entry-spa': {
        entry_id: 'entry-spa',
        document_id: 'doc-spa',
        stage: 'SIGNING',
        sort_key: '100',
        title: 'Stock Purchase Agreement',
        status: 'FORM_FINAL',
      },
    },
    action_items: {},
    issues: {
      'issue-price': {
        issue_id: 'issue-price',
        title: 'Purchase price adjustment language',
        status: 'OPEN',
        related_document_ids: ['doc-spa'],
      },
    },
  };

  it.openspec('OA-CKL-019')('validates a patch with dry-run only and persists a validation artifact', async () => {
    const result = await validateWithEvidence('dry-run patch validation', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_001',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/issue-price/status', value: 'CLOSED' },
          { op: 'add', path: '/issues/issue-price/summary', value: 'Resolved by counsel confirmation in email thread.' },
        ],
      },
    });

    await allureStep('Then validation returns ok=true', async () => {
      expect(result.ok).toBe(true);
    });

    if (!result.ok) {
      throw new Error('Expected dry-run validation to succeed.');
    }

    await allureStep('And resulting state is valid', async () => {
      expect(result.resulting_state_valid).toBe(true);
    });

    await allureStep('And resolved operation count is preserved', async () => {
      expect(result.resolved_operations).toHaveLength(2);
    });

    await allureStep('And dry-run does not mutate the source checklist input', async () => {
      expect(baseChecklist.issues['issue-price']?.status).toBe('OPEN');
      expect((baseChecklist.issues['issue-price'] as Record<string, unknown>)?.summary).toBeUndefined();
    });

    const artifact = await allureStep('When validation artifact is fetched by validation_id', async () =>
      getChecklistPatchValidationArtifact(result.validation_id)
    );
    await allureJsonAttachment('dry-run-patch-validation-artifact.json', artifact);

    await allureStep('Then validation artifact exists and is linked to checklist and patch IDs', async () => {
      expect(artifact).not.toBeNull();
      expect(artifact?.checklist_id).toBe('ck_001');
      expect(artifact?.patch_id).toBe('patch_001');
    });
  });

  it.openspec('OA-CKL-022')('rejects unknown target paths without guessing', async () => {
    const result = await validateWithEvidence('unknown target path validation', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_002',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues_by_id/issue-price/status', value: 'CLOSED' },
        ],
      },
    });

    await allureStep('Then validation fails for unresolved targets', async () => {
      expect(result.ok).toBe(false);
    });

    if (result.ok) {
      throw new Error('Expected unknown target validation to fail.');
    }

    await allureStep('And diagnostics identify TARGET_NOT_FOUND at operation index 0', async () => {
      expect(result.diagnostics[0]?.code).toBe('TARGET_NOT_FOUND');
      expect(result.diagnostics[0]?.operation_index).toBe(0);
    });
  });

  it.openspec('OA-CKL-018')('rejects stale expected revision during validation', async () => {
    const result = await validateWithEvidence('stale expected revision validation', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 13,
      patch: {
        patch_id: 'patch_003',
        expected_revision: 12,
        operations: [{ op: 'replace', path: '/issues/issue-price/status', value: 'CLOSED' }],
      },
    });

    await allureStep('Then validation fails', async () => {
      expect(result.ok).toBe(false);
    });

    if (result.ok) {
      throw new Error('Expected stale expected_revision validation to fail.');
    }

    await allureStep('And diagnostics report REVISION_CONFLICT', async () => {
      expect(result.diagnostics[0]?.code).toBe('REVISION_CONFLICT');
    });
  });

  it.openspec('OA-CKL-017')('rejects patches whose resulting state violates checklist schema', async () => {
    const result = await validateWithEvidence('post-patch schema invalid validation', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_004',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/issue-price/status', value: 'INVALID_STATUS' },
        ],
      },
    });

    await allureStep('Then validation fails on invalid resulting state', async () => {
      expect(result.ok).toBe(false);
    });

    if (result.ok) {
      throw new Error('Expected invalid resulting-state schema validation to fail.');
    }

    await allureStep('And diagnostics include POST_PATCH_SCHEMA_INVALID', async () => {
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'POST_PATCH_SCHEMA_INVALID')).toBe(true);
    });
  });

  it('rejects patches targeting __proto__ path', async () => {
    const result = await validateWithEvidence('proto-pollution-path', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_proto',
        expected_revision: 12,
        operations: [
          { op: 'add', path: '/__proto__/polluted', value: true },
        ],
      },
    });

    await allureStep('Then validation rejects dangerous __proto__ path', async () => {
      expect(result.ok).toBe(false);
    });

    if (result.ok) {
      throw new Error('Expected __proto__ path to be rejected.');
    }

    await allureStep('And diagnostics identify TARGET_PATH_INVALID', async () => {
      expect(result.diagnostics[0]?.code).toBe('TARGET_PATH_INVALID');
    });
  });

  it('rejects patches targeting constructor/prototype paths', async () => {
    const constructorResult = await validateWithEvidence('constructor-pollution-path', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_constructor',
        expected_revision: 12,
        operations: [
          { op: 'add', path: '/constructor/prototype', value: {} },
        ],
      },
    });

    await allureStep('Then validation rejects dangerous constructor path', async () => {
      expect(constructorResult.ok).toBe(false);
    });

    if (constructorResult.ok) {
      throw new Error('Expected constructor path to be rejected.');
    }

    await allureStep('And diagnostics identify TARGET_PATH_INVALID for constructor', async () => {
      expect(constructorResult.diagnostics[0]?.code).toBe('TARGET_PATH_INVALID');
    });
  });

  it('rejects patches with dangerous key as final token', async () => {
    const result = await validateWithEvidence('final-token-proto', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_final_proto',
        expected_revision: 12,
        operations: [
          { op: 'add', path: '/issues/issue-price/__proto__', value: 'bad' },
        ],
      },
    });

    await allureStep('Then validation rejects dangerous final token', async () => {
      expect(result.ok).toBe(false);
    });

    if (result.ok) {
      throw new Error('Expected dangerous final token to be rejected.');
    }

    await allureStep('And diagnostics identify TARGET_PATH_INVALID', async () => {
      expect(result.diagnostics[0]?.code).toBe('TARGET_PATH_INVALID');
    });
  });

  it('adds a new record key via add operation', async () => {
    const result = await validateWithEvidence('add-new-record-key', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_add_key',
        expected_revision: 12,
        operations: [
          {
            op: 'add',
            path: '/issues/issue-new',
            value: {
              issue_id: 'issue-new',
              title: 'New issue added via patch',
              status: 'OPEN',
              related_document_ids: ['doc-spa'],
            },
          },
        ],
      },
    });

    await allureStep('Then adding a new record key succeeds', async () => {
      expect(result.ok).toBe(true);
    });
  });

  it('replaces an existing record value', async () => {
    const result = await validateWithEvidence('replace-existing-record-value', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_replace_key',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/issue-price/status', value: 'CLOSED' },
        ],
      },
    });

    await allureStep('Then replacing an existing record field succeeds', async () => {
      expect(result.ok).toBe(true);
    });
  });

  it('removes an existing record key', async () => {
    const result = await validateWithEvidence('remove-record-key', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_remove_key',
        expected_revision: 12,
        operations: [
          { op: 'remove', path: '/issues/issue-price' },
        ],
      },
    });

    await allureStep('Then removing a record key succeeds', async () => {
      expect(result.ok).toBe(true);
    });
  });

  it('appends to a sub-array within a record value', async () => {
    const result = await validateWithEvidence('sub-array-append', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_sub_array',
        expected_revision: 12,
        operations: [
          {
            op: 'add',
            path: '/issues/issue-price/citations/-',
            value: { text: 'Counsel confirmed in email' },
          },
        ],
      },
    });

    await allureStep('Then appending to sub-array within record succeeds', async () => {
      expect(result.ok).toBe(true);
    });
  });

  it('rejects legacy numeric path when key does not exist', async () => {
    const result = await validateWithEvidence('reject-legacy-numeric-path', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_numeric_path',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
        ],
      },
    });

    await allureStep('Then legacy numeric path is rejected (no key "0" exists)', async () => {
      expect(result.ok).toBe(false);
    });

    if (result.ok) {
      throw new Error('Expected legacy numeric path to be rejected.');
    }

    await allureStep('And diagnostics identify TARGET_NOT_FOUND', async () => {
      expect(result.diagnostics[0]?.code).toBe('TARGET_NOT_FOUND');
    });
  });

  it('rejects "-" array token for non-add operations', async () => {
    const checklistCopy = JSON.parse(JSON.stringify(baseChecklist));
    const result = applyChecklistPatchOperations(
      checklistCopy,
      [{ op: 'replace', path: '/issues/issue-price/related_document_ids/-', value: 'doc-new' }]
    );

    await allureStep('Then non-add array dash is rejected with TARGET_PATH_INVALID', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected replace against "-" to be rejected.');
      }
      expect(result.diagnostic.code).toBe('TARGET_PATH_INVALID');
    });
  });

  it('rejects non-numeric array index tokens', async () => {
    const result = await validateWithEvidence('reject-array-nonnumeric-index', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_array_nonnumeric',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/issue-price/related_document_ids/not-an-index', value: 'doc-new' },
        ],
      },
    });

    await allureStep('Then non-numeric array token is rejected as invalid path', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected non-numeric array index to be rejected.');
      }
      expect(result.diagnostics[0]?.code).toBe('TARGET_PATH_INVALID');
    });
  });

  it('rejects out-of-bounds array add and remove operations', async () => {
    const addResult = await validateWithEvidence('reject-array-add-out-of-bounds', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_array_add_oob',
        expected_revision: 12,
        operations: [
          { op: 'add', path: '/issues/issue-price/related_document_ids/9', value: 'doc-new' },
        ],
      },
    });

    const removeResult = await validateWithEvidence('reject-array-remove-out-of-bounds', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_array_remove_oob',
        expected_revision: 12,
        operations: [
          { op: 'remove', path: '/issues/issue-price/related_document_ids/9' },
        ],
      },
    });

    await allureStep('Then out-of-bounds add/remove diagnostics use TARGET_NOT_FOUND', async () => {
      expect(addResult.ok).toBe(false);
      expect(removeResult.ok).toBe(false);
      if (addResult.ok || removeResult.ok) {
        throw new Error('Expected out-of-bounds array operations to fail.');
      }
      expect(addResult.diagnostics[0]?.code).toBe('TARGET_NOT_FOUND');
      expect(removeResult.diagnostics[0]?.code).toBe('TARGET_NOT_FOUND');
    });
  });

  it('rejects paths that traverse through non-container values', async () => {
    const result = await validateWithEvidence('reject-non-container-parent', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_non_container_parent',
        expected_revision: 12,
        operations: [
          { op: 'add', path: '/issues/issue-price/status/child', value: 'x' },
        ],
      },
    });

    await allureStep('Then traversal through scalar values fails with TARGET_PARENT_INVALID', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected traversal through scalar parent to fail.');
      }
      expect(result.diagnostics[0]?.code).toBe('TARGET_PARENT_INVALID');
    });
  });

  it('returns checklist schema diagnostics for invalid checklist payloads', async () => {
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: {
        updated_at: '2026-02-22',
      },
      current_revision: 12,
      patch: {
        patch_id: 'patch_invalid_checklist',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/issue-price/status', value: 'CLOSED' },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected invalid checklist to fail schema validation.');
    }
    expect(result.diagnostics[0]?.code).toBe('CHECKLIST_SCHEMA_INVALID');
  });

  it('returns patch schema diagnostics for invalid patch payloads', async () => {
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        expected_revision: 12,
        operations: [],
      } as unknown as ValidateChecklistPatchArgs['patch'],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected invalid patch envelope to fail schema validation.');
    }
    expect(result.diagnostics[0]?.code).toBe('PATCH_SCHEMA_INVALID');
  });

  it('supports JSON clone fallback when structuredClone is unavailable', async () => {
    const originalStructuredClone = globalThis.structuredClone;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'structuredClone');
    Object.defineProperty(globalThis, 'structuredClone', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const clonedChecklist = JSON.parse(JSON.stringify(baseChecklist));
      const opResult = applyChecklistPatchOperations(
        clonedChecklist,
        [{ op: 'add', path: '/issues/issue-fallback', value: { issue_id: 'issue-fallback', title: 'Fallback', status: 'OPEN' } }]
      );

      expect(opResult.ok).toBe(true);
      expect((clonedChecklist.issues as Record<string, unknown>)['issue-fallback']).toEqual(
        expect.objectContaining({ issue_id: 'issue-fallback' })
      );
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'structuredClone', descriptor);
      } else {
        Object.defineProperty(globalThis, 'structuredClone', {
          value: originalStructuredClone,
          configurable: true,
          writable: true,
        });
      }
    }
  });

  it.openspec('OA-CKL-033')('expires validation artifacts after TTL', async () => {
    await allureStep('Given validation artifact store is reset', async () => {
      setChecklistPatchValidationStore(null);
    });

    const now = 1_700_000_000_000;
    const result = await validateWithEvidence('validation artifact ttl flow', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      now_ms: now,
      validation_ttl_ms: CHECKLIST_PATCH_VALIDATION_TTL_MS,
      patch: {
        patch_id: 'patch_005',
        expected_revision: 12,
        operations: [{ op: 'replace', path: '/issues/issue-price/status', value: 'CLOSED' }],
      },
    });

    await allureStep('Then validation succeeds and emits validation_id', async () => {
      expect(result.ok).toBe(true);
    });

    if (!result.ok) {
      throw new Error('Expected validation to succeed before TTL expiry checks.');
    }

    const beforeExpiry = await allureStep('When artifact is fetched before TTL expiration', async () =>
      getChecklistPatchValidationArtifact(result.validation_id, {
        now_ms: now + CHECKLIST_PATCH_VALIDATION_TTL_MS - 1,
      })
    );
    await allureJsonAttachment('validation-artifact-before-expiry.json', beforeExpiry);

    const afterExpiry = await allureStep('When artifact is fetched after TTL expiration', async () =>
      getChecklistPatchValidationArtifact(result.validation_id, {
        now_ms: now + CHECKLIST_PATCH_VALIDATION_TTL_MS + 1,
      })
    );
    await allureJsonAttachment('validation-artifact-after-expiry.json', afterExpiry);

    await allureStep('Then artifact exists before expiry and is removed after expiry', async () => {
      expect(beforeExpiry).not.toBeNull();
      expect(afterExpiry).toBeNull();
    });
  });
});
