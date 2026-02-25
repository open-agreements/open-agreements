import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const ChecklistItemStatusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']);
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatusEnum>;

export const IssueStatusEnum = z.enum(['OPEN', 'CLOSED']);
export type IssueStatus = z.infer<typeof IssueStatusEnum>;

export const ChecklistStageEnum = z.enum(['PRE_SIGNING', 'SIGNING', 'CLOSING', 'POST_CLOSING']);
export type ChecklistStage = z.infer<typeof ChecklistStageEnum>;

export const ChecklistEntryStatusEnum = z.enum([
  'NOT_STARTED',
  'DRAFT',
  'CIRCULATED',
  'FORM_FINAL',
  'PARTIALLY_SIGNED',
  'FULLY_EXECUTED',
  'DELIVERED',
  'FILED_OR_RECORDED',
]);
export type ChecklistEntryStatus = z.infer<typeof ChecklistEntryStatusEnum>;

export const SignatoryStatusEnum = z.enum(['PENDING', 'RECEIVED', 'N_A']);
export type SignatoryStatus = z.infer<typeof SignatoryStatusEnum>;

// ---------------------------------------------------------------------------
// Component schemas
// ---------------------------------------------------------------------------

export const ResponsibilitySchema = z.object({
  organization: z.string().optional(),
  individual_name: z.string().optional(),
  role: z.string().optional(),
});
export type Responsibility = z.infer<typeof ResponsibilitySchema>;

export const CitationSchema = z.object({
  ref: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  link: z.string().min(1).optional(),
  filepath: z.string().min(1).optional(),
}).superRefine((citation, ctx) => {
  if (!citation.ref && !citation.text) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['text'],
      message: 'citation requires at least one of text or ref',
    });
  }
});
export type Citation = z.infer<typeof CitationSchema>;

export const SignatureArtifactSchema = z.object({
  uri: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  received_at: z.string().optional(),
}).superRefine((artifact, ctx) => {
  if (!artifact.uri && !artifact.path) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['uri'],
      message: 'signature artifact requires at least one of uri or path',
    });
  }
});
export type SignatureArtifact = z.infer<typeof SignatureArtifactSchema>;

export const SignatorySchema = z.object({
  party: z.string().min(1),
  name: z.string().optional(),
  title: z.string().optional(),
  status: SignatoryStatusEnum,
  signature_artifacts: z.array(SignatureArtifactSchema).default([]),
});
export type Signatory = z.infer<typeof SignatorySchema>;

export const ChecklistDocumentSchema = z.object({
  document_id: z.string().min(1),
  title: z.string().min(1),
  primary_link: z.string().min(1).optional(),
  labels: z.array(z.string().min(1)).default([]),
});
export type ChecklistDocument = z.infer<typeof ChecklistDocumentSchema>;

export const ChecklistEntrySchema = z.object({
  entry_id: z.string().min(1),
  document_id: z.string().min(1).optional(),
  stage: ChecklistStageEnum,
  sort_key: z.string().min(1),
  title: z.string().min(1),
  status: ChecklistEntryStatusEnum,
  parent_entry_id: z.string().min(1).optional(),
  responsible_party: ResponsibilitySchema.optional(),
  citations: z.array(CitationSchema).default([]),
  signatories: z.array(SignatorySchema).default([]),
});
export type ChecklistEntry = z.infer<typeof ChecklistEntrySchema>;

