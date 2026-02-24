import {
  ClosingChecklistSchema,
  type ActionItem,
  type Citation,
  type ChecklistDocument,
  type ChecklistEntry,
  type ChecklistStage,
  type ClosingChecklist,
  type Issue,
  type Responsibility,
  type Signatory,
} from './schemas.js';

export { ClosingChecklistSchema, type ClosingChecklist } from './schemas.js';
export {
  ChecklistPatchModeEnum,
  JsonPointerSchema,
  PatchCitationSchema,
  ChecklistPatchSourceEventSchema,
  ChecklistPatchOperationSchema,
  ChecklistPatchEnvelopeSchema,
  ChecklistPatchApplyRequestSchema,
  type ChecklistPatchMode,
  type JsonPointer,
  type PatchCitation,
  type ChecklistPatchSourceEvent,
  type ChecklistPatchOperation,
  type ChecklistPatchEnvelope,
  type ChecklistPatchApplyRequest,
} from './patch-schemas.js';
export {
  CHECKLIST_PATCH_VALIDATION_TTL_MS,
  DANGEROUS_KEYS,
  applyChecklistPatchOperations,
  computeChecklistPatchHash,
  validateChecklistPatch,
  getChecklistPatchValidationArtifact,
  setChecklistPatchValidationStore,
  getChecklistPatchValidationStore,
  type ChecklistPatchValidationErrorCode,
  type ChecklistPatchValidationDiagnostic,
  type ResolvedChecklistPatchOperation,
  type ChecklistPatchValidationArtifact,
  type ChecklistPatchValidationStore,
  type ValidateChecklistPatchInput,
  type ChecklistPatchValidationSuccess,
  type ChecklistPatchValidationFailure,
  type ChecklistPatchValidationResult,
} from './patch-validator.js';
export {
  applyChecklistPatch,
  setChecklistAppliedPatchStore,
  getChecklistAppliedPatchStore,
  setChecklistProposedPatchStore,
  getChecklistProposedPatchStore,
  type ChecklistAppliedPatchRecord,
  type ChecklistAppliedPatchStore,
  type ChecklistProposedPatchRecord,
  type ChecklistProposedPatchStore,
  type ChecklistPatchApplyErrorCode,
  type ChecklistPatchApplyFailure,
  type ChecklistPatchApplySuccess,
  type ChecklistPatchApplyResult,
  type ApplyChecklistPatchInput,
} from './patch-apply.js';

const STAGE_ORDER: ChecklistStage[] = ['PRE_SIGNING', 'SIGNING', 'CLOSING', 'POST_CLOSING'];
const STAGE_HEADINGS: Record<ChecklistStage, string> = {
  PRE_SIGNING: 'PRE-SIGNING',
  SIGNING: 'SIGNING',
  CLOSING: 'CLOSING',
  POST_CLOSING: 'POST-CLOSING',
};
const STAGE_ROMANS = ['I', 'II', 'III', 'IV'] as const;

interface RenderRow {
  entry: ChecklistEntry;
  document: ChecklistDocument | null;
  number: string;
  depth: number;
  linkedActions: ActionItem[];
  linkedIssues: Issue[];
}

interface RenderModel {
  checklist: ClosingChecklist;
  rowsByStage: Map<ChecklistStage, RenderRow[]>;
  unlinkedActions: ActionItem[];
  unlinkedIssues: Issue[];
}

interface LegacyTemplateDocumentRow {
  document_name: string;
  status: string;
}

interface LegacyTemplateActionRow {
  item_id: string;
  description: string;
  status: string;
  assigned_to: {
    organization: string;
  };
  due_date: string;
}

interface LegacyTemplateIssueRow {
  issue_id: string;
  title: string;
  status: string;
  escalation_tier: string;
  resolution: string;
}

export interface ChecklistTemplateContext {
  deal_name: string;
  updated_at: string;
  // Template compatibility placeholders (kept empty in v2 model).
  working_group: Array<Record<string, unknown>>;
  documents: LegacyTemplateDocumentRow[];
  action_items: LegacyTemplateActionRow[];
  open_issues: LegacyTemplateIssueRow[];
}

