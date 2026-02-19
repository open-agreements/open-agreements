import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const ChecklistItemStatusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']);
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatusEnum>;

export const IssueStatusEnum = z.enum(['OPEN', 'ESCALATED', 'RESOLVED', 'DEFERRED']);
export type IssueStatus = z.infer<typeof IssueStatusEnum>;

export const EscalationTierEnum = z.enum(['YELLOW', 'RED']);
export type EscalationTier = z.infer<typeof EscalationTierEnum>;

export const DocumentStatusEnum = z.enum([
  'NOT_STARTED', 'DRAFTING', 'INTERNAL_REVIEW', 'CLIENT_REVIEW',
  'NEGOTIATING', 'FORM_FINAL', 'EXECUTED', 'ON_HOLD',
]);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

// ---------------------------------------------------------------------------
// Component schemas
// ---------------------------------------------------------------------------

export const ResponsibilitySchema = z.object({
  organization: z.string(),
  individual_name: z.string().optional(),
  role: z.string().optional(),
});
export type Responsibility = z.infer<typeof ResponsibilitySchema>;

export const WorkingGroupMemberSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  organization: z.string(),
  role: z.string().optional(),
});
export type WorkingGroupMember = z.infer<typeof WorkingGroupMemberSchema>;

export const DealDocumentSchema = z.object({
  document_name: z.string(),
  status: DocumentStatusEnum,
});
export type DealDocument = z.infer<typeof DealDocumentSchema>;

// ---------------------------------------------------------------------------
// Action items: approved to execute, not yet done
// ---------------------------------------------------------------------------

export const ActionItemSchema = z.object({
  item_id: z.string(),
  description: z.string(),
  status: ChecklistItemStatusEnum,
  assigned_to: ResponsibilitySchema,
  due_date: z.string().optional(),
  related_document_ids: z.array(z.string()).default([]),
  source_thread_id: z.string().optional(),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

// ---------------------------------------------------------------------------
// Open issues: require approval/decision before execution
// ---------------------------------------------------------------------------

export const OpenIssueSchema = z.object({
  issue_id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  status: IssueStatusEnum,
  escalation_tier: EscalationTierEnum.optional(),
  decision_maker: z.string().optional(),
  our_position: z.string().optional(),
  their_position: z.string().optional(),
  resolution: z.string().optional(),
  related_action_ids: z.array(z.string()).default([]),
  source_thread_id: z.string().optional(),
});
export type OpenIssue = z.infer<typeof OpenIssueSchema>;

// ---------------------------------------------------------------------------
// Top-level closing checklist schema
// ---------------------------------------------------------------------------

export const ClosingChecklistSchema = z.object({
  deal_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  working_group: z.array(WorkingGroupMemberSchema).default([]),
  documents: z.array(DealDocumentSchema).default([]),
  action_items: z.array(ActionItemSchema).default([]),
  open_issues: z.array(OpenIssueSchema).default([]),
});
export type ClosingChecklist = z.infer<typeof ClosingChecklistSchema>;
