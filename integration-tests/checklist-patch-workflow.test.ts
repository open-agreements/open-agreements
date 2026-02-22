import { beforeEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  applyChecklistPatch,
  renderChecklistMarkdown,
  setChecklistAppliedPatchStore,
  setChecklistPatchValidationStore,
  setChecklistProposedPatchStore,
  validateChecklistPatch,
} from '../src/core/checklist/index.js';

const it = itAllure.epic('Checklist Patch Workflow');

function baseChecklist(): Record<string, unknown> {
  return {
    deal_name: 'Project Atlas - Series A Closing',
    updated_at: '2026-02-22',
    documents: [
      { document_id: 'doc-escrow', title: 'Escrow Agreement' },
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
        status: 'OPEN',
        related_document_ids: ['doc-escrow'],
      },
    ],
  };
}

describe('checklist patch workflow (integration)', () => {
  beforeEach(() => {
    setChecklistPatchValidationStore(null);
    setChecklistAppliedPatchStore(null);
    setChecklistProposedPatchStore(null);
  });

  it('enforces optimistic concurrency and all-or-nothing apply behavior', async () => {
    const checklistForValidation = {
      ...baseChecklist(),
      issues: [
        {
          issue_id: 'iss-1',
          title: 'Issue one',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
        {
          issue_id: 'iss-2',
          title: 'Issue two',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
      ],
    };

    const patch = {
      patch_id: 'patch_integration_atomic_1',
      expected_revision: 4,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
        { op: 'replace', path: '/issues/1/status', value: 'CLOSED' },
      ],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist: checklistForValidation,
      current_revision: 4,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const staleApply = await applyChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist: checklistForValidation,
      current_revision: 5,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });
    expect(staleApply.ok).toBe(false);
    if (!staleApply.ok) {
      expect(staleApply.error_code).toBe('REVISION_CONFLICT');
    }

    const driftedChecklist = {
      ...baseChecklist(),
      issues: [
        {
          issue_id: 'iss-1',
          title: 'Issue one',
          status: 'OPEN',
          related_document_ids: ['doc-escrow'],
        },
      ],
    };

    const driftedApply = await applyChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist: driftedChecklist,
      current_revision: 4,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });
    expect(driftedApply.ok).toBe(false);
    if (!driftedApply.ok) {
      expect(driftedApply.error_code).toBe('APPLY_OPERATION_FAILED');
    }
    expect((driftedChecklist.issues as Array<{ status: string }>)[0]?.status).toBe('OPEN');
  });

  it('supports idempotent replay and rejects patch_id hash conflicts', async () => {
    const checklist = baseChecklist();
    const patch = {
      patch_id: 'patch_integration_idempotent_1',
      expected_revision: 7,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
      ],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 7,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const applied = await applyChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.new_revision).toBe(8);

    const replay = await applyChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist: applied.checklist,
      current_revision: 8,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.idempotent_replay).toBe(true);
    expect(replay.new_revision).toBe(8);

    const conflictingPatch = {
      patch_id: 'patch_integration_idempotent_1',
      expected_revision: 8,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'OPEN' },
      ],
    };

    const conflictValidation = await validateChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist: applied.checklist,
      current_revision: 8,
      patch: conflictingPatch,
    });
    expect(conflictValidation.ok).toBe(true);
    if (!conflictValidation.ok) return;

    const conflictApply = await applyChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist: applied.checklist,
      current_revision: 8,
      request: {
        validation_id: conflictValidation.validation_id,
        patch: conflictingPatch,
      },
    });
    expect(conflictApply.ok).toBe(false);
    if (!conflictApply.ok) {
      expect(conflictApply.error_code).toBe('PATCH_ID_CONFLICT');
    }
  });

  it('applies a multi-operation patch from one source event and renders evidence', async () => {
    const checklist = baseChecklist();
    const patch = {
      patch_id: 'patch_integration_email_1',
      expected_revision: 11,
      source_event: {
        provider: 'outlook',
        message_id: 'AAMkAGI2...',
        conversation_id: 'AAQkAGI2...',
      },
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
        {
          op: 'add',
          path: '/issues/0/citations/-',
          value: {
            text: "Opposing counsel replied 'I agree' to escrow release wording.",
            link: 'https://outlook.office365.com/mail/deeplink?ItemID=AAMkAGI2...',
            filepath: '/deal-room/email-export/escrow-thread.eml',
          },
        },
        { op: 'replace', path: '/checklist_entries/0/status', value: 'PARTIALLY_SIGNED' },
        {
          op: 'add',
          path: '/checklist_entries/0/signatories/0/signature_artifacts/-',
          value: {
            path: '/deal-room/signature-pages/escrow-agreement/buyer-sig-page.pdf',
            received_at: '2026-02-22T15:37:00Z',
          },
        },
        { op: 'replace', path: '/checklist_entries/0/signatories/0/status', value: 'RECEIVED' },
      ],
    };

    const validation = await validateChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 11,
      patch,
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.resolved_operations).toHaveLength(5);

    const applied = await applyChecklistPatch({
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 11,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.checklist.issues[0]?.status).toBe('CLOSED');
    expect(applied.checklist.issues[0]?.citations[0]?.text).toContain('I agree');
    expect(applied.checklist.checklist_entries[0]?.status).toBe('PARTIALLY_SIGNED');
    expect(applied.checklist.checklist_entries[0]?.signatories[0]?.status).toBe('RECEIVED');

    const markdown = renderChecklistMarkdown(applied.checklist);
    expect(markdown).toContain('Evidence: Opposing counsel replied');
    expect(markdown).toContain('escrow-thread.eml');
  });
});
