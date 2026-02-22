import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
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

describe('ClosingChecklistSchema v2', () => {
  const minimal = {
    deal_name: 'Acme / BigCo Series A',
    updated_at: '2026-02-22',
  };

  it('parses minimal valid input', () => {
    const result = ClosingChecklistSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documents).toEqual([]);
      expect(result.data.checklist_entries).toEqual([]);
      expect(result.data.action_items).toEqual([]);
      expect(result.data.issues).toEqual([]);
    }
  });

  it('accepts full input with documents, entries, signatories, and links', () => {
    const full = {
      ...minimal,
      documents: [
        {
          document_id: 'escrow-agreement-executed',
          title: 'Escrow Agreement (Executed)',
          primary_link: 'https://drive.example.com/escrow-executed',
          labels: ['phase:closing'],
        },
      ],
      checklist_entries: [
        {
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
      ],
      action_items: [
        {
          action_id: 'act-1',
          description: 'Finalize funds flow memo',
          status: 'IN_PROGRESS',
          related_document_ids: ['escrow-agreement-executed'],
        },
      ],
      issues: [
        {
          issue_id: 'iss-1',
          title: 'Escrow release mechanics',
          status: 'OPEN',
          related_document_ids: ['escrow-agreement-executed'],
        },
      ],
    };

    const result = ClosingChecklistSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('accepts stable string IDs that are not UUIDs', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      documents: [{ document_id: 'doc-spa-form-v4', title: 'SPA (Form)' }],
      checklist_entries: [{
        entry_id: 'entry-spa-form-v4',
        document_id: 'doc-spa-form-v4',
        stage: 'SIGNING',
        sort_key: '100',
        title: 'SPA (Form)',
        status: 'FORM_FINAL',
      }],
    });
    expect(result.success).toBe(true);
  });

  it('allows checklist entries with no document_id', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      checklist_entries: [{
        entry_id: 'entry-order-good-standing',
        stage: 'PRE_SIGNING',
        sort_key: '020',
        title: 'Order Delaware good standing certificate',
        status: 'NOT_STARTED',
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects checklist entry pointing to unknown document', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      documents: [{ document_id: 'doc-1', title: 'SPA' }],
      checklist_entries: [{
        entry_id: 'entry-1',
        document_id: 'doc-404',
        stage: 'SIGNING',
        sort_key: '100',
        title: 'SPA',
        status: 'FORM_FINAL',
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects mapping one document to multiple checklist entries', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      documents: [{ document_id: 'doc-1', title: 'Escrow Agreement' }],
      checklist_entries: [
        {
          entry_id: 'entry-1',
          document_id: 'doc-1',
          stage: 'SIGNING',
          sort_key: '100',
          title: 'Escrow Agreement (Form)',
          status: 'FORM_FINAL',
        },
        {
          entry_id: 'entry-2',
          document_id: 'doc-1',
          stage: 'CLOSING',
          sort_key: '200',
          title: 'Escrow Agreement (Executed)',
          status: 'FULLY_EXECUTED',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects parent_entry_id that points to different stage', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      checklist_entries: [
        {
          entry_id: 'entry-parent',
          stage: 'SIGNING',
          sort_key: '100',
          title: 'Parent',
          status: 'FORM_FINAL',
        },
        {
          entry_id: 'entry-child',
          parent_entry_id: 'entry-parent',
          stage: 'CLOSING',
          sort_key: '110',
          title: 'Child',
          status: 'NOT_STARTED',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown related_document_ids in action items', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      documents: [{ document_id: 'doc-1', title: 'SPA' }],
      action_items: [{
        action_id: 'act-1',
        description: 'Do thing',
        status: 'IN_PROGRESS',
        related_document_ids: ['doc-2'],
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown related_document_ids in issues', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      documents: [{ document_id: 'doc-1', title: 'SPA' }],
      issues: [{
        issue_id: 'iss-1',
        title: 'Issue',
        status: 'OPEN',
        related_document_ids: ['doc-2'],
      }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid stage values', () => {
    for (const stage of ['PRE_SIGNING', 'SIGNING', 'CLOSING', 'POST_CLOSING']) {
      expect(ChecklistStageEnum.safeParse(stage).success).toBe(true);
    }
  });

  it('accepts all valid checklist entry status values', () => {
    for (const status of [
      'NOT_STARTED',
      'DRAFT',
      'CIRCULATED',
      'FORM_FINAL',
      'PARTIALLY_SIGNED',
      'FULLY_EXECUTED',
      'DELIVERED',
      'FILED_OR_RECORDED',
    ]) {
      expect(ChecklistEntryStatusEnum.safeParse(status).success).toBe(true);
    }
  });

  it('accepts all valid issue statuses and rejects legacy statuses', () => {
    expect(IssueStatusEnum.safeParse('OPEN').success).toBe(true);
    expect(IssueStatusEnum.safeParse('CLOSED').success).toBe(true);
    expect(IssueStatusEnum.safeParse('AGREED_IN_PRINCIPLE').success).toBe(false);
  });

  it('accepts all valid action item statuses', () => {
    for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']) {
      expect(ChecklistItemStatusEnum.safeParse(status).success).toBe(true);
    }
  });

  it('accepts all valid signatory statuses', () => {
    for (const status of ['PENDING', 'RECEIVED', 'N_A']) {
      expect(SignatoryStatusEnum.safeParse(status).success).toBe(true);
    }
  });

  it('signature artifact requires uri or path', () => {
    const invalid = SignatureArtifactSchema.safeParse({});
    expect(invalid.success).toBe(false);
    const validUri = SignatureArtifactSchema.safeParse({ uri: 'https://drive.example.com/sig-page.pdf' });
    expect(validUri.success).toBe(true);
    const validPath = SignatureArtifactSchema.safeParse({ path: '/tmp/sig-page.pdf' });
    expect(validPath.success).toBe(true);
  });

  it('defaults related_document_ids on action items and issues', () => {
    const action = ActionItemSchema.safeParse({
      action_id: 'act-1',
      description: 'Do thing',
      status: 'NOT_STARTED',
    });
    expect(action.success).toBe(true);
    if (action.success) {
      expect(action.data.related_document_ids).toEqual([]);
      expect(action.data.citations).toEqual([]);
    }

    const issue = IssueSchema.safeParse({
      issue_id: 'iss-1',
      title: 'Issue',
      status: 'OPEN',
    });
    expect(issue.success).toBe(true);
    if (issue.success) {
      expect(issue.data.related_document_ids).toEqual([]);
      expect(issue.data.citations).toEqual([]);
    }
  });

  it('accepts citation text-only evidence payloads', () => {
    const result = ClosingChecklistSchema.safeParse({
      ...minimal,
      documents: [{ document_id: 'doc-1', title: 'Escrow Agreement' }],
      checklist_entries: [{
        entry_id: 'entry-1',
        document_id: 'doc-1',
        stage: 'CLOSING',
        sort_key: '100',
        title: 'Escrow Agreement',
        status: 'PARTIALLY_SIGNED',
        citations: [{ text: "Opposing counsel replied 'I agree'" }],
      }],
      issues: [{
        issue_id: 'iss-1',
        title: 'Escrow issue',
        status: 'OPEN',
        related_document_ids: ['doc-1'],
        citations: [{ text: 'Email confirmation', filepath: '/tmp/email.eml' }],
      }],
    });
    expect(result.success).toBe(true);
  });
});
