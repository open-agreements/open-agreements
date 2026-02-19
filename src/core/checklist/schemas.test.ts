import { describe, it, expect } from 'vitest';
import {
  ClosingChecklistSchema,
  ChecklistItemStatusEnum,
  IssueStatusEnum,
  EscalationTierEnum,
  DocumentStatusEnum,
  ActionItemSchema,
  OpenIssueSchema,
} from './schemas.js';

describe('ClosingChecklistSchema', () => {
  const minimal = {
    deal_name: 'Acme / BigCo Series A',
    created_at: '2026-01-15',
    updated_at: '2026-02-18',
  };

  it('parses minimal valid input', () => {
    const result = ClosingChecklistSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deal_name).toBe('Acme / BigCo Series A');
      expect(result.data.working_group).toEqual([]);
      expect(result.data.documents).toEqual([]);
      expect(result.data.action_items).toEqual([]);
      expect(result.data.open_issues).toEqual([]);
    }
  });

  it('parses full input with all sections', () => {
    const full = {
      ...minimal,
      working_group: [
        { name: 'Jane Doe', email: 'jane@acme.com', organization: 'Acme Corp', role: 'Lead Counsel' },
      ],
      documents: [
        { document_name: 'Stock Purchase Agreement', status: 'DRAFTING' },
      ],
      action_items: [
        {
          item_id: 'AI-001',
          description: 'Review SPA draft',
          status: 'IN_PROGRESS',
          assigned_to: { organization: 'Acme Corp', individual_name: 'Jane Doe' },
          due_date: '2026-02-25',
        },
      ],
      open_issues: [
        {
          issue_id: 'OI-001',
          title: 'Indemnification cap',
          status: 'OPEN',
          escalation_tier: 'YELLOW',
          our_position: '2x purchase price',
          their_position: '1x purchase price',
        },
      ],
    };

    const result = ClosingChecklistSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.working_group).toHaveLength(1);
      expect(result.data.documents).toHaveLength(1);
      expect(result.data.action_items).toHaveLength(1);
      expect(result.data.open_issues).toHaveLength(1);
    }
  });

  it('rejects missing deal_name', () => {
    const result = ClosingChecklistSchema.safeParse({
      created_at: '2026-01-15',
      updated_at: '2026-02-18',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action item status', () => {
    const result = ActionItemSchema.safeParse({
      item_id: 'AI-001',
      description: 'Test',
      status: 'INVALID_STATUS',
      assigned_to: { organization: 'Acme' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid issue status', () => {
    const result = OpenIssueSchema.safeParse({
      issue_id: 'OI-001',
      title: 'Test',
      status: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid checklist item statuses', () => {
    for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']) {
      expect(ChecklistItemStatusEnum.safeParse(status).success).toBe(true);
    }
  });

  it('accepts all valid issue statuses', () => {
    for (const status of ['OPEN', 'ESCALATED', 'RESOLVED', 'DEFERRED']) {
      expect(IssueStatusEnum.safeParse(status).success).toBe(true);
    }
  });

  it('accepts all valid escalation tiers', () => {
    for (const tier of ['YELLOW', 'RED']) {
      expect(EscalationTierEnum.safeParse(tier).success).toBe(true);
    }
  });

  it('accepts all valid document statuses', () => {
    for (const status of [
      'NOT_STARTED', 'DRAFTING', 'INTERNAL_REVIEW', 'CLIENT_REVIEW',
      'NEGOTIATING', 'FORM_FINAL', 'EXECUTED', 'ON_HOLD',
    ]) {
      expect(DocumentStatusEnum.safeParse(status).success).toBe(true);
    }
  });

  it('defaults related_document_ids to empty array', () => {
    const result = ActionItemSchema.safeParse({
      item_id: 'AI-001',
      description: 'Test',
      status: 'NOT_STARTED',
      assigned_to: { organization: 'Acme' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.related_document_ids).toEqual([]);
    }
  });

  it('defaults related_action_ids to empty array', () => {
    const result = OpenIssueSchema.safeParse({
      issue_id: 'OI-001',
      title: 'Test',
      status: 'OPEN',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.related_action_ids).toEqual([]);
    }
  });
});
