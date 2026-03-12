/**
 * Checklist DOCX import/diff module.
 *
 * Parses a rendered closing-checklist DOCX and produces RFC 6902 patch
 * operations representing human edits to the document.
 *
 * Processes 5-column Documents, 5-column Action Items, and 5-column Issues tables.
 */

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Document as XMLDocument } from '@xmldom/xmldom';
import {
  extractTables,
  type ExtractedTable,
  type ExtractTablesResult,
} from '@usejunior/docx-core';
import type { ClosingChecklist, ChecklistEntry, ChecklistDocument, ActionItem, Issue } from './schemas.js';
import type { ChecklistPatchOperation, ChecklistPatchEnvelope } from './patch-schemas.js';
import { reverseHumanStatus } from './status-labels.js';
import {
  DOCUMENTS_HEADERS,
  ACTION_ITEMS_HEADERS,
  ISSUES_HEADERS,
  classifyRow,
  extractRenderVersion,
} from './docx-table-helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocxImportOptions {
  docxBuffer: Buffer;
  canonicalChecklist: ClosingChecklist;
  checklistId: string;
  currentRevision: number;
}

export type DocxImportWarningCode =
  | 'SUB_ROW_CHANGED'
  | 'ROW_REORDERED'
  | 'UNSUPPORTED_EDIT'
  | 'UNKNOWN_ID'
  | 'DUPLICATE_ID'
  | 'NEW_ROW_ADDED'
  | 'DISPLAY_ROW_SKIPPED';

export interface DocxImportWarning {
  code: DocxImportWarningCode;
  table: 'documents' | 'action_items' | 'issues';
  message: string;
  rowIndex?: number;
  column?: string;
}

export interface DocxImportSummary {
  documentsProcessed: number;
  actionItemsProcessed: number;
  issuesProcessed: number;
  operationsGenerated: number;
  warningsGenerated: number;
}

export interface DocxImportResult {
  ok: true;
  patch: ChecklistPatchEnvelope | null;
  warnings: DocxImportWarning[];
  summary: DocxImportSummary;
}

export type DocxImportErrorCode =
  | 'TABLE_NOT_FOUND'
  | 'MERGED_CELLS'
  | 'PARSE_FAILED'
  | 'VERSION_MISMATCH'
  | 'ID_COLUMN_MISSING';

export interface DocxImportFailure {
  ok: false;
  error_code: DocxImportErrorCode;
  message: string;
}

export type DocxImportOutcome = DocxImportResult | DocxImportFailure;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse the merged Responsible column: "Entity (Individual)" format.
 * Uses the canonical shape to disambiguate single-token text.
 *
 * Known limitation: when canonical has both org and individual, any
 * parenthesized text is split — e.g. "Acme (Delaware)" would be parsed as
 * org="Acme", individual="Delaware". This is inherent to the format; the
 * canonical shape is the best available disambiguation signal.
 */
function parseResponsibleColumn(
  text: string,
  canonical?: { organization?: string | null; individual_name?: string | null },
): { organization: string | null; individual_name: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { organization: null, individual_name: null };

  // Only attempt "Entity (Individual)" split when canonical has BOTH fields
  const hasBoth = canonical?.organization && canonical?.individual_name;
  if (hasBoth) {
    const parenIdx = trimmed.lastIndexOf('(');
    if (parenIdx > 0 && trimmed.endsWith(')')) {
      const org = trimmed.slice(0, parenIdx).trim();
      const individual = trimmed.slice(parenIdx + 1, -1).trim();
      return { organization: org || null, individual_name: individual || null };
    }
  }

  // No parens or single-field canonical — use canonical shape as tiebreaker
  if (canonical) {
    if (canonical.organization && !canonical.individual_name) {
      return { organization: trimmed, individual_name: null };
    }
    if (canonical.individual_name && !canonical.organization) {
      return { organization: null, individual_name: trimmed };
    }
  }
  // Default (no canonical or canonical has both but no parens): treat as org
  return { organization: trimmed, individual_name: null };
}

function toArray<T>(collection: T[] | Record<string, T>): T[] {
  return Array.isArray(collection) ? collection : Object.values(collection);
}

// ---------------------------------------------------------------------------
// Table extraction from DOCX buffer
// ---------------------------------------------------------------------------

function parseDocxXml(buffer: Buffer): XMLDocument {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml not found in DOCX');
  const xmlStr = entry.getData().toString('utf-8');
  return new DOMParser().parseFromString(xmlStr, 'text/xml');
}

