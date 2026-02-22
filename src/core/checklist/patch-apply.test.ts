import { beforeEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { setChecklistPatchValidationStore, validateChecklistPatch } from './patch-validator.js';
import { applyChecklistPatch, setChecklistAppliedPatchStore } from './patch-apply.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Patch Apply' });

function buildChecklist(): Record<string, unknown> {
  return {
    deal_name: 'Project Atlas',
    updated_at: '2026-02-22',
    documents: [
      {
        document_id: 'doc-escrow',
        title: 'Escrow Agreement',
      },
    ],
    checklist_entries: [
      {
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
    ],
    action_items: [],
    issues: [
      {
        issue_id: 'iss-escrow',
        title: 'Escrow release mechanics',
        summary: 'Open drafting point.',
        status: 'OPEN',
        related_document_ids: ['doc-escrow'],
      },
    ],
  };
}

describe('applyChecklistPatch', () => {
  beforeEach(() => {
    setChecklistPatchValidationStore(null);
    setChecklistAppliedPatchStore(null);
  });

  it('applies a validated patch and increments revision exactly once', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_001',
      expected_revision: 7,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
        { op: 'replace', path: '/checklist_entries/0/status', value: 'PARTIALLY_SIGNED' },
      ],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const applied = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.idempotent_replay).toBe(false);
    expect(applied.previous_revision).toBe(7);
    expect(applied.new_revision).toBe(8);
    expect(applied.checklist.issues[0]?.status).toBe('CLOSED');
    expect(applied.checklist.checklist_entries[0]?.status).toBe('PARTIALLY_SIGNED');
    expect((checklist.issues as Array<{ status: string }>)[0]?.status).toBe('OPEN');
  });

  it('returns no-op on idempotent replay with same patch_id and payload', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_002',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const firstApply = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });
    expect(firstApply.ok).toBe(true);
    if (!firstApply.ok) return;
    expect(firstApply.new_revision).toBe(8);

    const replayApply = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist: firstApply.checklist,
      current_revision: 8,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    expect(replayApply.ok).toBe(true);
    if (!replayApply.ok) return;
    expect(replayApply.idempotent_replay).toBe(true);
    expect(replayApply.previous_revision).toBe(8);
    expect(replayApply.new_revision).toBe(8);
  });

  it('rejects reused patch_id with different payload hash', async () => {
    const checklist = buildChecklist();
    const patchV1 = {
      patch_id: 'patch_apply_003',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
    };

    const validationV1 = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch: patchV1,
    });
    expect(validationV1.ok).toBe(true);
    if (!validationV1.ok) return;

    const appliedV1 = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validationV1.validation_id,
        patch: patchV1,
      },
    });
    expect(appliedV1.ok).toBe(true);
    if (!appliedV1.ok) return;

    const patchV2 = {
      patch_id: 'patch_apply_003',
      expected_revision: 8,
      operations: [{ op: 'replace', path: '/issues/0/status', value: 'OPEN' }],
    };

    const validationV2 = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: appliedV1.checklist,
      current_revision: 8,
      patch: patchV2,
    });
    expect(validationV2.ok).toBe(true);
    if (!validationV2.ok) return;

    const appliedV2 = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist: appliedV1.checklist,
      current_revision: 8,
      request: {
        validation_id: validationV2.validation_id,
        patch: patchV2,
      },
    });

    expect(appliedV2.ok).toBe(false);
    if (appliedV2.ok) return;
    expect(appliedV2.error_code).toBe('PATCH_ID_CONFLICT');
  });

  it('rejects apply with missing validation artifact', async () => {
    const result = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist: buildChecklist(),
      current_revision: 7,
      request: {
        validation_id: 'val_missing',
        patch: {
          patch_id: 'patch_apply_004',
          expected_revision: 7,
          operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('VALIDATION_REQUIRED');
  });

  it('rejects apply when validation_id does not match patch payload hash', async () => {
    const checklist = buildChecklist();
    const validatedPatch = {
      patch_id: 'patch_apply_005',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch: validatedPatch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const tamperedPatch = {
      patch_id: 'patch_apply_005',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/0/status', value: 'OPEN' }],
    };

    const result = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch: tamperedPatch,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('VALIDATION_MISMATCH');
  });

  it('rejects stale revision for non-replay apply', async () => {
    const checklist = buildChecklist();
    const patch = {
      patch_id: 'patch_apply_006',
      expected_revision: 7,
      operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 7,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const result = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist,
      current_revision: 8,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('REVISION_CONFLICT');
  });

  it('preserves all-or-nothing behavior when apply-time target resolution fails', async () => {
    const validatedChecklist = {
      ...buildChecklist(),
      issues: [
        {
          issue_id: 'iss-1',
          title: 'One',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
        {
          issue_id: 'iss-2',
          title: 'Two',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
      ],
    };

    const patch = {
      patch_id: 'patch_apply_007',
      expected_revision: 7,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
        { op: 'replace', path: '/issues/1/status', value: 'CLOSED' },
      ],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: validatedChecklist,
      current_revision: 7,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const applyChecklistState = {
      ...buildChecklist(),
      issues: [
        {
          issue_id: 'iss-1',
          title: 'One',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
      ],
    };

    const result = await applyChecklistPatch({
      checklist_id: 'ck_001',
      checklist: applyChecklistState,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('APPLY_OPERATION_FAILED');
    expect((applyChecklistState.issues as Array<{ status: string }>)[0]?.status).toBe('OPEN');
  });
});
