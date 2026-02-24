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

  it.openspec('OA-106')('validates a patch with dry-run only and persists a validation artifact', async () => {
    const result = await validateWithEvidence('dry-run patch validation', {
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
      expect(baseChecklist.issues[0]?.status).toBe('OPEN');
      expect(baseChecklist.issues[0]?.summary).toBeUndefined();
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

  it.openspec('OA-109')('rejects unknown target paths without guessing', async () => {
    const result = await validateWithEvidence('unknown target path validation', {
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

  it.openspec('OA-105')('rejects stale expected revision during validation', async () => {
    const result = await validateWithEvidence('stale expected revision validation', {
      checklist_id: 'ck_001',
      checklist: baseChecklist,
      current_revision: 13,
      patch: {
        patch_id: 'patch_003',
        expected_revision: 12,
        operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
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

  it.openspec('OA-104')('rejects patches whose resulting state violates checklist schema', async () => {
    const result = await validateWithEvidence('post-patch schema invalid validation', {
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

  it.openspec('OA-201')('expires validation artifacts after TTL', async () => {
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
        operations: [{ op: 'replace', path: '/issues/0/status', value: 'CLOSED' }],
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