function findExtractedTable(
  result: ExtractTablesResult,
  targetHeaders: string[],
): ExtractedTable | null {
  return result.tables.find((t) => {
    if (t.headers.length !== targetHeaders.length) return false;
    return t.headers.every((h, i) => h === targetHeaders[i]);
  }) ?? null;
}

// ---------------------------------------------------------------------------
// Documents table import
// ---------------------------------------------------------------------------

function importDocumentsTable(
  table: ExtractedTable,
  checklist: ClosingChecklist,
  ops: ChecklistPatchOperation[],
  warnings: DocxImportWarning[],
): number {
  const entries = toArray(checklist.checklist_entries);
  const documents = toArray(checklist.documents);
  const entriesById = new Map(entries.map((e) => [e.entry_id, e]));
  const documentsById = new Map(documents.map((d) => [d.document_id, d]));

  const seenIds = new Set<string>();
  let processed = 0;

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!;
    const entryId = row['ID']?.trim() ?? '';
    const titleText = row['Title']?.trim() ?? '';

    // Skip stage headings and sub-rows
    const rowType = classifyRow(entryId, titleText);
    if (rowType === 'stage_heading') continue;

    // Sub-rows: detect changes and emit warnings
    if (rowType !== 'main_entry' && rowType !== 'unknown') {
      // Sub-rows are read-only
      if (titleText || row['Status']?.trim()) {
        warnings.push({
          code: 'SUB_ROW_CHANGED',
          table: 'documents',
          message: `Sub-row at index ${i} (${rowType}) is read-only`,
          rowIndex: i,
        });
      }
      continue;
    }

    // Empty-ID unknown rows: display-only, skip with info warning
    if (!entryId && rowType === 'unknown') {
      warnings.push({
        code: 'DISPLAY_ROW_SKIPPED',
        table: 'documents',
        message: `Row ${i} has empty ID — display-only row skipped`,
        rowIndex: i,
      });
      continue;
    }

    // ID integrity policy
    if (!entryId) {
      warnings.push({
        code: 'NEW_ROW_ADDED',
        table: 'documents',
        message: `Row ${i} has empty ID — new row addition not supported for documents table`,
        rowIndex: i,
      });
      continue;
    }

    if (seenIds.has(entryId)) {
      warnings.push({
        code: 'DUPLICATE_ID',
        table: 'documents',
        message: `Duplicate ID "${entryId}" at row ${i} — skipping`,
        rowIndex: i,
      });
      continue;
    }
    seenIds.add(entryId);

    const entry = entriesById.get(entryId);
    if (!entry) {
      warnings.push({
        code: 'UNKNOWN_ID',
        table: 'documents',
        message: `Unknown entry ID "${entryId}" at row ${i} — skipping`,
        rowIndex: i,
      });
      continue;
    }

    processed++;

    // Compare and generate replace ops
    // Title (strip NBSP indent for comparison)
    const cleanTitle = titleText.replace(/^\u00A0+/, '').trim();
    if (cleanTitle && cleanTitle !== entry.title) {
      ops.push({
        op: 'replace',
        path: `/checklist_entries/${entryId}/title`,
        value: cleanTitle,
        rationale: 'DOCX import: title changed',
      });
    }

    // Status
    const statusText = row['Status']?.trim() ?? '';
    if (statusText) {
      const enumStatus = reverseHumanStatus(statusText);
      if (enumStatus && enumStatus !== entry.status) {
        ops.push({
          op: 'replace',
          path: `/checklist_entries/${entryId}/status`,
          value: enumStatus,
          rationale: 'DOCX import: status changed',
        });
      }
    }

    // Link → ChecklistDocument.primary_link
    const linkText = row['Link']?.trim() ?? '';
    const doc = entry.document_id ? documentsById.get(entry.document_id) : null;
    if (doc) {
      const currentLink = doc.primary_link ?? '';
      if (linkText !== currentLink) {
        ops.push({
          op: linkText ? 'replace' : 'remove',
          path: `/documents/${doc.document_id}/primary_link`,
          ...(linkText ? { value: linkText } : {}),
          rationale: 'DOCX import: link changed',
        });
      }
    }

    // Responsible → merged "Entity (Individual)" column
    const responsibleText = row['Responsible']?.trim() ?? '';
    const parsed = parseResponsibleColumn(responsibleText, entry.responsible_party);
    const currentOrg = entry.responsible_party?.organization ?? '';
    const currentIndividual = entry.responsible_party?.individual_name ?? '';

    if ((parsed.organization ?? '') !== currentOrg || (parsed.individual_name ?? '') !== currentIndividual) {
      if (!entry.responsible_party && (parsed.organization || parsed.individual_name)) {
        // Create new responsible_party (never touch role)
        ops.push({
          op: 'replace',
          path: `/checklist_entries/${entryId}/responsible_party`,
          value: {
            ...(parsed.organization ? { organization: parsed.organization } : {}),
            ...(parsed.individual_name ? { individual_name: parsed.individual_name } : {}),
          },
          rationale: 'DOCX import: responsible party added',
        });
      } else if (entry.responsible_party) {
        // Clearing entire responsible_party
        if (!parsed.organization && !parsed.individual_name && !responsibleText) {
          ops.push({
            op: 'remove',
            path: `/checklist_entries/${entryId}/responsible_party`,
            rationale: 'DOCX import: responsible party cleared',
          });
        } else {
          // Update individual fields (never touch role)
          if ((parsed.organization ?? '') !== currentOrg) {
            if (parsed.organization) {
              ops.push({
                op: 'replace',
                path: `/checklist_entries/${entryId}/responsible_party/organization`,
                value: parsed.organization,
                rationale: 'DOCX import: organization changed',
              });
            } else {
              ops.push({
                op: 'remove',
                path: `/checklist_entries/${entryId}/responsible_party/organization`,
                rationale: 'DOCX import: organization cleared',
              });
            }
          }
          if ((parsed.individual_name ?? '') !== currentIndividual) {
            if (parsed.individual_name) {
              ops.push({
                op: 'replace',
                path: `/checklist_entries/${entryId}/responsible_party/individual_name`,
                value: parsed.individual_name,
                rationale: 'DOCX import: individual_name changed',
              });
            } else {
              ops.push({
                op: 'remove',
                path: `/checklist_entries/${entryId}/responsible_party/individual_name`,
                rationale: 'DOCX import: individual_name cleared',
              });
            }
          }
        }
      }
    }
  }

  return processed;
}

