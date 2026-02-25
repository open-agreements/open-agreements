import { beforeEach, describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allurePrettyJsonAttachment,
  allureStep,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';
import {
  renderChecklistDocx,
  attachChecklistDocxPreview,
  attachChecklistRedline,
} from '../../../integration-tests/helpers/docx-evidence.js';
import { computeChecklistPatchHash, setChecklistPatchValidationStore, validateChecklistPatch } from './patch-validator.js';
import {
  applyChecklistPatch,
  getChecklistAppliedPatchStore,
  getChecklistProposedPatchStore,
  setChecklistAppliedPatchStore,
  setChecklistProposedPatchStore,
} from './patch-apply.js';
import { ChecklistPatchEnvelopeSchema } from './patch-schemas.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Patch Apply' });

type ValidateChecklistPatchArgs = Parameters<typeof validateChecklistPatch>[0];
type ValidateChecklistPatchResult = Awaited<ReturnType<typeof validateChecklistPatch>>;
type ApplyChecklistPatchArgs = Parameters<typeof applyChecklistPatch>[0];
type ApplyChecklistPatchResult = Awaited<ReturnType<typeof applyChecklistPatch>>;

function attachmentSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function validateWithEvidence(
  label: string,
  input: ValidateChecklistPatchArgs,
): Promise<ValidateChecklistPatchResult> {
  const slug = attachmentSlug(label);

  await allureStep(`Given ${label} validation input`, async () => {
    await allurePrettyJsonAttachment(`${slug}-validation-input-pretty.html`, input);
    await allureJsonAttachment(`${slug}-validation-input.json`, input);
    const docx = await renderChecklistDocx(input.checklist);
    await attachChecklistDocxPreview(
      `${slug}-checklist-before-validation-word-like.html`,
      docx,
      { title: 'Checklist before patch validation' },
    );
  });

  const result = await allureStep(`When validateChecklistPatch runs for ${label}`, async () =>
    validateChecklistPatch(input)
  );

  await allurePrettyJsonAttachment(`${slug}-validation-result-pretty.html`, result);
  await allureJsonAttachment(`${slug}-validation-result.json`, result);
  return result;
}

async function applyWithEvidence(
  label: string,
  input: ApplyChecklistPatchArgs,
): Promise<ApplyChecklistPatchResult> {
  const slug = attachmentSlug(label);

  await allureStep(`Given ${label} apply input`, async () => {
    await allurePrettyJsonAttachment(`${slug}-apply-input-pretty.html`, input);
    await allureJsonAttachment(`${slug}-apply-input.json`, input);
    const docx = await renderChecklistDocx(input.checklist);
    await attachChecklistDocxPreview(
      `${slug}-checklist-before-apply-word-like.html`,
      docx,
      { title: 'Checklist before patch apply' },
    );
  });

  const result = await allureStep(`When applyChecklistPatch runs for ${label}`, async () =>
    applyChecklistPatch(input)
  );

  await allurePrettyJsonAttachment(`${slug}-apply-result-pretty.html`, result);
  await allureJsonAttachment(`${slug}-apply-result.json`, result);
  if (result.ok) {
    const beforeDocx = await renderChecklistDocx(input.checklist);
    const afterDocx = await renderChecklistDocx(result.checklist);
    await attachChecklistDocxPreview(
      `${slug}-checklist-after-apply-word-like.html`,
      afterDocx,
      { title: 'Checklist after patch apply' },
    );
    await attachChecklistRedline(
      `${slug}-checklist-redline-word-like.html`,
      beforeDocx,
      afterDocx,
      { title: 'Checklist redline (before \u2192 after)' },
    );
  }
  return result;
}

function buildChecklist(): Record<string, unknown> {
  return {
    deal_name: 'Project Atlas',
    updated_at: '2026-02-22',
    documents: {
      'doc-escrow': {
        document_id: 'doc-escrow',
        title: 'Escrow Agreement',
      },
    },
    checklist_entries: {
      'entry-escrow': {
        entry_id: 'entry-escrow',
        document_id: 'doc-escrow',
        stage: 'CLOSING',
        sort_key: '200',
        title: 'Escrow Agreement (Executed)',
        status: 'NOT_STARTED',
        signatories: [
          { party: 'Buyer', status: 'PENDING', signature_artifacts: [] },
          { party: 'Seller', status: 'PENDING', signature_artifacts: [] },
        ],
      },
    },
    action_items: {},
    issues: {
      'issue-escrow': {
        issue_id: 'issue-escrow',
        title: 'Escrow release mechanics',
        summary: 'Open drafting point.',
        status: 'OPEN',
        related_document_ids: ['doc-escrow'],
      },
    },
  };
}

