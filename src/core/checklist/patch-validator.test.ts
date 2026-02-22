import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import {
  CHECKLIST_PATCH_VALIDATION_TTL_MS,
  getChecklistPatchValidationArtifact,
  setChecklistPatchValidationStore,
  validateChecklistPatch,
} from './patch-validator.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Patch Validation' });

describe('validateChecklistPatch', () => {
  const baseChecklist = {
    deal_name: 'Project Atlas',
    updated_at: '2026-02-22',
    documents: [
      {
        document_id: 'doc-spa',
        title: 'Stock Purchase Agreement',
      },
    ],
    checklist_entries: [
      {
        entry_id: 'entry-spa',
        document_id: 'doc-spa',
        stage: 'SIGNING',
        sort_key: '100',
        title: 'Stock Purchase Agreement',
        status: 'FORM_FINAL',
      },
    ],
    action_items: [],
    issues: [
      {
        issue_id: 'iss-price',
        title: 'Purchase price adjustment language',
        status: 'OPEN',
        related_document_ids: ['doc-spa'],
      },
    ],
  };

  it('validates a patch with dry-run only and persists a validation artifact', async () => {
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_001',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
          { op: 'add', path: '/issues/0/summary', value: 'Resolved by counsel confirmation in email thread.' },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.resulting_state_valid).toBe(true);
    expect(result.resolved_operations).toHaveLength(2);
    expect(baseChecklist.issues[0]?.status).toBe('OPEN');
    expect(baseChecklist.issues[0]?.summary).toBeUndefined();

    const artifact = await getChecklistPatchValidationArtifact(result.validation_id);
    expect(artifact).not.toBeNull();
    expect(artifact?.checklist_id).toBe('ck_001');
    expect(artifact?.patch_id).toBe('patch_001');
  });

  it('rejects unknown target paths without guessing', async () => {
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_002',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues_by_id/iss-price/status', value: 'CLOSED' },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe('TARGET_NOT_FOUND');
    expect(result.diagnostics[0]?.operation_index).toBe(0);
  });

  it('rejects stale expected revision during validation', async () => {
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 13,
      patch: {
        patch_id: 'patch_003',
        expected_revision: 12,
        operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe('REVISION_CONFLICT');
  });

  it('rejects patches whose resulting state violates checklist schema', async () => {
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      patch: {
        patch_id: 'patch_004',
        expected_revision: 12,
        operations: [
          { op: 'replace', path: '/issues/0/status', value: 'INVALID_STATUS' },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'POST_PATCH_SCHEMA_INVALID')).toBe(true);
  });

  it('expires validation artifacts after TTL', async () => {
    setChecklistPatchValidationStore(null);
    const now = 1_700_000_000_000;
    const result = await validateChecklistPatch({
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 12,
      now_ms: now,
      validation_ttl_ms: CHECKLIST_PATCH_VALIDATION_TTL_MS,
      patch: {
        patch_id: 'patch_005',
        expected_revision: 12,
        operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const beforeExpiry = await getChecklistPatchValidationArtifact(result.validation_id, {
      now_ms: now + CHECKLIST_PATCH_VALIDATION_TTL_MS - 1,
    });
    expect(beforeExpiry).not.toBeNull();

    const afterExpiry = await getChecklistPatchValidationArtifact(result.validation_id, {
      now_ms: now + CHECKLIST_PATCH_VALIDATION_TTL_MS + 1,
    });
    expect(afterExpiry).toBeNull();
  });
});