// ---------------------------------------------------------------------------
// Action Items table import
// ---------------------------------------------------------------------------

function importActionItemsTable(
  table: ExtractedTable,
  checklist: ClosingChecklist,
  ops: ChecklistPatchOperation[],
  warnings: DocxImportWarning[],
): number {
  const actions = toArray(checklist.action_items);
  const actionsById = new Map(actions.map((a) => [a.action_id, a]));
  const seenIds = new Set<string>();
  let processed = 0;

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!;
    const actionId = row['ID']?.trim() ?? '';

    // Empty ID = new row
    if (!actionId) {
      const description = row['Description']?.trim() ?? '';
      if (description) {
        const newId = `A-${Date.now()}-${i}`;
        const statusText = row['Status']?.trim() ?? '';
        const enumStatus = reverseHumanStatus(statusText) ?? 'NOT_STARTED';
        ops.push({
          op: 'add',
          path: `/action_items/${newId}`,
          value: {
            action_id: newId,
            description,
            status: enumStatus,
            assigned_to: row['Assigned To']?.trim() ? { individual_name: row['Assigned To']?.trim() } : undefined,
            due_date: row['Due Date']?.trim() || undefined,
            related_document_ids: [],
            citations: [],
          },
          rationale: 'DOCX import: new action item added',
        });
        warnings.push({
          code: 'NEW_ROW_ADDED',
          table: 'action_items',
          message: `New action item "${description}" added with generated ID "${newId}"`,
          rowIndex: i,
        });
      }
      continue;
    }

    if (seenIds.has(actionId)) {
      warnings.push({
        code: 'DUPLICATE_ID',
        table: 'action_items',
        message: `Duplicate ID "${actionId}" at row ${i} — skipping`,
        rowIndex: i,
      });
      continue;
    }
    seenIds.add(actionId);

    const action = actionsById.get(actionId);
    if (!action) {
      warnings.push({
        code: 'UNKNOWN_ID',
        table: 'action_items',
        message: `Unknown action ID "${actionId}" at row ${i} — skipping`,
        rowIndex: i,
      });
      continue;
    }

    processed++;

    // Description
    const desc = row['Description']?.trim() ?? '';
    if (desc && desc !== action.description) {
      ops.push({
        op: 'replace',
        path: `/action_items/${actionId}/description`,
        value: desc,
        rationale: 'DOCX import: action description changed',
      });
    }

    // Status
    const statusText = row['Status']?.trim() ?? '';
    if (statusText) {
      const enumStatus = reverseHumanStatus(statusText);
      if (enumStatus && enumStatus !== action.status) {
        ops.push({
          op: 'replace',
          path: `/action_items/${actionId}/status`,
          value: enumStatus,
          rationale: 'DOCX import: action status changed',
        });
      }
    }

    // Assigned To
    const assignedTo = row['Assigned To']?.trim() ?? '';
    const currentAssigned = action.assigned_to?.individual_name ?? '';
    if (assignedTo !== currentAssigned) {
      if (!action.assigned_to && assignedTo) {
        ops.push({
          op: 'replace',
          path: `/action_items/${actionId}/assigned_to`,
          value: { individual_name: assignedTo },
          rationale: 'DOCX import: action assigned_to changed',
        });
      } else if (action.assigned_to) {
        ops.push({
          op: 'replace',
          path: `/action_items/${actionId}/assigned_to/individual_name`,
          value: assignedTo || undefined,
          rationale: 'DOCX import: action assigned_to changed',
        });
      }
    }

    // Due Date
    const dueDate = row['Due Date']?.trim() ?? '';
    const currentDue = action.due_date ?? '';
    if (dueDate !== currentDue) {
      ops.push({
        op: dueDate ? 'replace' : 'remove',
        path: `/action_items/${actionId}/due_date`,
        ...(dueDate ? { value: dueDate } : {}),
        rationale: 'DOCX import: action due_date changed',
      });
    }
  }

  // Check for removed rows
  for (const action of actions) {
    if (!seenIds.has(action.action_id)) {
      ops.push({
        op: 'remove',
        path: `/action_items/${action.action_id}`,
        rationale: 'DOCX import: action item removed from table',
      });
    }
  }

  return processed;
}