function compareBySortKey(a: { sort_key: string; entry_id: string }, b: { sort_key: string; entry_id: string }): number {
  const keyCompare = a.sort_key.localeCompare(b.sort_key, undefined, { numeric: true, sensitivity: 'base' });
  if (keyCompare !== 0) return keyCompare;
  return a.entry_id.localeCompare(b.entry_id);
}

function nonEmpty(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v.length > 0);
}

function responsibilityLabel(responsibility?: Responsibility): string {
  if (!responsibility) return '';
  return nonEmpty([
    responsibility.individual_name ?? '',
    responsibility.organization ?? '',
    responsibility.role ?? '',
  ]).join(', ');
}

function citationLabel(citation: Citation): string {
  const base = citation.text ?? citation.ref ?? '';
  const sources = nonEmpty([citation.link ?? '', citation.filepath ?? '']);
  if (!base) return sources.join(' | ');
  if (sources.length === 0) return base;
  return `${base} (${sources.join(' | ')})`;
}

function latestCitationLabel(citations: Citation[]): string {
  if (citations.length === 0) return '';
  return citationLabel(citations[citations.length - 1]!);
}

function signatoryLabel(signatory: Signatory): string {
  const who = nonEmpty([signatory.party, signatory.name ?? '', signatory.title ?? '']).join(' ');
  const artifacts = signatory.signature_artifacts
    .map((artifact) => artifact.uri ?? artifact.path ?? '')
    .filter((value) => value.length > 0);
  if (artifacts.length === 0) {
    return `${who} [${signatory.status}]`;
  }
  return `${who} [${signatory.status}] (${artifacts.join(', ')})`;
}

function buildRenderModel(data: unknown): RenderModel {
  const checklist = ClosingChecklistSchema.parse(data);
  const documentsById = new Map(checklist.documents.map((document) => [document.document_id, document]));
  const entryDocumentIds = new Set(
    checklist.checklist_entries
      .map((entry) => entry.document_id)
      .filter((documentId): documentId is string => Boolean(documentId)),
  );

  const actionsByDocument = new Map<string, ActionItem[]>();
  const unlinkedActions: ActionItem[] = [];
  for (const action of checklist.action_items) {
    const linkedDocumentIds = action.related_document_ids.filter((documentId) => entryDocumentIds.has(documentId));
    if (linkedDocumentIds.length === 0) {
      unlinkedActions.push(action);
      continue;
    }
    for (const documentId of linkedDocumentIds) {
      const current = actionsByDocument.get(documentId) ?? [];
      current.push(action);
      actionsByDocument.set(documentId, current);
    }
  }

  const issuesByDocument = new Map<string, Issue[]>();
  const unlinkedIssues: Issue[] = [];
  for (const issue of checklist.issues) {
    const linkedDocumentIds = issue.related_document_ids.filter((documentId) => entryDocumentIds.has(documentId));
    if (linkedDocumentIds.length === 0) {
      unlinkedIssues.push(issue);
      continue;
    }
    for (const documentId of linkedDocumentIds) {
      const current = issuesByDocument.get(documentId) ?? [];
      current.push(issue);
      issuesByDocument.set(documentId, current);
    }
  }

  for (const actions of actionsByDocument.values()) {
    actions.sort((a, b) => a.action_id.localeCompare(b.action_id));
  }
  for (const issues of issuesByDocument.values()) {
    issues.sort((a, b) => a.issue_id.localeCompare(b.issue_id));
  }
  unlinkedActions.sort((a, b) => a.action_id.localeCompare(b.action_id));
  unlinkedIssues.sort((a, b) => a.issue_id.localeCompare(b.issue_id));

  const rowsByStage = new Map<ChecklistStage, RenderRow[]>();

  for (const stage of STAGE_ORDER) {
    const stageEntries = checklist.checklist_entries
      .filter((entry) => entry.stage === stage)
      .sort(compareBySortKey);
    const stageEntriesById = new Map(stageEntries.map((entry) => [entry.entry_id, entry]));
    const childrenByParent = new Map<string, ChecklistEntry[]>();
    const roots: ChecklistEntry[] = [];

    for (const entry of stageEntries) {
      if (entry.parent_entry_id && stageEntriesById.has(entry.parent_entry_id)) {
        const children = childrenByParent.get(entry.parent_entry_id) ?? [];
        children.push(entry);
        childrenByParent.set(entry.parent_entry_id, children);
      } else {
        roots.push(entry);
      }
    }

    roots.sort(compareBySortKey);
    for (const [parentId, children] of childrenByParent.entries()) {
      children.sort(compareBySortKey);
      childrenByParent.set(parentId, children);
    }

    const stageRows: RenderRow[] = [];
    const visit = (entry: ChecklistEntry, depth: number, number: string): void => {
      const document = entry.document_id ? (documentsById.get(entry.document_id) ?? null) : null;
      stageRows.push({
        entry,
        document,
        number,
        depth,
        linkedActions: entry.document_id ? (actionsByDocument.get(entry.document_id) ?? []) : [],
        linkedIssues: entry.document_id ? (issuesByDocument.get(entry.document_id) ?? []) : [],
      });

      const children = childrenByParent.get(entry.entry_id) ?? [];
      children.forEach((child, index) => {
        visit(child, depth + 1, `${number}.${index + 1}`);
      });
    };

    roots.forEach((entry, index) => {
      visit(entry, 0, `${index + 1}`);
    });

    rowsByStage.set(stage, stageRows);
  }

  return {
    checklist,
    rowsByStage,
    unlinkedActions,
    unlinkedIssues,
  };
}

