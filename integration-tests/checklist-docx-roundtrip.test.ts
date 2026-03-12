/**
 * Round-trip integration tests for checklist DOCX import/export.
 *
 * Tests the full cycle: JSON → render DOCX → parse DOCX → produce patch.
 */

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { fillTemplate } from '../src/core/engine.js';
import {
  buildChecklistTemplateContext,
  formatChecklistDocx,
  importChecklistFromDocx,
  humanStatus,
  STATUS_LABELS,
  reverseHumanStatus,
  RENDER_VERSION_MARKER,
} from '../src/core/checklist/index.js';
import { findTemplateDir } from '../src/utils/paths.js';
import type { ClosingChecklist } from '../src/core/checklist/schemas.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Checklist DOCX Round-Trip');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const baseChecklist: ClosingChecklist = {
  deal_name: 'Test Deal',
  updated_at: '2026-03-01',
  documents: {
    'doc-1': {
      document_id: 'doc-1',
      title: 'Agreement',
      primary_link: 'https://example.com/agreement',
      labels: [],
    },
  },
  checklist_entries: {
    'entry-1': {
      entry_id: 'entry-1',
      document_id: 'doc-1',
      stage: 'SIGNING',
      sort_key: '100',
      title: 'Purchase Agreement',
      status: 'FORM_FINAL',
      responsible_party: {
        individual_name: 'Jane Doe',
        organization: 'Acme Corp',
        role: 'Lead Counsel',
      },
      citations: [{ ref: 'Section 2.1' }],
      signatories: [],
    },
  },
  action_items: {
    'A-1': {
      action_id: 'A-1',
      description: 'Review final draft',
      status: 'IN_PROGRESS',
      assigned_to: { individual_name: 'Bob' },
      due_date: '2026-03-15',
      related_document_ids: [],
      citations: [],
    },
  },
  issues: {
    'I-1': {
      issue_id: 'I-1',
      title: 'Indemnity cap',
      status: 'OPEN',
      summary: 'Pending review',
      related_document_ids: [],
      citations: [],
    },
  },
};

// ---------------------------------------------------------------------------
// Helper: render checklist to DOCX buffer
// ---------------------------------------------------------------------------

async function renderChecklistDocx(checklist: ClosingChecklist): Promise<Buffer> {
  const templateDir = findTemplateDir('closing-checklist');
  if (!templateDir) throw new Error('closing-checklist template not found');

  const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-'));
  tempDirs.push(tempDir);
  const outputPath = join(tempDir, 'checklist.docx');

  const context = buildChecklistTemplateContext(checklist);
  await fillTemplate({ templateDir, outputPath, values: context });
  await formatChecklistDocx(outputPath);

  return readFileSync(outputPath);
}

/**
 * Modify a cell's text in the DOCX XML.
 */
function modifyCellInDocx(buffer: Buffer, tableHeaders: string[], targetColumn: string, rowPredicate: (row: Record<string, string>) => boolean, newValue: string): Buffer {
  const zip = new AdmZip(buffer);
  const xmlEntry = zip.getEntry('word/document.xml')!;
  const xmlStr = xmlEntry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t] as Element;
    const rows = Array.from(table.childNodes).filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tr' && (n as Element).namespaceURI === W_NS,
    );
    if (rows.length === 0) continue;

    // Check headers
    const headerCells = Array.from(rows[0].childNodes).filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc' && (n as Element).namespaceURI === W_NS,
    );
    const headers = headerCells.map((c) => {
      const tNodes = c.getElementsByTagNameNS(W_NS, 't');
      const parts: string[] = [];
      for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
      return parts.join('').trim();
    });

    if (headers.length !== tableHeaders.length || !headers.every((h, i) => h === tableHeaders[i])) continue;

    const colIdx = headers.indexOf(targetColumn);
    if (colIdx === -1) continue;

    // Find matching data row
    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].childNodes).filter(
        (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc' && (n as Element).namespaceURI === W_NS,
      );

      const rowData: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        if (!cells[c]) continue;
        const tNodes = cells[c].getElementsByTagNameNS(W_NS, 't');
        const parts: string[] = [];
        for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
        rowData[headers[c]] = parts.join('').trim();
      }

      if (!rowPredicate(rowData)) continue;

      // Modify the target cell
      const targetCell = cells[colIdx];
      if (!targetCell) continue;

      // Clear existing text and set new value
      const tNodes = targetCell.getElementsByTagNameNS(W_NS, 't');
      if (tNodes.length > 0) {
        tNodes[0].textContent = newValue;
        // Clear remaining t nodes
        for (let i = 1; i < tNodes.length; i++) {
          tNodes[i].textContent = '';
        }
      }
      break;
    }
    break;
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(doc);
  const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-mod-'));
  tempDirs.push(tempDir);
  const tempPath = join(tempDir, 'modified.docx');
  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
  zip.writeZip(tempPath);
  return readFileSync(tempPath);
}