// ---------------------------------------------------------------------------
// Issues table import
// ---------------------------------------------------------------------------

function importIssuesTable(
  table: ExtractedTable,
  checklist: ClosingChecklist,
  ops: ChecklistPatchOperation[],
  warnings: DocxImportWarning[],
): number {
  const issues = toArray(checklist.issues);
  const issuesById = new Map(issues.map((iss) => [iss.issue_id, iss]));
  const seenIds = new Set<string>();
  let processed = 0;

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!;
    const issueId = row['ID']?.trim() ?? '';

    // Empty ID = new row
    if (!issueId) {
      const title = row['Title']?.trim() ?? '';
      if (title) {
        const newId = `I-${Date.now()}-${i}`;
        const statusText = row['Status']?.trim() ?? '';
        const enumStatus = reverseHumanStatus(statusText) ?? 'OPEN';
        ops.push({
          op: 'add',
          path: `/issues/${newId}`,
          value: {
            issue_id: newId,
            title,
            status: enumStatus,
            summary: row['Summary']?.trim() || undefined,
            related_document_ids: [],
            citations: [],
          },
          rationale: 'DOCX import: new issue added',
        });
        warnings.push({
          code: 'NEW_ROW_ADDED',
          table: 'issues',
          message: `New issue "${title}" added with generated ID "${newId}"`,
          rowIndex: i,
        });
      }
      continue;
    }

    if (seenIds.has(issueId)) {
      warnings.push({
        code: 'DUPLICATE_ID',
        table: 'issues',
        message: `Duplicate ID "${issueId}" at row ${i} — skipping`,
        rowIndex: i,
      });
      continue;
    }
    seenIds.add(issueId);

    const issue = issuesById.get(issueId);
    if (!issue) {
      warnings.push({
        code: 'UNKNOWN_ID',
        table: 'issues',
        message: `Unknown issue ID "${issueId}" at row ${i} — skipping`,
        rowIndex: i,
      });
      continue;
    }

    processed++;

    // Title
    const title = row['Title']?.trim() ?? '';
    if (title && title !== issue.title) {
      ops.push({
        op: 'replace',
        path: `/issues/${issueId}/title`,
        value: title,
        rationale: 'DOCX import: issue title changed',
      });
    }

    // Status
    const statusText = row['Status']?.trim() ?? '';
    if (statusText) {
      const enumStatus = reverseHumanStatus(statusText);
      if (enumStatus && enumStatus !== issue.status) {
        ops.push({
          op: 'replace',
          path: `/issues/${issueId}/status`,
          value: enumStatus,
          rationale: 'DOCX import: issue status changed',
        });
      }
    }

    // Summary
    const summary = row['Summary']?.trim() ?? '';
    const currentSummary = issue.summary ?? '';
    if (summary !== currentSummary) {
      ops.push({
        op: summary ? 'replace' : 'remove',
        path: `/issues/${issueId}/summary`,
        ...(summary ? { value: summary } : {}),
        rationale: 'DOCX import: issue summary changed',
      });
    }

    // Citation (latest citation text)
    const citationText = row['Citation']?.trim() ?? '';
    const currentCitations = issue.citations ?? [];
    const currentLatestCitation = currentCitations.length > 0
      ? (currentCitations[currentCitations.length - 1]!.text ?? currentCitations[currentCitations.length - 1]!.ref ?? '')
      : '';
    if (citationText && citationText !== currentLatestCitation) {
      // Add a new citation
      ops.push({
        op: 'add',
        path: `/issues/${issueId}/citations/-`,
        value: { text: citationText },
        rationale: 'DOCX import: issue citation updated',
      });
    }
  }

  // Check for removed rows
  for (const issue of issues) {
    if (!seenIds.has(issue.issue_id)) {
      ops.push({
        op: 'remove',
        path: `/issues/${issue.issue_id}`,
        rationale: 'DOCX import: issue removed from table',
      });
    }
  }

  return processed;
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Import a rendered closing-checklist DOCX and produce a patch envelope
 * representing the differences from the canonical checklist state.
 */
