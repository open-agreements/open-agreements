import { beforeEach, describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allurePrettyJsonAttachment,
  allureStep,
  allureWordLikeMarkdownAttachment,
  allureWordLikeMarkdownDiffAttachment,
  itAllure,
} from './helpers/allure-test.js';
import {
  applyChecklistPatch,
  renderChecklistMarkdown,
  setChecklistAppliedPatchStore,
  setChecklistPatchValidationStore,
  setChecklistProposedPatchStore,
  validateChecklistPatch,
} from '../src/core/checklist/index.js';

const it = itAllure.epic('Checklist Patch Workflow');

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
    await allureWordLikeMarkdownAttachment(
      `${slug}-checklist-before-validation-word-like.html`,
      renderChecklistMarkdown(input.checklist),
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
    await allureWordLikeMarkdownAttachment(
      `${slug}-checklist-before-apply-word-like.html`,
      renderChecklistMarkdown(input.checklist),
      { title: 'Checklist before patch apply' },
    );
  });

  const result = await allureStep(`When applyChecklistPatch runs for ${label}`, async () =>
    applyChecklistPatch(input)
  );

  await allurePrettyJsonAttachment(`${slug}-apply-result-pretty.html`, result);
  await allureJsonAttachment(`${slug}-apply-result.json`, result);
  if (result.ok) {
    const beforeMarkdown = renderChecklistMarkdown(input.checklist);
    const afterMarkdown = renderChecklistMarkdown(result.checklist);
    await allureWordLikeMarkdownAttachment(
      `${slug}-checklist-after-apply-word-like.html`,
      afterMarkdown,
      { title: 'Checklist after patch apply' },
    );
    await allureWordLikeMarkdownDiffAttachment(
      `${slug}-checklist-redline-word-like.html`,
      beforeMarkdown,
      afterMarkdown,
      { title: 'Checklist redline (before \u2192 after)' },
    );
  }
  return result;
}

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

  it.openspec('OA-105')('enforces optimistic concurrency and all-or-nothing apply behavior', async () => {
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

    const validation = await validateWithEvidence('optimistic-concurrency-atomic-validation', {
      checklist_id: 'ck_atlas',
      checklist: checklistForValidation,
      current_revision: 4,
      patch,
    });

    await allureStep('Then validation succeeds for full target set', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed before optimistic concurrency checks.');
    }

    const staleApply = await applyWithEvidence('optimistic-concurrency-stale-apply', {
      checklist_id: 'ck_atlas',
      checklist: checklistForValidation,
      current_revision: 5,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then stale apply attempt is rejected as revision conflict', async () => {
      expect(staleApply.ok).toBe(false);
      if (staleApply.ok) {
        throw new Error('Expected stale apply to fail with REVISION_CONFLICT.');
      }
      expect(staleApply.error_code).toBe('REVISION_CONFLICT');
    });

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

    const driftedApply = await applyWithEvidence('optimistic-concurrency-drifted-apply', {
      checklist_id: 'ck_atlas',
      checklist: driftedChecklist,
      current_revision: 4,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('And drifted runtime targets fail apply with no partial mutation', async () => {
      expect(driftedApply.ok).toBe(false);
      if (driftedApply.ok) {
        throw new Error('Expected drifted apply to fail with APPLY_OPERATION_FAILED.');
      }
      expect(driftedApply.error_code).toBe('APPLY_OPERATION_FAILED');
      expect((driftedChecklist.issues as Array<{ status: string }>)[0]?.status).toBe('OPEN');
    });
  });

  it.openspec('OA-110')('supports idempotent replay and rejects patch_id hash conflicts', async () => {
    const checklist = baseChecklist();
    const patch = {
      patch_id: 'patch_integration_idempotent_1',
      expected_revision: 7,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'CLOSED' },
      ],
    };

    const validation = await validateWithEvidence('idempotent-replay-integration-validation', {
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 7,
      patch,
    });

    await allureStep('Then validation succeeds for idempotent replay scenario', async () => {
      expect(validation.ok).toBe(true);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed for idempotent replay scenario.');
    }

    const applied = await applyWithEvidence('idempotent-replay-integration-first-apply', {
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 7,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then first apply succeeds and increments revision', async () => {
      expect(applied.ok).toBe(true);
      if (!applied.ok) {
        throw new Error('Expected first apply to succeed in idempotent replay scenario.');
      }
      expect(applied.new_revision).toBe(8);
    });

    if (!applied.ok) {
      throw new Error('Expected first apply to succeed in idempotent replay scenario.');
    }

    const replay = await applyWithEvidence('idempotent-replay-integration-second-apply', {
      checklist_id: 'ck_atlas',
      checklist: applied.checklist,
      current_revision: 8,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('And replay apply is idempotent with unchanged revision', async () => {
      expect(replay.ok).toBe(true);
      if (!replay.ok) {
        throw new Error('Expected replay apply to succeed.');
      }
      expect(replay.idempotent_replay).toBe(true);
      expect(replay.new_revision).toBe(8);
    });

    const conflictingPatch = {
      patch_id: 'patch_integration_idempotent_1',
      expected_revision: 8,
      operations: [
        { op: 'replace', path: '/issues/0/status', value: 'OPEN' },
      ],
    };

    const conflictValidation = await validateWithEvidence('idempotent-replay-conflict-validation', {
      checklist_id: 'ck_atlas',
      checklist: applied.checklist,
      current_revision: 8,
      patch: conflictingPatch,
    });

    await allureStep('And conflicting payload still validates on its own', async () => {
      expect(conflictValidation.ok).toBe(true);
    });

    if (!conflictValidation.ok) {
      throw new Error('Expected conflict payload validation to succeed before apply conflict check.');
    }

    const conflictApply = await applyWithEvidence('idempotent-replay-conflict-apply', {
      checklist_id: 'ck_atlas',
      checklist: applied.checklist,
      current_revision: 8,
      request: {
        validation_id: conflictValidation.validation_id,
        patch: conflictingPatch,
      },
    });

    await allureStep('Then conflicting payload with reused patch_id is rejected', async () => {
      expect(conflictApply.ok).toBe(false);
      if (conflictApply.ok) {
        throw new Error('Expected conflicting payload apply to fail with PATCH_ID_CONFLICT.');
      }
      expect(conflictApply.error_code).toBe('PATCH_ID_CONFLICT');
    });
  });

  it.openspec('OA-103')('applies a multi-operation patch from one source event and renders evidence', async () => {
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

    const validation = await validateWithEvidence('multi-operation-source-event-validation', {
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 11,
      patch,
    });

    await allureStep('Then validation succeeds with all operations resolved', async () => {
      expect(validation.ok).toBe(true);
      if (!validation.ok) {
        throw new Error('Expected validation to succeed for multi-operation source event patch.');
      }
      expect(validation.resolved_operations).toHaveLength(5);
    });

    if (!validation.ok) {
      throw new Error('Expected validation to succeed for multi-operation source event patch.');
    }

    const applied = await applyWithEvidence('multi-operation-source-event-apply', {
      checklist_id: 'ck_atlas',
      checklist,
      current_revision: 11,
      request: {
        validation_id: validation.validation_id,
        patch,
      },
    });

    await allureStep('Then apply succeeds and mutates target fields', async () => {
      expect(applied.ok).toBe(true);
      if (!applied.ok) {
        throw new Error('Expected apply to succeed for multi-operation source event patch.');
      }
      expect(applied.checklist.issues[0]?.status).toBe('CLOSED');
      expect(applied.checklist.issues[0]?.citations[0]?.text).toContain('I agree');
      expect(applied.checklist.checklist_entries[0]?.status).toBe('PARTIALLY_SIGNED');
      expect(applied.checklist.checklist_entries[0]?.signatories[0]?.status).toBe('RECEIVED');
    });

    if (!applied.ok) {
      throw new Error('Expected apply to succeed for multi-operation source event patch.');
    }

    const markdown = await allureStep('When checklist markdown is rendered after apply', async () =>
      renderChecklistMarkdown(applied.checklist)
    );
    await allureJsonAttachment('multi-operation-rendered-markdown-evidence.json', { markdown });

    await allureStep('Then rendered markdown includes evidence text and filepath', async () => {
      expect(markdown).toContain('Evidence: Opposing counsel replied');
      expect(markdown).toContain('escrow-thread.eml');
    });
  });
});
