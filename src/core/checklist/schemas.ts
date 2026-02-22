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

const ClosingChecklistBaseSchema = z.object({
  deal_name: z.string().min(1),
  updated_at: z.string().min(1),
  documents: z.array(ChecklistDocumentSchema).default([]),
  checklist_entries: z.array(ChecklistEntrySchema).default([]),
  action_items: z.array(ActionItemSchema).default([]),
  issues: z.array(IssueSchema).default([]),
});

// ---------------------------------------------------------------------------
// Top-level closing checklist schema with referential integrity rules
// ---------------------------------------------------------------------------

export const ClosingChecklistSchema = ClosingChecklistBaseSchema.superRefine((checklist, ctx) => {
  const documentIds = new Map<string, number>();
  checklist.documents.forEach((document, index) => {
    const seen = documentIds.get(document.document_id);
    if (seen !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documents', index, 'document_id'],
        message: `duplicate document_id "${document.document_id}" (already used at documents.${seen}.document_id)`,
      });
    } else {
      documentIds.set(document.document_id, index);
    }
  });

  const entryIds = new Map<string, number>();
  const documentToEntry = new Map<string, string>();
  const entriesById = new Map<string, ChecklistEntry>();

  checklist.checklist_entries.forEach((entry, index) => {
    const seen = entryIds.get(entry.entry_id);
    if (seen !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', index, 'entry_id'],
        message: `duplicate entry_id "${entry.entry_id}" (already used at checklist_entries.${seen}.entry_id)`,
      });
    } else {
      entryIds.set(entry.entry_id, index);
    }
    entriesById.set(entry.entry_id, entry);

    if (entry.document_id) {
      if (!documentIds.has(entry.document_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checklist_entries', index, 'document_id'],
          message: `unknown document_id "${entry.document_id}"`,
        });
      }

      const mappedEntryId = documentToEntry.get(entry.document_id);
      if (mappedEntryId && mappedEntryId !== entry.entry_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['checklist_entries', index, 'document_id'],
          message: `document_id "${entry.document_id}" is already mapped to entry_id "${mappedEntryId}"`,
        });
      } else {
        documentToEntry.set(entry.document_id, entry.entry_id);
      }
    }
  });

  checklist.checklist_entries.forEach((entry, index) => {
    if (!entry.parent_entry_id) return;
    const parent = entriesById.get(entry.parent_entry_id);
    if (!parent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', index, 'parent_entry_id'],
        message: `unknown parent_entry_id "${entry.parent_entry_id}"`,
      });
      return;
    }
    if (entry.parent_entry_id === entry.entry_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', index, 'parent_entry_id'],
        message: 'entry cannot be its own parent',
      });
    }
    if (parent.stage !== entry.stage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checklist_entries', index, 'parent_entry_id'],
        message: `parent entry "${entry.parent_entry_id}" is in stage ${parent.stage}, but child is in ${entry.stage}`,
      });
    }
  });

  const knownDocumentIds = new Set(checklist.documents.map((d) => d.document_id));
  checklist.action_items.forEach((action, index) => {
    action.related_document_ids.forEach((documentId, docIdx) => {
      if (!knownDocumentIds.has(documentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['action_items', index, 'related_document_ids', docIdx],
          message: `unknown related document_id "${documentId}"`,
        });
      }
    });
  });

  checklist.issues.forEach((issue, index) => {
    issue.related_document_ids.forEach((documentId, docIdx) => {
      if (!knownDocumentIds.has(documentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['issues', index, 'related_document_ids', docIdx],
          message: `unknown related document_id "${documentId}"`,
        });
      }
    });
  });
});
export type ClosingChecklist = z.infer<typeof ClosingChecklistSchema>;
