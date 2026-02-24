import { describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';
import {
  ChecklistPatchApplyRequestSchema,
  ChecklistPatchEnvelopeSchema,
  ChecklistPatchOperationSchema,
  JsonPointerSchema,
  PatchCitationSchema,
} from './patch-schemas.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Patch Schemas' });

type ParseResult = { success: boolean };

function attachmentSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function safeParseWithEvidence(
  label: string,
  input: unknown,
  parser: (payload: unknown) => ParseResult,
): Promise<ParseResult> {
  const slug = attachmentSlug(label);

  await allureStep(`Given ${label} input is prepared`, async () => {
    await allureJsonAttachment(`${slug}-input.json`, input);
  });

  const parsed = await allureStep(`When ${label} schema parses the input`, async () => parser(input));
  await allureJsonAttachment(`${slug}-parse-result.json`, parsed);
  return parsed;
}

describe('ChecklistPatch schemas', () => {
  it.openspec('OA-200')('parses a valid patch envelope with default APPLY mode', async () => {
    const payload = {
      patch_id: 'patch_thread_44_v1',
      expected_revision: 12,
      operations: [
        { op: 'replace', path: '/issues_by_id/iss-1/status', value: 'CLOSED' },
      ],
    };

    await allureStep('Given a valid patch envelope without explicit mode', async () => {
      await allureJsonAttachment('patch-envelope-default-mode-input.json', payload);
    });

    const parsed = await allureStep('When ChecklistPatchEnvelopeSchema parses the envelope', async () =>
      ChecklistPatchEnvelopeSchema.safeParse(payload)
    );
    await allureJsonAttachment('patch-envelope-default-mode-parse-result.json', parsed);

    await allureStep('Then schema parsing succeeds', async () => {
      expect(parsed.success).toBe(true);
    });

    await allureStep('And mode defaults to APPLY', async () => {
      if (!parsed.success) {
        throw new Error('Expected ChecklistPatchEnvelopeSchema to parse successfully.');
      }
      expect(parsed.data.mode).toBe('APPLY');
    });
  });

  it.openspec('OA-200')('rejects empty operation arrays', async () => {
    const parsed = await safeParseWithEvidence(
      'patch envelope with empty operations',
      {
        patch_id: 'patch_1',
        expected_revision: 1,
        operations: [],
      },
      (payload) => ChecklistPatchEnvelopeSchema.safeParse(payload),
    );

    await allureStep('Then schema parsing fails', async () => {
      expect(parsed.success).toBe(false);
    });
  });

  it.openspec('OA-200')('rejects paths that are not valid JSON pointers', async () => {
    const missingLeadingSlash = await safeParseWithEvidence(
      'json pointer missing leading slash',
      'issues/iss-1/status',
      (payload) => JsonPointerSchema.safeParse(payload),
    );

    const badEscapeSequence = await safeParseWithEvidence(
      'json pointer with invalid escape sequence',
      '/issues/~2bad',
      (payload) => JsonPointerSchema.safeParse(payload),
    );

    const validEscapeSequence = await safeParseWithEvidence(
      'json pointer with valid slash escape',
      '/issues/~1ok',
      (payload) => JsonPointerSchema.safeParse(payload),
    );

    await allureStep('Then missing leading slash path is rejected', async () => {
      expect(missingLeadingSlash.success).toBe(false);
    });

    await allureStep('And invalid escape sequence path is rejected', async () => {
      expect(badEscapeSequence.success).toBe(false);
    });

    await allureStep('And valid escape sequence path is accepted', async () => {
      expect(validEscapeSequence.success).toBe(true);
    });
  });

  it.openspec('OA-200')('enforces operation/value compatibility', async () => {
    const addMissingValue = await safeParseWithEvidence(
      'add operation missing value',
      {
        op: 'add',
        path: '/issues_by_id/iss-1/status',
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    const removeWithValue = await safeParseWithEvidence(
      'remove operation containing value',
      {
        op: 'remove',
        path: '/issues_by_id/iss-1/status',
        value: 'OPEN',
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    const replaceAppendPath = await safeParseWithEvidence(
      'replace operation targeting append path',
      {
        op: 'replace',
        path: '/issues_by_id/iss-1/citations/-',
        value: { text: 'bad path for replace' },
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    await allureStep('Then add operation without value is rejected', async () => {
      expect(addMissingValue.success).toBe(false);
    });

    await allureStep('And remove operation with value is rejected', async () => {
      expect(removeWithValue.success).toBe(false);
    });

    await allureStep('And replace operation cannot target append path', async () => {
      expect(replaceAppendPath.success).toBe(false);
    });
  });

  it.openspec('OA-113')('enforces citation value shape for citation paths', async () => {
    const invalidCitation = await safeParseWithEvidence(
      'citation append operation missing required text',
      {
        op: 'add',
        path: '/issues_by_id/iss-1/citations/-',
        value: { link: 'https://outlook.office365.com/deeplink' },
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    const validCitation = await safeParseWithEvidence(
      'citation append operation with text link and filepath',
      {
        op: 'add',
        path: '/issues_by_id/iss-1/citations/-',
        value: {
          text: "Opposing counsel replied 'I agree'",
          link: 'https://outlook.office365.com/deeplink',
          filepath: '/tmp/email.eml',
        },
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    await allureStep('Then citation payload without text is rejected', async () => {
      expect(invalidCitation.success).toBe(false);
    });

    await allureStep('And citation payload with required shape is accepted', async () => {
      expect(validCitation.success).toBe(true);
    });
  });

  it.openspec('OA-112')('allows patch citation with text only', async () => {
    const parsed = await safeParseWithEvidence(
      'patch citation text-only payload',
      { text: 'Counsel confirmed acceptance in email body.' },
      (payload) => PatchCitationSchema.safeParse(payload),
    );

    await allureStep('Then citation parse succeeds for text-only evidence', async () => {
      expect(parsed.success).toBe(true);
    });
  });

  it('accepts operations with optional rationale and source fields', async () => {
    const withBoth = await safeParseWithEvidence(
      'operation with rationale and source',
      {
        op: 'replace',
        path: '/issues/iss-1/status',
        value: 'CLOSED',
        rationale: 'Opposing counsel confirmed resolution in email thread',
        source: 'outlook:AAMkAGI2',
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    const withoutMetadata = await safeParseWithEvidence(
      'operation without rationale or source',
      {
        op: 'replace',
        path: '/issues/iss-1/status',
        value: 'CLOSED',
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    await allureStep('Then operation with rationale and source is accepted', async () => {
      expect(withBoth.success).toBe(true);
    });

    await allureStep('And operation without rationale or source is accepted', async () => {
      expect(withoutMetadata.success).toBe(true);
    });
  });

  it('rejects empty rationale or source strings', async () => {
    const emptyRationale = await safeParseWithEvidence(
      'operation with empty rationale',
      {
        op: 'replace',
        path: '/issues/iss-1/status',
        value: 'CLOSED',
        rationale: '',
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    const emptySource = await safeParseWithEvidence(
      'operation with empty source',
      {
        op: 'replace',
        path: '/issues/iss-1/status',
        value: 'CLOSED',
        source: '',
      },
      (payload) => ChecklistPatchOperationSchema.safeParse(payload),
    );

    await allureStep('Then empty rationale is rejected', async () => {
      expect(emptyRationale.success).toBe(false);
    });

    await allureStep('And empty source is rejected', async () => {
      expect(emptySource.success).toBe(false);
    });
  });

  it.openspec('OA-107')('requires validation_id for apply requests', async () => {
    const missingValidationId = await safeParseWithEvidence(
      'apply request without validation_id',
      {
        patch: {
          patch_id: 'patch_2',
          expected_revision: 3,
          operations: [{ op: 'remove', path: '/issues_by_id/iss-1/summary' }],
        },
      },
      (payload) => ChecklistPatchApplyRequestSchema.safeParse(payload),
    );

    const validRequest = await safeParseWithEvidence(
      'apply request with validation_id',
      {
        validation_id: 'val_01JABCDEF',
        patch: {
          patch_id: 'patch_2',
          expected_revision: 3,
          operations: [{ op: 'remove', path: '/issues_by_id/iss-1/summary' }],
        },
      },
      (payload) => ChecklistPatchApplyRequestSchema.safeParse(payload),
    );

    await allureStep('Then request missing validation_id is rejected', async () => {
      expect(missingValidationId.success).toBe(false);
    });

    await allureStep('And request with validation_id is accepted', async () => {
      expect(validRequest.success).toBe(true);
    });
  });
});
