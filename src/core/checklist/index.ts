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
export { humanStatus, STATUS_LABELS, reverseHumanStatus, REVERSE_STATUS_LABELS } from './status-labels.js';
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
export { formatChecklistDocx } from './format-checklist-docx.js';
export {
  importChecklistFromDocx,
  type DocxImportOptions,
  type DocxImportWarning,
  type DocxImportWarningCode,
  type DocxImportSummary,
  type DocxImportResult,
  type DocxImportFailure,
  type DocxImportErrorCode,
  type DocxImportOutcome,
} from './docx-import.js';
export {
  classifyRow,
  getDirectChildRows,
  getDirectChildCells,
  getCellText,
  findTableByHeaders,
  isControlRow,
  extractRenderVersion,
  DOCUMENTS_HEADERS,
  ACTION_ITEMS_HEADERS,
  ISSUES_HEADERS,
  RENDER_VERSION_MARKER,
  type RowType,
} from './docx-table-helpers.js';

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
// 5-column document row: ID | Title | Link | Status | Responsible
// ---------------------------------------------------------------------------

export interface TemplateDocumentRow {
  entry_id: string;
  title: string;
  link: string;
  status: string;
  responsible: string;
}

export interface TemplateActionRow {
  item_id: string;
  description: string;
  status: string;
  assigned_to: string;
  due_date: string;
}

// ---------------------------------------------------------------------------
// 5-column issue row: ID | Title | Status | Summary | Citation
// ---------------------------------------------------------------------------

export interface TemplateIssueRow {
  issue_id: string;
  title: string;
  status: string;
  summary: string;
  citation: string;
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

/**
 * Merged responsible column: "Entity (Individual)" format.
 * Role is preserved in canonical data but NOT rendered in DOCX.
 */
function responsibleMergedColumn(r?: Responsibility): string {
  if (!r) return '';
  const org = r.organization ?? '';
  const individual = r.individual_name ?? '';
  if (org && individual) return `${org} (${individual})`;
  return org || individual;
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
 * Build template values for the closing-checklist DOCX template.
 *
 * Layout (5-column):
 *   - Stage headers as bold section rows
 *   - Entry rows: ID | Title | Link | Status | Responsible
 *   - Citations as indented sub-rows under their entry
 *   - Signatories as bracket-checkbox sub-rows
 *   - Linked actions/issues as bracket-checkbox sub-rows
 */
export function buildChecklistTemplateContext(data: unknown): ChecklistTemplateContext {
  const model = buildRenderModel(data);
  const documentRows: TemplateDocumentRow[] = [];

  STAGE_ORDER.forEach((stage, index) => {
    const stageRows = model.rowsByStage.get(stage) ?? [];
    if (stageRows.length === 0) return;

    // Stage heading row
    documentRows.push({
      entry_id: '',
      title: `${STAGE_ROMANS[index]}. ${STAGE_HEADINGS[stage]}`,
      link: '',
      status: '',
      responsible: '',
    });

    for (const row of stageRows) {
      const indent = '\u00A0\u00A0'.repeat(row.depth);

      // Main entry row (lossless: title is clean, link is separate column)
      documentRows.push({
        entry_id: row.entry.entry_id,
        title: `${indent}${row.entry.title}`,
        link: row.document?.primary_link ?? '',
        status: humanStatus(row.entry.status),
        responsible: responsibleMergedColumn(row.entry.responsible_party),
      });

      // Citation sub-rows
      for (const citation of row.entry.citations) {
        documentRows.push({
          entry_id: '',
          title: `${indent}\u00A0\u00A0Ref: ${citationLabel(citation)}`,
          link: '',
          status: '',
          responsible: '',
        });
      }

      // Signatory sub-rows
      for (const signatory of row.entry.signatories) {
        const sigCheckbox = signatory.status === 'RECEIVED' ? '[x]' : '[ ]';
        documentRows.push({
          entry_id: '',
          title: `${indent}\u00A0\u00A0${sigCheckbox} Signatory: ${signatoryLabel(signatory)}`,
          link: '',
          status: '',
          responsible: '',
        });
      }

      // Linked action sub-rows
      for (const action of row.linkedActions) {
        const actCheckbox = action.status === 'COMPLETED' ? '[x]' : '[ ]';
        documentRows.push({
          entry_id: '',
          title: `${indent}\u00A0\u00A0${actCheckbox} Action ${action.action_id}: ${action.description}`,
          link: '',
          status: humanStatus(action.status),
          responsible: responsibilityLabel(action.assigned_to),
        });
      }

      // Linked issue sub-rows
      for (const issue of row.linkedIssues) {
        const issCheckbox = issue.status === 'CLOSED' ? '[x]' : '[ ]';
        documentRows.push({
          entry_id: '',
          title: `${indent}\u00A0\u00A0${issCheckbox} Issue ${issue.issue_id}: ${issue.title}`,
          link: '',
          status: humanStatus(issue.status),
          responsible: '',
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
    summary: issue.summary ?? '',
    citation: latestCitationLabel(issue.citations),
  }));

  return {
    deal_name: model.checklist.deal_name,
    updated_at: model.checklist.updated_at,
    documents: documentRows,
    action_items: fallbackActions,
    open_issues: fallbackIssues,
  };
}
