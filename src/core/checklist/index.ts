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
import { humanStatus } from './status-labels.js';

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
export { humanStatus, STATUS_LABELS } from './status-labels.js';
export {
  createChecklist,
  listChecklists,
  resolveChecklist,
  getChecklistState,
  saveChecklistState,
  appendHistory,
  getHistory,
  ChecklistStateSchema,
  type ChecklistState,
  type ChecklistMeta,
  type ChecklistSummary,
  type HistoryRecord,
} from './state-manager.js';
export { appendJsonl, readJsonl } from './jsonl-stores.js';

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

// ---------------------------------------------------------------------------
// 4-column document row: Number | Title | Status | Responsible Party
// ---------------------------------------------------------------------------

interface TemplateDocumentRow {
  number: string;
  title: string;
  status: string;
  responsible_party: string;
}

interface TemplateActionRow {
  item_id: string;
  description: string;
  status: string;
  assigned_to: string;
  due_date: string;
}

interface TemplateIssueRow {
  issue_id: string;
  title: string;
  status: string;
  summary: string;
}

export interface ChecklistTemplateContext {
  deal_name: string;
  updated_at: string;
  documents: TemplateDocumentRow[];
  action_items: TemplateActionRow[];
  open_issues: TemplateIssueRow[];
}

function compareBySortKey(
  a: { sort_key?: string; entry_id: string },
  b: { sort_key?: string; entry_id: string },
): number {
  const aKey = a.sort_key ?? '';
  const bKey = b.sort_key ?? '';
  if (aKey || bKey) {
    const keyCompare = aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
    if (keyCompare !== 0) return keyCompare;
  }
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
  return `${who}: ${humanStatus(signatory.status)}`;
}

function toArray<T>(collection: T[] | Record<string, T>): T[] {
  return Array.isArray(collection) ? collection : Object.values(collection);
}

function assignAutoSortKeys(entries: ChecklistEntry[]): void {
  const byStage = new Map<string, ChecklistEntry[]>();
  for (const entry of entries) {
    if (entry.sort_key) continue;
    const group = byStage.get(entry.stage) ?? [];
    group.push(entry);
    byStage.set(entry.stage, group);
  }
  for (const group of byStage.values()) {
    group.forEach((entry, index) => {
      entry.sort_key = String((index + 1) * 100);
    });
  }
}

function buildRenderModel(data: unknown): RenderModel {
  const checklist = ClosingChecklistSchema.parse(data);
  const documents = toArray(checklist.documents);
  const entries = toArray(checklist.checklist_entries);
  const actions = toArray(checklist.action_items);
  const issues = toArray(checklist.issues);

  assignAutoSortKeys(entries);

  const documentsById = new Map(documents.map((document) => [document.document_id, document]));
  const entryDocumentIds = new Set(
    entries
      .map((entry) => entry.document_id)
      .filter((documentId): documentId is string => Boolean(documentId)),
  );

  const actionsByDocument = new Map<string, ActionItem[]>();
  const unlinkedActions: ActionItem[] = [];
  for (const action of actions) {
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
  for (const issue of issues) {
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

  for (const actionGroup of actionsByDocument.values()) {
    actionGroup.sort((a, b) => a.action_id.localeCompare(b.action_id));
  }
  for (const issueGroup of issuesByDocument.values()) {
    issueGroup.sort((a, b) => a.issue_id.localeCompare(b.issue_id));
  }
  unlinkedActions.sort((a, b) => a.action_id.localeCompare(b.action_id));
  unlinkedIssues.sort((a, b) => a.issue_id.localeCompare(b.issue_id));

  const rowsByStage = new Map<ChecklistStage, RenderRow[]>();

  for (const stage of STAGE_ORDER) {
    const stageEntries = entries
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
    for (const [, children] of childrenByParent.entries()) {
      children.sort(compareBySortKey);
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
 * Build template values for the closing-checklist DOCX template from
 * document-first v2 checklist input.
 *
 * Layout:
 *   - Stage headers as bold section rows
 *   - Entry rows: Number | Title | Status | Responsible Party
 *   - Citations as indented sub-rows under their entry
 *   - Signatories as indented sub-rows
 *   - Linked actions/issues as indented sub-rows
 */
export function buildChecklistTemplateContext(data: unknown): ChecklistTemplateContext {
  const model = buildRenderModel(data);
  const documentRows: TemplateDocumentRow[] = [];

  STAGE_ORDER.forEach((stage, index) => {
    const stageRows = model.rowsByStage.get(stage) ?? [];
    if (stageRows.length === 0) return;

    // Stage heading row
    documentRows.push({
      number: '',
      title: `${STAGE_ROMANS[index]}. ${STAGE_HEADINGS[stage]}`,
      status: '',
      responsible_party: '',
    });

    for (const row of stageRows) {
      const indent = '\u00A0\u00A0'.repeat(row.depth);
      const linkSuffix = row.document?.primary_link ? ` (${row.document.primary_link})` : '';

      // Main entry row
      documentRows.push({
        number: row.number,
        title: `${indent}${row.entry.title}${linkSuffix}`,
        status: humanStatus(row.entry.status),
        responsible_party: responsibilityLabel(row.entry.responsible_party),
      });

      // Citation sub-rows
      for (const citation of row.entry.citations) {
        documentRows.push({
          number: '',
          title: `${indent}\u00A0\u00A0Ref: ${citationLabel(citation)}`,
          status: '',
          responsible_party: '',
        });
      }

      // Signatory sub-rows
      for (const signatory of row.entry.signatories) {
        documentRows.push({
          number: '',
          title: `${indent}\u00A0\u00A0Signatory: ${signatoryLabel(signatory)}`,
          status: '',
          responsible_party: '',
        });
      }

      // Linked action sub-rows
      for (const action of row.linkedActions) {
        const latestCitation = latestCitationLabel(action.citations);
        documentRows.push({
          number: '',
          title: `${indent}\u00A0\u00A0Action ${action.action_id}: ${action.description}`,
          status: latestCitation ? `${humanStatus(action.status)} | ${latestCitation}` : humanStatus(action.status),
          responsible_party: responsibilityLabel(action.assigned_to),
        });
      }

      // Linked issue sub-rows
      for (const issue of row.linkedIssues) {
        const latestCitation = latestCitationLabel(issue.citations);
        documentRows.push({
          number: '',
          title: `${indent}\u00A0\u00A0Issue ${issue.issue_id}: ${issue.title}`,
          status: latestCitation ? `${humanStatus(issue.status)} | ${latestCitation}` : humanStatus(issue.status),
          responsible_party: '',
        });
      }
    }
  });

  const fallbackActions: TemplateActionRow[] = model.unlinkedActions.map((action) => ({
    item_id: action.action_id,
    description: action.description,
    status: humanStatus(action.status),
    assigned_to: responsibilityLabel(action.assigned_to),
    due_date: action.due_date ?? '',
  }));

  const fallbackIssues: TemplateIssueRow[] = model.unlinkedIssues.map((issue) => ({
    issue_id: issue.issue_id,
    title: issue.title,
    status: humanStatus(issue.status),
    summary: nonEmpty([issue.summary ?? '', latestCitationLabel(issue.citations)]).join(' | '),
  }));

  return {
    deal_name: model.checklist.deal_name,
    updated_at: model.checklist.updated_at,
    documents: documentRows,
    action_items: fallbackActions,
    open_issues: fallbackIssues,
  };
}