export function importChecklistFromDocx(options: DocxImportOptions): DocxImportOutcome {
  const { docxBuffer, canonicalChecklist, checklistId, currentRevision } = options;

  // Parse DOCX XML
  let xmlDoc: XMLDocument;
  try {
    xmlDoc = parseDocxXml(docxBuffer);
  } catch (err) {
    return {
      ok: false,
      error_code: 'PARSE_FAILED',
      message: `Failed to parse DOCX: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Check render version marker
  const renderVersion = extractRenderVersion(xmlDoc);
  if (renderVersion !== 'closing-checklist') {
    return {
      ok: false,
      error_code: 'VERSION_MISMATCH',
      message: 'DOCX is missing render version marker (closing-checklist). Was this rendered with the current template?',
    };
  }

  // Use docx-core extractTables on the raw DOM
  // We need to use the xmldom Document as a DOM Document
  const extractResult = extractTables(xmlDoc as unknown as Document, {
    rejectMergedCells: true,
    headerFilter: [DOCUMENTS_HEADERS, ACTION_ITEMS_HEADERS, ISSUES_HEADERS],
  });

  // Check for merged cell errors
  if (extractResult.mergedCellDiagnostics.length > 0) {
    return {
      ok: false,
      error_code: 'MERGED_CELLS',
      message: `DOCX contains merged cells which cannot be safely parsed (${extractResult.mergedCellDiagnostics.length} merged cells detected)`,
    };
  }

  const docsTable = findExtractedTable(extractResult, DOCUMENTS_HEADERS);
  const actionsTable = findExtractedTable(extractResult, ACTION_ITEMS_HEADERS);
  const issuesTable = findExtractedTable(extractResult, ISSUES_HEADERS);

  if (!docsTable && !actionsTable && !issuesTable) {
    return {
      ok: false,
      error_code: 'TABLE_NOT_FOUND',
      message: 'No recognized checklist tables found in DOCX. Expected 5-column headers (ID | Title | Link | Status | Responsible).',
    };
  }

  const ops: ChecklistPatchOperation[] = [];
  const warnings: DocxImportWarning[] = [];

  // Filter out control rows from extracted tables
  // (docx-core extractTables gives us raw data; control rows have {FOR / {END-FOR text)
  function filterControlRows(table: ExtractedTable): ExtractedTable {
    const filteredRows = table.rows.filter((row) => {
      const firstCell = Object.values(row)[0] ?? '';
      if (firstCell.trim().startsWith('{FOR') || firstCell.trim().startsWith('{END-FOR')) {
        return false;
      }
      return true;
    });
    return { ...table, rows: filteredRows };
  }

  let documentsProcessed = 0;
  let actionItemsProcessed = 0;
  let issuesProcessed = 0;

  if (docsTable) {
    const filtered = filterControlRows(docsTable);
    documentsProcessed = importDocumentsTable(filtered, canonicalChecklist, ops, warnings);
  }

  if (actionsTable) {
    const filtered = filterControlRows(actionsTable);
    actionItemsProcessed = importActionItemsTable(filtered, canonicalChecklist, ops, warnings);
  }

  if (issuesTable) {
    const filtered = filterControlRows(issuesTable);
    issuesProcessed = importIssuesTable(filtered, canonicalChecklist, ops, warnings);
  }

  // Build patch envelope
  const patch: ChecklistPatchEnvelope | null = ops.length > 0
    ? {
        patch_id: `docx-import-${checklistId}-${Date.now()}`,
        mode: 'APPLY',
        expected_revision: currentRevision,
        operations: ops,
        source_event: {
          provider: 'docx-import',
        },
      }
    : null;

  return {
    ok: true,
    patch,
    warnings,
    summary: {
      documentsProcessed,
      actionItemsProcessed,
      issuesProcessed,
      operationsGenerated: ops.length,
      warningsGenerated: warnings.length,
    },
  };
}