/**
 * Add a new data row to a table identified by its headers.
 */
function addRowToTable(buffer: Buffer, tableHeaders: string[], rowData: Record<string, string>): Buffer {
  const zip = new AdmZip(buffer);
  const xmlEntry = zip.getEntry('word/document.xml')!;
  const xmlStr = xmlEntry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t] as Element;
    const rows = Array.from(table.childNodes).filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tr' && (n as Element).namespaceURI === W_NS,
    );
    if (rows.length === 0) continue;

    const headerCells = Array.from(rows[0].childNodes).filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc' && (n as Element).namespaceURI === W_NS,
    );
    const headers = headerCells.map((c) => {
      const tNodes = c.getElementsByTagNameNS(W_NS, 't');
      const parts: string[] = [];
      for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
      return parts.join('').trim();
    });

    if (headers.length !== tableHeaders.length || !headers.every((h, i) => h === tableHeaders[i])) continue;

    // Create a new row by cloning the last data row structure
    const newRow = doc.createElementNS(W_NS, 'w:tr');
    for (const header of headers) {
      const tc = doc.createElementNS(W_NS, 'w:tc');
      const p = doc.createElementNS(W_NS, 'w:p');
      const r = doc.createElementNS(W_NS, 'w:r');
      const tEl = doc.createElementNS(W_NS, 'w:t');
      tEl.appendChild(doc.createTextNode(rowData[header] ?? ''));
      r.appendChild(tEl);
      p.appendChild(r);
      tc.appendChild(p);
      newRow.appendChild(tc);
    }
    table.appendChild(newRow);
    break;
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(doc);
  const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-add-'));
  tempDirs.push(tempDir);
  const tempPath = join(tempDir, 'added.docx');
  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
  zip.writeZip(tempPath);
  return readFileSync(tempPath);
}

/**
 * Remove a data row from a table identified by its headers.
 */
function removeRowFromTable(buffer: Buffer, tableHeaders: string[], rowPredicate: (row: Record<string, string>) => boolean): Buffer {
  const zip = new AdmZip(buffer);
  const xmlEntry = zip.getEntry('word/document.xml')!;
  const xmlStr = xmlEntry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t] as Element;
    const rows = Array.from(table.childNodes).filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tr' && (n as Element).namespaceURI === W_NS,
    );
    if (rows.length === 0) continue;

    const headerCells = Array.from(rows[0].childNodes).filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc' && (n as Element).namespaceURI === W_NS,
    );
    const headers = headerCells.map((c) => {
      const tNodes = c.getElementsByTagNameNS(W_NS, 't');
      const parts: string[] = [];
      for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
      return parts.join('').trim();
    });

    if (headers.length !== tableHeaders.length || !headers.every((h, i) => h === tableHeaders[i])) continue;

    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].childNodes).filter(
        (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc' && (n as Element).namespaceURI === W_NS,
      );
      const rowDataObj: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        if (!cells[c]) continue;
        const tNodes = cells[c].getElementsByTagNameNS(W_NS, 't');
        const parts: string[] = [];
        for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
        rowDataObj[headers[c]] = parts.join('').trim();
      }

      if (rowPredicate(rowDataObj)) {
        table.removeChild(rows[r]);
        break;
      }
    }
    break;
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(doc);
  const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-rm-'));
  tempDirs.push(tempDir);
  const tempPath = join(tempDir, 'removed.docx');
  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
  zip.writeZip(tempPath);
  return readFileSync(tempPath);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const DOC_HEADERS = ['ID', 'Title', 'Link', 'Status', 'Responsible'];
