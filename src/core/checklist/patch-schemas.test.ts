import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import {
  ChecklistPatchApplyRequestSchema,
  ChecklistPatchEnvelopeSchema,
  ChecklistPatchOperationSchema,
  JsonPointerSchema,
  PatchCitationSchema,
} from './patch-schemas.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Patch Schemas' });

describe('ChecklistPatch schemas', () => {
  it('parses a valid patch envelope with default APPLY mode', () => {
    const parsed = ChecklistPatchEnvelopeSchema.safeParse({
      patch_id: 'patch_thread_44_v1',
      expected_revision: 12,
      operations: [
        { op: 'replace', path: '/issues_by_id/iss-1/status', value: 'CLOSED' },
      ],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mode).toBe('APPLY');
    }
  });

  it('rejects empty operation arrays', () => {
    const parsed = ChecklistPatchEnvelopeSchema.safeParse({
      patch_id: 'patch_1',
      expected_revision: 1,
      operations: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects paths that are not valid JSON pointers', () => {
    expect(JsonPointerSchema.safeParse('issues/iss-1/status').success).toBe(false);
    expect(JsonPointerSchema.safeParse('/issues/~2bad').success).toBe(false);
    expect(JsonPointerSchema.safeParse('/issues/~1ok').success).toBe(true);
  });

  it('enforces operation/value compatibility', () => {
    const addMissingValue = ChecklistPatchOperationSchema.safeParse({
      op: 'add',
      path: '/issues_by_id/iss-1/status',
    });
    expect(addMissingValue.success).toBe(false);

    const removeWithValue = ChecklistPatchOperationSchema.safeParse({
      op: 'remove',
      path: '/issues_by_id/iss-1/status',
      value: 'OPEN',
    });
    expect(removeWithValue.success).toBe(false);

    const replaceAppend = ChecklistPatchOperationSchema.safeParse({
      op: 'replace',
      path: '/issues_by_id/iss-1/citations/-',
      value: { text: 'bad path for replace' },
    });
    expect(replaceAppend.success).toBe(false);
  });

  it('enforces citation value shape for citation paths', () => {
    const invalidCitation = ChecklistPatchOperationSchema.safeParse({
      op: 'add',
      path: '/issues_by_id/iss-1/citations/-',
      value: { link: 'https://outlook.office365.com/deeplink' },
    });
    expect(invalidCitation.success).toBe(false);

    const validCitation = ChecklistPatchOperationSchema.safeParse({
      op: 'add',
      path: '/issues_by_id/iss-1/citations/-',
      value: {
        text: "Opposing counsel replied 'I agree'",
        link: 'https://outlook.office365.com/deeplink',
        filepath: '/tmp/email.eml',
      },
    });
    expect(validCitation.success).toBe(true);
  });

  it('allows patch citation with text only', () => {
    const parsed = PatchCitationSchema.safeParse({ text: 'Counsel confirmed acceptance in email body.' });
    expect(parsed.success).toBe(true);
  });

  it('requires validation_id for apply requests', () => {
    const missingValidationId = ChecklistPatchApplyRequestSchema.safeParse({
      patch: {
        patch_id: 'patch_2',
        expected_revision: 3,
        operations: [{ op: 'remove', path: '/issues_by_id/iss-1/summary' }],
      },
    });
    expect(missingValidationId.success).toBe(false);

    const validRequest = ChecklistPatchApplyRequestSchema.safeParse({
      validation_id: 'val_01JABCDEF',
      patch: {
        patch_id: 'patch_2',
        expected_revision: 3,
        operations: [{ op: 'remove', path: '/issues_by_id/iss-1/summary' }],
      },
    });
    expect(validRequest.success).toBe(true);
  });
});