/**
 * Build template values for the legacy closing-checklist DOCX template from
 * document-first v2 checklist input.
 */
export function buildChecklistTemplateContext(data: unknown): ChecklistTemplateContext {
  const model = buildRenderModel(data);
  const documentRows: LegacyTemplateDocumentRow[] = [];

  STAGE_ORDER.forEach((stage, index) => {
    const stageRows = model.rowsByStage.get(stage) ?? [];
    if (stageRows.length === 0) return;
    documentRows.push({
      document_name: `${STAGE_ROMANS[index]}. ${STAGE_HEADINGS[stage]}`,
      status: '',
    });

    for (const row of stageRows) {
      const indent = '\u00A0\u00A0'.repeat(row.depth);
      const citationText = row.entry.citations.map(citationLabel).join('; ');
      const linkText = row.document?.primary_link ? ` (${row.document.primary_link})` : '';
      const documentName = `${row.number} ${indent}${row.entry.title}${citationText ? ` [${citationText}]` : ''}${linkText}`;

      const statusParts: string[] = [row.entry.status];
      if (row.entry.signatories.length > 0) {
        statusParts.push(row.entry.signatories.map(signatoryLabel).join('; '));
      }
      const responsibility = responsibilityLabel(row.entry.responsible_party);
      if (responsibility) {
        statusParts.push(`Resp: ${responsibility}`);
      }

      documentRows.push({
        document_name: documentName,
        status: statusParts.join(' | '),
      });

      for (const action of row.linkedActions) {
        const latestCitation = latestCitationLabel(action.citations);
        documentRows.push({
          document_name: `\u00A0\u00A0${indent}\u21B3 Action ${action.action_id}: ${action.description}`,
          status: latestCitation ? `${action.status} | Evidence: ${latestCitation}` : action.status,
        });
      }
      for (const issue of row.linkedIssues) {
        const latestCitation = latestCitationLabel(issue.citations);
        documentRows.push({
          document_name: `\u00A0\u00A0${indent}\u21B3 Issue ${issue.issue_id}: ${issue.title}`,
          status: latestCitation ? `${issue.status} | Evidence: ${latestCitation}` : issue.status,
        });
      }
    }
  });

  const fallbackActions: LegacyTemplateActionRow[] = model.unlinkedActions.map((action) => ({
    item_id: action.action_id,
    description: action.description,
    status: latestCitationLabel(action.citations) ? `${action.status} | ${latestCitationLabel(action.citations)}` : action.status,
    assigned_to: {
      organization: responsibilityLabel(action.assigned_to) || '',
    },
    due_date: action.due_date ?? '',
  }));

  const fallbackIssues: LegacyTemplateIssueRow[] = model.unlinkedIssues.map((issue) => ({
    issue_id: issue.issue_id,
    title: issue.title,
    status: issue.status,
    escalation_tier: '',
    resolution: nonEmpty([issue.summary ?? '', latestCitationLabel(issue.citations)]).join(' | '),
  }));

  return {
    deal_name: model.checklist.deal_name,
    updated_at: model.checklist.updated_at,
    working_group: [],
    documents: documentRows,
    action_items: fallbackActions,
    open_issues: fallbackIssues,
  };
}