const ACTION_HEADERS = ['ID', 'Description', 'Status', 'Assigned To', 'Due Date'];
const ISSUE_HEADERS = ['ID', 'Title', 'Status', 'Summary', 'Citation'];

describe('checklist DOCX round-trip', () => {
  it('round-trip no-op: import of rendered checklist produces null patch', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);

    const result = importChecklistFromDocx({
      docxBuffer: buffer,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).toBeNull();
    expect(result.warnings.filter((w) => w.code !== 'SUB_ROW_CHANGED')).toHaveLength(0);
  });

  it('documents table: detects status change', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Status',
      (row) => row['ID'] === 'entry-1',
      'Fully Executed',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const statusOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/status',
    );
    expect(statusOp).toBeTruthy();
    expect(statusOp!.op).toBe('replace');
    expect(statusOp!.value).toBe('FULLY_EXECUTED');
  });

  it('documents table: detects title change', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Title',
      (row) => row['ID'] === 'entry-1',
      'Amended Purchase Agreement',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const titleOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/title',
    );
    expect(titleOp).toBeTruthy();
    expect(titleOp!.value).toBe('Amended Purchase Agreement');
  });

  it('documents table: detects link change', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Link',
      (row) => row['ID'] === 'entry-1',
      'https://example.com/new-link',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const linkOp = result.patch!.operations.find(
      (op) => op.path === '/documents/doc-1/primary_link',
    );
    expect(linkOp).toBeTruthy();
    expect(linkOp!.value).toBe('https://example.com/new-link');
  });

  it('documents table: detects responsible change (merged column)', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Responsible',
      (row) => row['ID'] === 'entry-1',
      'Beta Inc (John Smith)',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();

    const nameOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/responsible_party/individual_name',
    );
    expect(nameOp).toBeTruthy();
    expect(nameOp!.value).toBe('John Smith');

    const orgOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/responsible_party/organization',
    );
    expect(orgOp).toBeTruthy();
    expect(orgOp!.value).toBe('Beta Inc');

    // Role should NOT be touched by import
    const roleOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/responsible_party/role',
    );
    expect(roleOp).toBeUndefined();
  });

  it('action items: detects status change', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ACTION_HEADERS, 'Status',
      (row) => row['ID'] === 'A-1',
      'Completed',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const op = result.patch!.operations.find(
      (op) => op.path === '/action_items/A-1/status',
    );
    expect(op).toBeTruthy();
    expect(op!.value).toBe('COMPLETED');
  });

  it('issues: detects status change', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ISSUE_HEADERS, 'Status',
      (row) => row['ID'] === 'I-1',
      'Closed',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const op = result.patch!.operations.find(
      (op) => op.path === '/issues/I-1/status',
    );
    expect(op).toBeTruthy();
    expect(op!.value).toBe('CLOSED');
  });

  it('issues: summary and citation round-trip independently', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    let modified = modifyCellInDocx(
      buffer, ISSUE_HEADERS, 'Summary',
      (row) => row['ID'] === 'I-1',
      'Updated summary text',
    );
    modified = modifyCellInDocx(
      modified, ISSUE_HEADERS, 'Citation',
      (row) => row['ID'] === 'I-1',
      'New citation reference',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();

    const summaryOp = result.patch!.operations.find(
      (op) => op.path === '/issues/I-1/summary',
    );
    expect(summaryOp).toBeTruthy();
    expect(summaryOp!.value).toBe('Updated summary text');

    const citationOp = result.patch!.operations.find(
      (op) => op.path === '/issues/I-1/citations/-',
    );
    expect(citationOp).toBeTruthy();
    expect((citationOp!.value as Record<string, string>).text).toBe('New citation reference');
  });

  it('unknown ID in documents table produces warning', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'ID',
      (row) => row['ID'] === 'entry-1',
      'unknown-entry-99',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unknownWarning = result.warnings.find((w) => w.code === 'UNKNOWN_ID');
    expect(unknownWarning).toBeTruthy();
    expect(unknownWarning!.message).toContain('unknown-entry-99');
  });

  it('missing version marker produces VERSION_MISMATCH error', async () => {
    // Render normally (which injects marker), then remove the marker paragraph from DOM
    const buffer = await renderChecklistDocx(baseChecklist);
    const zip = new AdmZip(buffer);
    const xmlEntry = zip.getEntry('word/document.xml')!;
    const xmlStr = xmlEntry.getData().toString('utf-8');
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

    // Find and remove the paragraph containing the version marker
    const body = doc.getElementsByTagNameNS(W_NS, 'body').item(0)!;
    const paragraphs = body.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paragraphs.length; i++) {
      const tNodes = paragraphs[i].getElementsByTagNameNS(W_NS, 't');
      for (let t = 0; t < tNodes.length; t++) {
        if ((tNodes[t].textContent ?? '').includes('oa:render_version=')) {
          body.removeChild(paragraphs[i]);
          break;
        }
      }
    }

    const serializer = new XMLSerializer();
    const strippedXml = serializer.serializeToString(doc);
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-strip-'));
    tempDirs.push(tempDir);
    const strippedPath = join(tempDir, 'no-marker.docx');
    zip.updateFile('word/document.xml', Buffer.from(strippedXml, 'utf-8'));
    zip.writeZip(strippedPath);

    const strippedBuffer = readFileSync(strippedPath);
    const result = importChecklistFromDocx({
      docxBuffer: strippedBuffer,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('VERSION_MISMATCH');
  });

  it('reverse status mapping: all STATUS_LABELS survive round-trip', () => {
    for (const [key, label] of Object.entries(STATUS_LABELS)) {
      const reversed = reverseHumanStatus(label);
      expect(reversed).toBe(key);
    }
  });

  it('responsible column round-trip: "Acme (Jane)" → no patch', async () => {
    const checklist: ClosingChecklist = {
      ...baseChecklist,
      checklist_entries: {
        'entry-1': {
          ...baseChecklist.checklist_entries['entry-1']!,
          responsible_party: {
            individual_name: 'Jane',
            organization: 'Acme',
            role: 'GC',
          },
        },
      },
    };

    const buffer = await renderChecklistDocx(checklist);
    const result = importChecklistFromDocx({
      docxBuffer: buffer,
      canonicalChecklist: checklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No-op: rendered and parsed should match
    expect(result.patch).toBeNull();
  });

  it('action items: add row with empty ID', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    // Add a new row to the action items table with empty ID
    const modified = addRowToTable(
      buffer, ACTION_HEADERS,
      { 'ID': '', 'Description': 'New task from human edit', 'Status': 'Not Started', 'Assigned To': 'Alice', 'Due Date': '2026-04-01' },
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();

    const addOps = result.patch!.operations.filter(
      (op) => op.op === 'add' && op.path.startsWith('/action_items/'),
    );
    expect(addOps.length).toBeGreaterThanOrEqual(1);
    const addOp = addOps[0]!;
    const value = addOp.value as Record<string, unknown>;
    expect(value.description).toBe('New task from human edit');
    expect(value.status).toBe('NOT_STARTED');

    const newRowWarning = result.warnings.find((w) => w.code === 'NEW_ROW_ADDED' && w.table === 'action_items');
    expect(newRowWarning).toBeTruthy();
  });

  it('action items: remove row produces remove op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    // Remove the action item row by changing its ID to empty and clearing content
    const modified = removeRowFromTable(
      buffer, ACTION_HEADERS,
      (row) => row['ID'] === 'A-1',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const removeOp = result.patch!.operations.find(
      (op) => op.op === 'remove' && op.path === '/action_items/A-1',
    );
    expect(removeOp).toBeTruthy();
  });

  it('duplicate ID in documents table produces warning', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    // Add a duplicate row with the same ID
    const modified = addRowToTable(
      buffer, DOC_HEADERS,
      { 'ID': 'entry-1', 'Title': 'Duplicate', 'Link': '', 'Status': 'Draft', 'Responsible': '' },
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dupWarning = result.warnings.find((w) => w.code === 'DUPLICATE_ID');
    expect(dupWarning).toBeTruthy();
    expect(dupWarning!.message).toContain('entry-1');
  });

  it('merged cells in DOCX produce MERGED_CELLS error', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    // Inject a vMerge attribute into a table cell
    const zip = new AdmZip(buffer);
    const xmlEntry = zip.getEntry('word/document.xml')!;
    const xmlStr = xmlEntry.getData().toString('utf-8');
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

    // Find the documents table and add vMerge to first data cell
    const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
    for (let t = 0; t < tables.length; t++) {
      const rows = Array.from(tables[t].childNodes).filter(
        (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tr',
      );
      if (rows.length < 2) continue;
      const cells = Array.from(rows[1].childNodes).filter(
        (n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc',
      );
      if (cells.length === 0) continue;

      // Add tcPr with vMerge
      let tcPr = cells[0].getElementsByTagNameNS(W_NS, 'tcPr').item(0);
      if (!tcPr) {
        tcPr = doc.createElementNS(W_NS, 'w:tcPr');
        cells[0].insertBefore(tcPr, cells[0].firstChild);
      }
      const vMerge = doc.createElementNS(W_NS, 'w:vMerge');
      tcPr.appendChild(vMerge);
      break;
    }

    const serializer = new XMLSerializer();
    const updatedXml = serializer.serializeToString(doc);
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-merge-'));
    tempDirs.push(tempDir);
    const tempPath = join(tempDir, 'merged.docx');
    zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
    zip.writeZip(tempPath);

    const mergedBuffer = readFileSync(tempPath);
    const result = importChecklistFromDocx({
      docxBuffer: mergedBuffer,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('MERGED_CELLS');
  });

  it('wrong table headers produce TABLE_NOT_FOUND error', async () => {
    // Build a DOCX with all table headers replaced
    const buffer = await renderChecklistDocx(baseChecklist);
    const zip = new AdmZip(buffer);
    const xmlEntry = zip.getEntry('word/document.xml')!;
    const xmlStr = xmlEntry.getData().toString('utf-8');
    // Replace all recognized headers with garbage to prevent table matching
    let mutated = xmlStr;
    for (const h of [...DOC_HEADERS, ...ACTION_HEADERS, ...ISSUE_HEADERS]) {
      mutated = mutated.split(`>${h}<`).join(`>X_${h}<`);
    }
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-roundtrip-hdr-'));
    tempDirs.push(tempDir);
    const tempPath = join(tempDir, 'wrong-headers.docx');
    zip.updateFile('word/document.xml', Buffer.from(mutated, 'utf-8'));
    zip.writeZip(tempPath);

    const result = importChecklistFromDocx({
      docxBuffer: readFileSync(tempPath),
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('TABLE_NOT_FOUND');
  });

  it('control row filtering: {FOR / {END-FOR rows are not imported', async () => {
    // The rendered DOCX should naturally contain control rows from docx-templates
    // After fill, the control text is removed, so this test verifies our filter
    // doesn't produce false positives on normal data
    const buffer = await renderChecklistDocx(baseChecklist);
    const result = importChecklistFromDocx({
      docxBuffer: buffer,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // No spurious changes from any leftover control-row-like content
    expect(result.patch).toBeNull();
    expect(result.summary.documentsProcessed).toBeGreaterThan(0);
  });

  it('invalid DOCX buffer returns PARSE_FAILED', () => {
    const result = importChecklistFromDocx({
      docxBuffer: Buffer.from('not a valid zip'),
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error_code).toBe('PARSE_FAILED');
  });

  it('documents table: clearing responsible produces remove op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Responsible',
      (row) => row['ID'] === 'entry-1',
      '',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const removeOp = result.patch!.operations.find(
      (op) => op.op === 'remove' && op.path === '/checklist_entries/entry-1/responsible_party',
    );
    expect(removeOp).toBeTruthy();
  });

  it('documents table: adding responsible where none exists produces replace op', async () => {
    const noResponsibleChecklist: ClosingChecklist = {
      ...baseChecklist,
      checklist_entries: {
        'entry-1': {
          ...baseChecklist.checklist_entries['entry-1']!,
          responsible_party: undefined,
        },
      },
    };

    const buffer = await renderChecklistDocx(noResponsibleChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Responsible',
      (row) => row['ID'] === 'entry-1',
      'New Org',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: noResponsibleChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const addOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/responsible_party',
    );
    expect(addOp).toBeTruthy();
    expect((addOp!.value as Record<string, string>).organization).toBe('New Org');
  });

  it('documents table: org-only canonical with changed org', async () => {
    const orgOnlyChecklist: ClosingChecklist = {
      ...baseChecklist,
      checklist_entries: {
        'entry-1': {
          ...baseChecklist.checklist_entries['entry-1']!,
          responsible_party: { organization: 'Old Org' },
        },
      },
    };

    const buffer = await renderChecklistDocx(orgOnlyChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Responsible',
      (row) => row['ID'] === 'entry-1',
      'New Org',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: orgOnlyChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const orgOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/responsible_party/organization',
    );
    expect(orgOp).toBeTruthy();
    expect(orgOp!.value).toBe('New Org');
  });

  it('documents table: individual-only canonical parse', async () => {
    const individualOnlyChecklist: ClosingChecklist = {
      ...baseChecklist,
      checklist_entries: {
        'entry-1': {
          ...baseChecklist.checklist_entries['entry-1']!,
          responsible_party: { individual_name: 'Jane Doe' },
        },
      },
    };

    const buffer = await renderChecklistDocx(individualOnlyChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Responsible',
      (row) => row['ID'] === 'entry-1',
      'John Smith',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: individualOnlyChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const nameOp = result.patch!.operations.find(
      (op) => op.path === '/checklist_entries/entry-1/responsible_party/individual_name',
    );
    expect(nameOp).toBeTruthy();
    expect(nameOp!.value).toBe('John Smith');
  });

  it('documents table: clearing link produces remove op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, DOC_HEADERS, 'Link',
      (row) => row['ID'] === 'entry-1',
      '',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const linkOp = result.patch!.operations.find(
      (op) => op.path === '/documents/doc-1/primary_link',
    );
    expect(linkOp).toBeTruthy();
    expect(linkOp!.op).toBe('remove');
  });

  it('action items: detects description, assigned_to, and due_date changes', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    let modified = modifyCellInDocx(
      buffer, ACTION_HEADERS, 'Description',
      (row) => row['ID'] === 'A-1',
      'Updated description',
    );
    modified = modifyCellInDocx(
      modified, ACTION_HEADERS, 'Assigned To',
      (row) => row['ID'] === 'A-1',
      'Charlie',
    );
    modified = modifyCellInDocx(
      modified, ACTION_HEADERS, 'Due Date',
      (row) => row['ID'] === 'A-1',
      '2026-04-01',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();

    const descOp = result.patch!.operations.find((op) => op.path === '/action_items/A-1/description');
    expect(descOp).toBeTruthy();
    expect(descOp!.value).toBe('Updated description');

    const assignedOp = result.patch!.operations.find((op) => op.path === '/action_items/A-1/assigned_to/individual_name');
    expect(assignedOp).toBeTruthy();
    expect(assignedOp!.value).toBe('Charlie');

    const dueOp = result.patch!.operations.find((op) => op.path === '/action_items/A-1/due_date');
    expect(dueOp).toBeTruthy();
    expect(dueOp!.value).toBe('2026-04-01');
  });

  it('action items: clearing due_date produces remove op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ACTION_HEADERS, 'Due Date',
      (row) => row['ID'] === 'A-1',
      '',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const dueOp = result.patch!.operations.find((op) => op.path === '/action_items/A-1/due_date');
    expect(dueOp).toBeTruthy();
    expect(dueOp!.op).toBe('remove');
  });

  it('issues: add row with empty ID produces add op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = addRowToTable(
      buffer, ISSUE_HEADERS,
      { 'ID': '', 'Title': 'New issue from DOCX', 'Status': 'Open', 'Summary': 'Needs discussion', 'Citation': '' },
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const addOps = result.patch!.operations.filter(
      (op) => op.op === 'add' && op.path.startsWith('/issues/'),
    );
    expect(addOps.length).toBeGreaterThanOrEqual(1);
    const value = addOps[0]!.value as Record<string, unknown>;
    expect(value.title).toBe('New issue from DOCX');
  });

  it('issues: remove row produces remove op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = removeRowFromTable(
      buffer, ISSUE_HEADERS,
      (row) => row['ID'] === 'I-1',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const removeOp = result.patch!.operations.find(
      (op) => op.op === 'remove' && op.path === '/issues/I-1',
    );
    expect(removeOp).toBeTruthy();
  });

  it('issues: detects title change', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ISSUE_HEADERS, 'Title',
      (row) => row['ID'] === 'I-1',
      'Revised indemnity cap',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const titleOp = result.patch!.operations.find((op) => op.path === '/issues/I-1/title');
    expect(titleOp).toBeTruthy();
    expect(titleOp!.value).toBe('Revised indemnity cap');
  });

  it('issues: clearing summary produces remove op', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ISSUE_HEADERS, 'Summary',
      (row) => row['ID'] === 'I-1',
      '',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const summaryOp = result.patch!.operations.find((op) => op.path === '/issues/I-1/summary');
    expect(summaryOp).toBeTruthy();
    expect(summaryOp!.op).toBe('remove');
  });

  it('action items: assigning to unassigned item creates assigned_to', async () => {
    const unassignedChecklist: ClosingChecklist = {
      ...baseChecklist,
      action_items: {
        'A-1': {
          ...baseChecklist.action_items['A-1']!,
          assigned_to: undefined,
        },
      },
    };

    const buffer = await renderChecklistDocx(unassignedChecklist);
    const modified = modifyCellInDocx(
      buffer, ACTION_HEADERS, 'Assigned To',
      (row) => row['ID'] === 'A-1',
      'New Person',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: unassignedChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).not.toBeNull();
    const assignedOp = result.patch!.operations.find((op) => op.path === '/action_items/A-1/assigned_to');
    expect(assignedOp).toBeTruthy();
    expect((assignedOp!.value as Record<string, string>).individual_name).toBe('New Person');
  });

  it('action items: unknown ID produces warning', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ACTION_HEADERS, 'ID',
      (row) => row['ID'] === 'A-1',
      'A-UNKNOWN',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unknownWarning = result.warnings.find((w) => w.code === 'UNKNOWN_ID' && w.table === 'action_items');
    expect(unknownWarning).toBeTruthy();
  });

  it('issues: unknown ID produces warning', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = modifyCellInDocx(
      buffer, ISSUE_HEADERS, 'ID',
      (row) => row['ID'] === 'I-1',
      'I-UNKNOWN',
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unknownWarning = result.warnings.find((w) => w.code === 'UNKNOWN_ID' && w.table === 'issues');
    expect(unknownWarning).toBeTruthy();
  });

  it('issues: duplicate ID produces warning', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = addRowToTable(
      buffer, ISSUE_HEADERS,
      { 'ID': 'I-1', 'Title': 'Duplicate', 'Status': 'Open', 'Summary': '', 'Citation': '' },
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dupWarning = result.warnings.find((w) => w.code === 'DUPLICATE_ID' && w.table === 'issues');
    expect(dupWarning).toBeTruthy();
  });

  it('action items: duplicate ID produces warning', async () => {
    const buffer = await renderChecklistDocx(baseChecklist);
    const modified = addRowToTable(
      buffer, ACTION_HEADERS,
      { 'ID': 'A-1', 'Description': 'Duplicate', 'Status': 'Not Started', 'Assigned To': '', 'Due Date': '' },
    );

    const result = importChecklistFromDocx({
      docxBuffer: modified,
      canonicalChecklist: baseChecklist,
      checklistId: 'test-1',
      currentRevision: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dupWarning = result.warnings.find((w) => w.code === 'DUPLICATE_ID' && w.table === 'action_items');
    expect(dupWarning).toBeTruthy();
  });
});
