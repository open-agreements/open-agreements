import { describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';
import {
  ActionItemSchema,
  ChecklistEntryStatusEnum,
  ChecklistItemStatusEnum,
  ChecklistStageEnum,
  ClosingChecklistSchema,
  IssueSchema,
  IssueStatusEnum,
  SignatureArtifactSchema,
  SignatoryStatusEnum,
} from './schemas.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Schemas v2' });

type SafeParseResult<T = unknown> = {
  success: boolean;
  data?: T;
};

type SafeParseSchema<T = unknown> = {
  safeParse: (payload: unknown) => SafeParseResult<T>;
};

function attachmentSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function safeParseWithEvidence<T>(
  label: string,
  schema: SafeParseSchema<T>,
  payload: unknown,
): Promise<SafeParseResult<T>> {
  const slug = attachmentSlug(label);

  await allureStep(`Given ${label} payload`, async () => {
    await allureJsonAttachment(`${slug}-input.json`, payload);
  });

  const result = await allureStep(`When ${label} is parsed`, async () => schema.safeParse(payload));
  await allureJsonAttachment(`${slug}-parse-result.json`, result);

  return result;
}

describe('ClosingChecklistSchema v2', () => {
  const minimal = {
    deal_name: 'Acme / BigCo Series A',
    updated_at: '2026-02-22',
  };

  it.openspec('OA-198')('parses minimal valid input', async () => {
    const result = await safeParseWithEvidence('minimal checklist payload', ClosingChecklistSchema, minimal);

    await allureStep('Then minimal payload parses successfully', async () => {
      expect(result.success).toBe(true);
    });

    if (!result.success) {
      throw new Error('Expected minimal checklist payload to parse successfully.');
    }

    await allureStep('And record fields default to empty objects', async () => {
      expect(result.data.documents).toEqual({});
      expect(result.data.checklist_entries).toEqual({});
      expect(result.data.action_items).toEqual({});
      expect(result.data.issues).toEqual({});
    });
  });

  it.openspec(['OA-094', 'OA-096', 'OA-097'])(
    'accepts full input with documents, entries, signatories, and links',
    async () => {
    const full = {
      ...minimal,
      documents: {
        'escrow-agreement-executed': {
          document_id: 'escrow-agreement-executed',
          title: 'Escrow Agreement (Executed)',
          primary_link: 'https://drive.example.com/escrow-executed',
          labels: ['phase:closing'],
        },
      },
      checklist_entries: {
        'entry-escrow': {
          entry_id: 'entry-escrow',
          document_id: 'escrow-agreement-executed',
          stage: 'CLOSING',
          sort_key: '120',
          title: 'Escrow Agreement (Executed)',
          status: 'FULLY_EXECUTED',
          citations: [{
            text: 'Required under SPA closing conditions',
            ref: 'SPA §6.2(c)',
            link: 'https://outlook.office365.com/mail/deeplink?ItemID=AAMkAG...',
          }],
          signatories: [
            {
              party: 'Buyer',
              name: 'A. Lee',
              status: 'RECEIVED',
              signature_artifacts: [
                { uri: 'https://drive.example.com/buyer-sig-page.pdf', received_at: '2026-02-21T10:00:00Z' },
              ],
            },
          ],
        },
      },
      action_items: {
        'act-1': {
          action_id: 'act-1',
          description: 'Finalize funds flow memo',
          status: 'IN_PROGRESS',
          related_document_ids: ['escrow-agreement-executed'],
        },
      },
      issues: {
        'iss-1': {
          issue_id: 'iss-1',
          title: 'Escrow release mechanics',
          status: 'OPEN',
          related_document_ids: ['escrow-agreement-executed'],
        },
      },
    };

    const result = await safeParseWithEvidence('full checklist payload', ClosingChecklistSchema, full);

    await allureStep('Then full payload parses successfully', async () => {
      expect(result.success).toBe(true);
    });
    }
  );

  it.openspec('OA-088')('accepts stable string IDs that are not UUIDs', async () => {
    const result = await safeParseWithEvidence(
      'stable string IDs payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'doc-spa-form-v4': { document_id: 'doc-spa-form-v4', title: 'SPA (Form)' },
        },
        checklist_entries: {
          'entry-spa-form-v4': {
            entry_id: 'entry-spa-form-v4',
            document_id: 'doc-spa-form-v4',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'SPA (Form)',
            status: 'FORM_FINAL',
          },
        },
      },
    );

    await allureStep('Then non-UUID stable IDs are accepted', async () => {
      expect(result.success).toBe(true);
    });
  });

  it.openspec('OA-098')('allows checklist entries with no document_id', async () => {
    const result = await safeParseWithEvidence(
      'checklist entry without document_id payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        checklist_entries: {
          'entry-order-good-standing': {
            entry_id: 'entry-order-good-standing',
            stage: 'PRE_SIGNING',
            sort_key: '020',
            title: 'Order Delaware good standing certificate',
            status: 'NOT_STARTED',
          },
        },
      },
    );

    await allureStep('Then checklist entries can omit document_id', async () => {
      expect(result.success).toBe(true);
    });
  });

  it.openspec('OA-089')('rejects checklist entry pointing to unknown document', async () => {
    const result = await safeParseWithEvidence(
      'entry referencing unknown document payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'doc-1': { document_id: 'doc-1', title: 'SPA' },
        },
        checklist_entries: {
          'entry-1': {
            entry_id: 'entry-1',
            document_id: 'doc-404',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'SPA',
            status: 'FORM_FINAL',
          },
        },
      },
    );

    await allureStep('Then unknown document references are rejected', async () => {
      expect(result.success).toBe(false);
    });
  });

  it.openspec('OA-090')('rejects mapping one document to multiple checklist entries', async () => {
    const result = await safeParseWithEvidence(
      'duplicate document mapping payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'doc-1': { document_id: 'doc-1', title: 'Escrow Agreement' },
        },
        checklist_entries: {
          'entry-1': {
            entry_id: 'entry-1',
            document_id: 'doc-1',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'Escrow Agreement (Form)',
            status: 'FORM_FINAL',
          },
          'entry-2': {
            entry_id: 'entry-2',
            document_id: 'doc-1',
            stage: 'CLOSING',
            sort_key: '200',
            title: 'Escrow Agreement (Executed)',
            status: 'FULLY_EXECUTED',
          },
        },
      },
    );

    await allureStep('Then one document mapped to multiple entries is rejected', async () => {
      expect(result.success).toBe(false);
    });
  });

  it.openspec('OA-198')('rejects parent_entry_id that points to different stage', async () => {
    const result = await safeParseWithEvidence(
      'parent entry cross-stage payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        checklist_entries: {
          'entry-parent': {
            entry_id: 'entry-parent',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'Parent',
            status: 'FORM_FINAL',
          },
          'entry-child': {
            entry_id: 'entry-child',
            parent_entry_id: 'entry-parent',
            stage: 'CLOSING',
            sort_key: '110',
            title: 'Child',
            status: 'NOT_STARTED',
          },
        },
      },
    );

    await allureStep('Then parent_entry_id cannot reference a different stage', async () => {
      expect(result.success).toBe(false);
    });
  });

  it.openspec('OA-198')('rejects unknown related_document_ids in action items', async () => {
    const result = await safeParseWithEvidence(
      'action item unknown related_document_ids payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'doc-1': { document_id: 'doc-1', title: 'SPA' },
        },
        action_items: {
          'act-1': {
            action_id: 'act-1',
            description: 'Do thing',
            status: 'IN_PROGRESS',
            related_document_ids: ['doc-2'],
          },
        },
      },
    );

    await allureStep('Then action items cannot reference unknown documents', async () => {
      expect(result.success).toBe(false);
    });
  });

  it.openspec('OA-198')('rejects unknown related_document_ids in issues', async () => {
    const result = await safeParseWithEvidence(
      'issue unknown related_document_ids payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'doc-1': { document_id: 'doc-1', title: 'SPA' },
        },
        issues: {
          'iss-1': {
            issue_id: 'iss-1',
            title: 'Issue',
            status: 'OPEN',
            related_document_ids: ['doc-2'],
          },
        },
      },
    );

    await allureStep('Then issues cannot reference unknown documents', async () => {
      expect(result.success).toBe(false);
    });
  });

  it.openspec('OA-198')('accepts all valid stage values', async () => {
    const candidates = ['PRE_SIGNING', 'SIGNING', 'CLOSING', 'POST_CLOSING'];

    const outcomes = await allureStep('When each stage enum value is parsed', async () =>
      candidates.map((stage) => ({ stage, success: ChecklistStageEnum.safeParse(stage).success }))
    );
    await allureJsonAttachment('checklist-stage-enum-outcomes.json', outcomes);

    await allureStep('Then all declared stage values are accepted', async () => {
      for (const outcome of outcomes) {
        expect(outcome.success).toBe(true);
      }
    });
  });

  it.openspec('OA-198')('accepts all valid checklist entry status values', async () => {
    const candidates = [
      'NOT_STARTED',
      'DRAFT',
      'CIRCULATED',
      'FORM_FINAL',
      'PARTIALLY_SIGNED',
      'FULLY_EXECUTED',
      'DELIVERED',
      'FILED_OR_RECORDED',
    ];

    const outcomes = await allureStep('When each checklist entry status enum value is parsed', async () =>
      candidates.map((status) => ({ status, success: ChecklistEntryStatusEnum.safeParse(status).success }))
    );
    await allureJsonAttachment('checklist-entry-status-enum-outcomes.json', outcomes);

    await allureStep('Then all declared checklist entry statuses are accepted', async () => {
      for (const outcome of outcomes) {
        expect(outcome.success).toBe(true);
      }
    });
  });

  it.openspec('OA-100')('accepts all valid issue statuses and rejects legacy statuses', async () => {
    const outcomes = await allureStep('When issue status values are parsed', async () => ({
      open: IssueStatusEnum.safeParse('OPEN').success,
      closed: IssueStatusEnum.safeParse('CLOSED').success,
      legacyAgreedInPrinciple: IssueStatusEnum.safeParse('AGREED_IN_PRINCIPLE').success,
    }));
    await allureJsonAttachment('issue-status-enum-outcomes.json', outcomes);

    await allureStep('Then OPEN and CLOSED statuses are accepted', async () => {
      expect(outcomes.open).toBe(true);
      expect(outcomes.closed).toBe(true);
    });

    await allureStep('And legacy AGREED_IN_PRINCIPLE status is rejected', async () => {
      expect(outcomes.legacyAgreedInPrinciple).toBe(false);
    });
  });

  it.openspec('OA-198')('accepts all valid action item statuses', async () => {
    const candidates = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'];

    const outcomes = await allureStep('When each action item status enum value is parsed', async () =>
      candidates.map((status) => ({ status, success: ChecklistItemStatusEnum.safeParse(status).success }))
    );
    await allureJsonAttachment('action-item-status-enum-outcomes.json', outcomes);

    await allureStep('Then all declared action item statuses are accepted', async () => {
      for (const outcome of outcomes) {
        expect(outcome.success).toBe(true);
      }
    });
  });

  it.openspec('OA-198')('accepts all valid signatory statuses', async () => {
    const candidates = ['PENDING', 'RECEIVED', 'N_A'];

    const outcomes = await allureStep('When each signatory status enum value is parsed', async () =>
      candidates.map((status) => ({ status, success: SignatoryStatusEnum.safeParse(status).success }))
    );
    await allureJsonAttachment('signatory-status-enum-outcomes.json', outcomes);

    await allureStep('Then all declared signatory statuses are accepted', async () => {
      for (const outcome of outcomes) {
        expect(outcome.success).toBe(true);
      }
    });
  });

  it.openspec('OA-198')('signature artifact requires uri or path', async () => {
    const invalid = await safeParseWithEvidence('signature artifact missing uri and path payload', SignatureArtifactSchema, {});
    const validUri = await safeParseWithEvidence(
      'signature artifact with uri payload',
      SignatureArtifactSchema,
      { uri: 'https://drive.example.com/sig-page.pdf' },
    );
    const validPath = await safeParseWithEvidence(
      'signature artifact with path payload',
      SignatureArtifactSchema,
      { path: '/tmp/sig-page.pdf' },
    );

    await allureStep('Then signature artifact without uri/path is rejected', async () => {
      expect(invalid.success).toBe(false);
    });

    await allureStep('And signature artifact with uri is accepted', async () => {
      expect(validUri.success).toBe(true);
    });

    await allureStep('And signature artifact with path is accepted', async () => {
      expect(validPath.success).toBe(true);
    });
  });

  it.openspec('OA-198')('defaults related_document_ids on action items and issues', async () => {
    const action = await safeParseWithEvidence(
      'action item defaults payload',
      ActionItemSchema,
      {
        action_id: 'act-1',
        description: 'Do thing',
        status: 'NOT_STARTED',
      },
    );

    const issue = await safeParseWithEvidence(
      'issue defaults payload',
      IssueSchema,
      {
        issue_id: 'iss-1',
        title: 'Issue',
        status: 'OPEN',
      },
    );

    await allureStep('Then action item defaults include empty related_document_ids and citations', async () => {
      expect(action.success).toBe(true);
      if (!action.success) {
        throw new Error('Expected ActionItemSchema to parse for defaults check.');
      }
      expect(action.data.related_document_ids).toEqual([]);
      expect(action.data.citations).toEqual([]);
    });

    await allureStep('And issue defaults include empty related_document_ids and citations', async () => {
      expect(issue.success).toBe(true);
      if (!issue.success) {
        throw new Error('Expected IssueSchema to parse for defaults check.');
      }
      expect(issue.data.related_document_ids).toEqual([]);
      expect(issue.data.citations).toEqual([]);
    });
  });

  it.openspec('OA-199')('accepts citation text-only evidence payloads', async () => {
    const result = await safeParseWithEvidence(
      'citation text-only evidence payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'doc-1': { document_id: 'doc-1', title: 'Escrow Agreement' },
        },
        checklist_entries: {
          'entry-1': {
            entry_id: 'entry-1',
            document_id: 'doc-1',
            stage: 'CLOSING',
            sort_key: '100',
            title: 'Escrow Agreement',
            status: 'PARTIALLY_SIGNED',
            citations: [{ text: "Opposing counsel replied 'I agree'" }],
          },
        },
        issues: {
          'iss-1': {
            issue_id: 'iss-1',
            title: 'Escrow issue',
            status: 'OPEN',
            related_document_ids: ['doc-1'],
            citations: [{ text: 'Email confirmation', filepath: '/tmp/email.eml' }],
          },
        },
      },
    );

    await allureStep('Then citation text-only payload parses successfully', async () => {
      expect(result.success).toBe(true);
    });
  });

  it.openspec('OA-102')('rejects legacy flat payloads that omit document-first structures', async () => {
    const result = await safeParseWithEvidence(
      'legacy flat checklist payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {},

        // Legacy shape used flat entries without stable IDs and stage/sort keys.
        checklist_entries: {
          'bad-entry': {
            title: 'Legacy checklist row only',
            status: 'OPEN',
          },
        },
      },
    );

    await allureStep('Then legacy flat payload is rejected', async () => {
      expect(result.success).toBe(false);
    });
  });

  it('rejects record key that does not match item ID', async () => {
    const result = await safeParseWithEvidence(
      'key-mismatch document payload',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'wrong-key': { document_id: 'doc-1', title: 'SPA' },
        },
      },
    );

    await allureStep('Then mismatched record key is rejected', async () => {
      expect(result.success).toBe(false);
    });
  });

  it('handles z.record edge cases (undefined and null input)', async () => {
    const undefinedDocs = await safeParseWithEvidence(
      'checklist with undefined documents',
      ClosingChecklistSchema,
      { ...minimal, documents: undefined },
    );

    const nullDocs = await safeParseWithEvidence(
      'checklist with null documents',
      ClosingChecklistSchema,
      { ...minimal, documents: null },
    );

    await allureStep('Then undefined documents defaults to empty record', async () => {
      expect(undefinedDocs.success).toBe(true);
    });

    await allureStep('And null documents is rejected', async () => {
      expect(nullDocs.success).toBe(false);
    });
  });

  it('rejects dangerous keys in record collections', async () => {
    // Note: __proto__ is already stripped by Zod's z.record() parser (it never reaches superRefine).
    // The patch validator (DANGEROUS_KEYS) blocks __proto__ in JSON Pointer paths separately.
    // Here we test constructor/prototype which DO pass through Zod and must be caught by superRefine.
    const result = await safeParseWithEvidence(
      'dangerous key in documents',
      ClosingChecklistSchema,
      {
        ...minimal,
        documents: {
          'constructor': { document_id: 'constructor', title: 'Polluted' },
        },
      },
    );

    await allureStep('Then dangerous key constructor is rejected', async () => {
      expect(result.success).toBe(false);
    });
  });
});