export const ActionItemSchema = z.object({
  action_id: z.string().min(1),
  description: z.string().min(1),
  status: ChecklistItemStatusEnum,
  assigned_to: ResponsibilitySchema.optional(),
  due_date: z.string().optional(),
  related_document_ids: z.array(z.string().min(1)).default([]),
  citations: z.array(CitationSchema).default([]),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const IssueSchema = z.object({
  issue_id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  status: IssueStatusEnum,
  related_document_ids: z.array(z.string().min(1)).default([]),
  citations: z.array(CitationSchema).default([]),
});
export type Issue = z.infer<typeof IssueSchema>;

import { DANGEROUS_KEYS } from './patch-validator.js';

const ClosingChecklistBaseSchema = z.object({
  deal_name: z.string().min(1),
  updated_at: z.string().min(1),
  documents: z.record(z.string(), ChecklistDocumentSchema).default({}),
  checklist_entries: z.record(z.string(), ChecklistEntrySchema).default({}),
  action_items: z.record(z.string(), ActionItemSchema).default({}),
  issues: z.record(z.string(), IssueSchema).default({}),
});

// ---------------------------------------------------------------------------
// Top-level closing checklist schema with referential integrity rules
// ---------------------------------------------------------------------------

export const ClosingChecklistSchema = ClosingChecklistBaseSchema.superRefine((checklist, ctx) => {
  // Key policy: reject dangerous keys in all collections
  for (const collectionName of ['documents', 'checklist_entries', 'action_items', 'issues'] as const) {
    for (const key of Object.keys(checklist[collectionName])) {
      if (DANGEROUS_KEYS.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [collectionName, key],
          message: `record key "${key}" is a disallowed key`,
        });
      }
    }
  }

  // Key-value consistency: dict key must match item ID
  const knownDocumentIds = new Set<string>();
  for (const [key, document] of Object.entries(checklist.documents)) {
    if (key !== document.document_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documents', key, 'document_id'],
        message: `record key "${key}" does not match document_id "${document.document_id}"`,
      });
    }
    knownDocumentIds.add(document.document_id);
  }

  const documentToEntry = new Map<string, string>();
  const entriesById = new Map<string, ChecklistEntry>();

  for (const [key, entry] of Object.entries(checklist.checklist_entries)) {
    if (key !== entry.entry_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', key, 'entry_id'],
        message: `record key "${key}" does not match entry_id "${entry.entry_id}"`,
      });
    }
    entriesById.set(entry.entry_id, entry);

    if (entry.document_id) {
      if (!knownDocumentIds.has(entry.document_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checklist_entries', key, 'document_id'],
          message: `unknown document_id "${entry.document_id}"`,
        });
      }

      const mappedEntryId = documentToEntry.get(entry.document_id);
      if (mappedEntryId && mappedEntryId !== entry.entry_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checklist_entries', key, 'document_id'],
          message: `document_id "${entry.document_id}" is already mapped to entry_id "${mappedEntryId}"`,
        });
      } else {
        documentToEntry.set(entry.document_id, entry.entry_id);
      }
    }
  }

  for (const [key, entry] of Object.entries(checklist.checklist_entries)) {
    if (!entry.parent_entry_id) continue;
    const parent = entriesById.get(entry.parent_entry_id);
    if (!parent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', key, 'parent_entry_id'],
        message: `unknown parent_entry_id "${entry.parent_entry_id}"`,
      });
      continue;
    }
    if (entry.parent_entry_id === entry.entry_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', key, 'parent_entry_id'],
        message: 'entry cannot be its own parent',
      });
    }
    if (parent.stage !== entry.stage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', key, 'parent_entry_id'],
        message: `parent entry "${entry.parent_entry_id}" is in stage ${parent.stage}, but child is in ${entry.stage}`,
      });
    }
  }

  for (const [key, action] of Object.entries(checklist.action_items)) {
    if (key !== action.action_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action_items', key, 'action_id'],
        message: `record key "${key}" does not match action_id "${action.action_id}"`,
      });
    }
    action.related_document_ids.forEach((documentId, docIdx) => {
      if (!knownDocumentIds.has(documentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['action_items', key, 'related_document_ids', docIdx],
          message: `unknown related document_id "${documentId}"`,
        });
      }
    });
  }

  for (const [key, issue] of Object.entries(checklist.issues)) {
    if (key !== issue.issue_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['issues', key, 'issue_id'],
        message: `record key "${key}" does not match issue_id "${issue.issue_id}"`,
      });
    }
    issue.related_document_ids.forEach((documentId, docIdx) => {
      if (!knownDocumentIds.has(documentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['issues', key, 'related_document_ids', docIdx],
          message: `unknown related document_id "${documentId}"`,
        });
      }
    });
  }
});
export type ClosingChecklist = z.infer<typeof ClosingChecklistSchema>;