describe('applyChecklistPatch', () => {
  beforeEach(() => {
    setChecklistPatchValidationStore(null);
    setChecklistAppliedPatchStore(null);
    setChecklistProposedPatchStore(null);
  });

  it.openspec('OA-CKL-016')('applies a validated patch and increments revision exactly once', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_001',
      expected_revision: 7,
      operations: [
        { op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' },
        { op: 'replace', path: '/checklist_entries/entry-escrow/status', value: 'PARTIALLY_SIGNED' },
      ],
    };

    const validation = await validateWithEvidence('apply-happy-path', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });

    await allureStep('Then validation succeeds', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed for happy-path apply.');
    }

    const applied = await applyWithEvidence('apply-happy-path', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then apply succeeds', async () => {
      expect(applied.ok).toBe(true);
    });

    if (!applied.ok) {
      throw new Error('Expected apply to succeed for happy-path patch.');
    }

    await allureStep('And apply is not flagged as idempotent replay', async () => {
      expect(applied.idempotent_replay).toBe(false);
    });

    await allureStep('And revision increments exactly once', async () => {
      expect(applied.previous_revision).toBe(7);
      expect(applied.new_revision).toBe(8);
    });

    await allureStep('And patch mutations are reflected in returned checklist', async () => {
      expect(applied.checklist.issues['issue-escrow']?.status).toBe('CLOSED');
      expect(applied.checklist.checklist_entries['entry-escrow']?.status).toBe('PARTIALLY_SIGNED');
    });

    await allureStep('And source checklist input remains unchanged', async () => {
      expect((checklist.issues as Record<string, { status: string }>)['issue-escrow']?.status).toBe('OPEN');
    });
  });

  it.openspec('OA-CKL-023')('returns no-op on idempotent replay with same patch_id and payload', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_002',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' }],
    };

    const validation = await validateWithEvidence('idempotent-replay-initial-validation', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });

    await allureStep('Then initial validation succeeds', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected initial validation to succeed for idempotent replay test.');
    }

    const firstApply = await applyWithEvidence('idempotent-replay-first-apply', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then first apply succeeds and increments revision', async () => {
      expect(firstApply.ok).toBe(true);
      if (!firstApply.ok) {
        throw new Error('Expected first apply to succeed for idempotent replay test.');
      }
      expect(firstApply.new_revision).toBe(8);
    });

    if (!firstApply.ok) {
      throw new Error('Expected first apply to succeed for idempotent replay test.');
    }

    const replayApply = await applyWithEvidence('idempotent-replay-second-apply', {
      checklist_id: 'ck_001',
      checklist: firstApply.checklist,
      current_revision: 8,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then replay apply succeeds as no-op without revision increment', async () => {
      expect(replayApply.ok).toBe(true);
      if (!replayApply.ok) {
        throw new Error('Expected replay apply to succeed.');
      }
      expect(replayApply.idempotent_replay).toBe(true);
      expect(replayApply.previous_revision).toBe(8);
      expect(replayApply.new_revision).toBe(8);
    });
  });

  it.openspec('OA-CKL-024')('rejects reused patch_id with different payload hash', async () => {
    const checklist = buildChecklist();
    const patchV1 = {
      patch_id: 'patch_apply_003',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' }],
    };

    const validationV1 = await validateWithEvidence('patch-id-conflict-validation-v1', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch: patchV1,
    });

    await allureStep('Then first payload validation succeeds', async () => {
      expect(validationV1.ok).toBe(true);
    });

    if (!validationV1.ok) {
      throw new Error('Expected first payload validation to succeed for patch_id conflict test.');
    }

    const appliedV1 = await applyWithEvidence('patch-id-conflict-apply-v1', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validationV1.validation_id,
        patch: patchV1,
      },
    });

    await allureStep('And first payload apply succeeds', async () => {
      expect(appliedV1.ok).toBe(true);
    });

    if (!appliedV1.ok) {
      throw new Error('Expected first payload apply to succeed for patch_id conflict test.');
    }

    const patchV2 = {
      patch_id: 'patch_apply_003',
      expected_revision: 8,
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'OPEN' }],
    };

    const validationV2 = await validateWithEvidence('patch-id-conflict-validation-v2', {
      checklist_id: 'ck_001',
      checklist: appliedV1.checklist,
      current_revision: 8,
      patch: patchV2,
    });

    await allureStep('And second payload validation succeeds', async () => {
      expect(validationV2.ok).toBe(true);
    });

    if (!validationV2.ok) {
      throw new Error('Expected second payload validation to succeed for patch_id conflict test.');
    }

    const appliedV2 = await applyWithEvidence('patch-id-conflict-apply-v2', {
      checklist_id: 'ck_001',
      checklist: appliedV1.checklist,
      current_revision: 8,
      request: {
        validation_id: validationV2.validation_id,
        patch: patchV2,
      },
    });

    await allureStep('Then apply rejects reused patch_id with different hash', async () => {
      expect(appliedV2.ok).toBe(false);
      if (appliedV2.ok) {
        throw new Error('Expected apply to fail with patch_id conflict.');
      }
      expect(appliedV2.error_code).toBe('PATCH_ID_CONFLICT');
    });
  });

  it.openspec('OA-CKL-020')('rejects apply with missing validation artifact', async () => {
    const result = await applyWithEvidence('missing-validation-artifact', {
      checklist_id: 'ck_001',
      checklist: buildChecklist(),
      current_revision: 7,
      request: {
        validation_id: 'val_missing',
        patch: {
          patch_id: 'patch_apply_004',
          expected_revision: 7,
          operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' }],
        },
      },
    });

    await allureStep('Then apply fails with validation required error', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected apply to fail when validation artifact is missing.');
      }
      expect(result.error_code).toBe('VALIDATION_REQUIRED');
    });
  });

  it.openspec('OA-CKL-021')('rejects apply when validation_id does not match patch payload hash', async () => {
    const checklist = buildChecklist();
    const validatedPatch = {
      patch_id: 'patch_apply_005',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' }],
    };

    const validation = await validateWithEvidence('validation-mismatch-validation', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch: validatedPatch,
    });

    await allureStep('Then baseline validation succeeds', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected baseline validation to succeed for validation mismatch test.');
    }

    const tamperedPatch = {
      patch_id: 'patch_apply_005',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'OPEN' }],
    };

    const result = await applyWithEvidence('validation-mismatch-apply', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch: tamperedPatch,
      },
    });

    await allureStep('Then apply rejects tampered payload hash', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected apply to fail for validation hash mismatch.');
      }
      expect(result.error_code).toBe('VALIDATION_MISMATCH');
    });
  });

  it.openspec('OA-CKL-018')('rejects stale revision for non-replay apply', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_006',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' }],
    };

    const validation = await validateWithEvidence('stale-revision-validation', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });

    await allureStep('Then validation succeeds for original revision', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed before stale revision apply check.');
    }

    const result = await applyWithEvidence('stale-revision-apply', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 8,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then apply rejects stale current revision', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected apply to fail on stale revision.');
      }
      expect(result.error_code).toBe('REVISION_CONFLICT');
    });
  });

  it.openspec('OA-CKL-017')('preserves all-or-nothing behavior when apply-time target resolution fails', async () => {
    const validatedChecklist = {
      ...buildChecklist(),
      issues: {
        'issue-1': {
          issue_id: 'issue-1',
          title: 'One',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
        'issue-2': {
          issue_id: 'issue-2',
          title: 'Two',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
      },
    };

    const patch = {
      patch_id: 'patch_apply_007',
      expected_revision: 7,
      operations: [
        { op: 'replace', path: '/issues/issue-1/status', value: 'CLOSED' },
        { op: 'replace', path: '/issues/issue-2/status', value: 'CLOSED' },
      ],
    };

    const validation = await validateWithEvidence('all-or-nothing-validation', {
      checklist_id: 'ck_001',
      checklist: validatedChecklist,
      current_revision: 7,
      patch,
    });

    await allureStep('Then validation succeeds for complete target set', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed for all-or-nothing apply test.');
    }

    const applyChecklistState = {
      ...buildChecklist(),
      issues: {
        'issue-1': {
          issue_id: 'issue-1',
          title: 'One',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
      },
    };

    const result = await applyWithEvidence('all-or-nothing-apply', {
      checklist_id: 'ck_001',
      checklist: applyChecklistState,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then apply fails without partial mutation', async () => {
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected apply to fail when runtime targets drift.');
      }
      expect(result.error_code).toBe('APPLY_OPERATION_FAILED');
      expect((applyChecklistState.issues as Record<string, { status: string }>)['issue-1']?.status).toBe('OPEN');
    });
  });

  it('rationale and source do not affect patch hash (idempotency)', async () => {
    const patchWithout = ChecklistPatchEnvelopeSchema.parse({
      patch_id: 'patch_hash_test',
      expected_revision: 0,
      operations: [{ op: 'replace', path: '/issues/issue-1/status', value: 'CLOSED' }],
    });

    const patchWith = ChecklistPatchEnvelopeSchema.parse({
      patch_id: 'patch_hash_test',
      expected_revision: 0,
      operations: [{
        op: 'replace',
        path: '/issues/issue-1/status',
        value: 'CLOSED',
        rationale: 'Confirmed by counsel',
        source: 'outlook:AAMkAGI2',
      }],
    });

    await allureStep('Then hashes are identical regardless of rationale/source', async () => {
      expect(computeChecklistPatchHash(patchWithout)).toBe(computeChecklistPatchHash(patchWith));
    });
  });

  it('stores full patch envelope (including rationale) in applied patch record', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_rationale_store',
      expected_revision: 7,
      operations: [{
        op: 'replace' as const,
        path: '/issues/issue-escrow/status',
        value: 'CLOSED',
        rationale: 'Counsel confirmed in email thread',
        source: 'outlook:AAMkAGI2',
      }],
    };

    const validation = await validateWithEvidence('rationale-store-validation', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed for rationale store test.');
    }

    const applied = await applyWithEvidence('rationale-store-apply', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    if (!applied.ok) {
      throw new Error('Expected apply to succeed for rationale store test.');
    }

    const record = await allureStep('When applied patch record is fetched from store', async () =>
      getChecklistAppliedPatchStore().get('ck_001', 'patch_apply_rationale_store')
    );
    await allureJsonAttachment('rationale-store-record.json', record);

    await allureStep('Then stored record contains full patch envelope with rationale', async () => {
      expect(record).not.toBeNull();
      expect(record!.patch.operations[0]!.rationale).toBe('Counsel confirmed in email thread');
      expect(record!.patch.operations[0]!.source).toBe('outlook:AAMkAGI2');
    });
  });

  it.openspec('OA-CKL-027')('stores PROPOSED mode patch without mutating checklist revision', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_008',
      expected_revision: 7,
      mode: 'PROPOSED',
      operations: [{ op: 'replace', path: '/issues/issue-escrow/status', value: 'CLOSED' }],
    };

    const validation = await validateWithEvidence('proposed-mode-validation', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });

    await allureStep('Then validation succeeds for proposed mode patch', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed for proposed mode patch.');
    }

    const result = await applyWithEvidence('proposed-mode-apply', {
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then apply returns proposed-mode no-op mutation response', async () => {
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('Expected proposed mode apply to succeed.');
      }
      expect(result.mode).toBe('PROPOSED');
      expect(result.applied).toBe(false);
      expect(result.new_revision).toBe(7);
      expect(result.checklist.issues['issue-escrow']?.status).toBe('OPEN');
    });

    if (!result.ok) {
      throw new Error('Expected proposed mode apply to succeed.');
    }

    const proposedRecord = await allureStep('When proposed patch record is fetched from store', async () =>
      getChecklistProposedPatchStore().get('ck_001', 'patch_apply_008')
    );
    await allureJsonAttachment('proposed-mode-store-record.json', proposedRecord);

    await allureStep('Then stored proposed patch hash matches apply response hash', async () => {
      expect(proposedRecord?.patch_hash).toBe(result.patch_hash);
    });
  });
});
