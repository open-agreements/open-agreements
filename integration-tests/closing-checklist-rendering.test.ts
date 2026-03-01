import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element, Node } from '@xmldom/xmldom';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { fillTemplate } from '../src/core/engine.js';
import { buildChecklistTemplateContext, formatChecklistDocx } from '../src/core/checklist/index.js';
import { findTemplateDir } from '../src/utils/paths.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Template Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function getTableRowsAsCellText(docxPath: string): string[][][] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  const result: string[][][] = [];

  for (let t = 0; t < tables.length; t++) {
    const rows: string[][] = [];
    const rowNodes = Array.from(tables[t].childNodes ?? []).filter((node: Node): node is Element => {
      if (node.nodeType !== 1) return false;
      const element = node as Element;
      return element.localName === 'tr' && element.namespaceURI === W_NS;
    });
    for (const row of rowNodes) {
      const cells = Array.from(row.childNodes ?? []).filter((node: Node): node is Element => {
        if (node.nodeType !== 1) return false;
        const element = node as Element;
        return element.localName === 'tc' && element.namespaceURI === W_NS;
      });
      const cellText = cells.map((cell) => {
        const textNodes = cell.getElementsByTagNameNS(W_NS, 't');
        const parts: string[] = [];
        for (let i = 0; i < textNodes.length; i++) {
          parts.push(textNodes[i].textContent ?? '');
        }
        return parts.join('').trim();
      });
      rows.push(cellText);
    }
    result.push(rows);
  }

  return result;
}

interface CellFormatting {
  bold: boolean;
  italic: boolean;
  indentLeft: number;
  text: string;
}

/**
 * Extract formatting properties from each cell in the Documents table.
 * Returns array of row arrays, each row is an array of CellFormatting objects.
 */
function getTableRowFormatting(docxPath: string): CellFormatting[][] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  const headerTargets = ['No.', 'Title', 'Status', 'Responsible Party'];

  // Find the Documents table by matching header
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t] as Element;
    const rowNodes = Array.from(table.childNodes ?? []).filter((node: Node): node is Element => {
      if (node.nodeType !== 1) return false;
      const el = node as Element;
      return el.localName === 'tr' && el.namespaceURI === W_NS;
    });
    if (rowNodes.length === 0) continue;

    // Check header
    const headerCells = Array.from(rowNodes[0].childNodes ?? []).filter((node: Node): node is Element => {
      if (node.nodeType !== 1) return false;
      const el = node as Element;
      return el.localName === 'tc' && el.namespaceURI === W_NS;
    });
    const headerText = headerCells.map((cell) => {
      const tNodes = cell.getElementsByTagNameNS(W_NS, 't');
      const parts: string[] = [];
      for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
      return parts.join('').trim();
    });
    if (headerText.length !== headerTargets.length || !headerText.every((h, i) => h === headerTargets[i])) {
      continue;
    }

    // Parse all data rows
    const result: CellFormatting[][] = [];
    for (let r = 1; r < rowNodes.length; r++) {
      const cells = Array.from(rowNodes[r].childNodes ?? []).filter((node: Node): node is Element => {
        if (node.nodeType !== 1) return false;
        const el = node as Element;
        return el.localName === 'tc' && el.namespaceURI === W_NS;
      });

      const cellFormats: CellFormatting[] = cells.map((cell) => {
        // Text
        const tNodes = cell.getElementsByTagNameNS(W_NS, 't');
        const parts: string[] = [];
        for (let i = 0; i < tNodes.length; i++) parts.push(tNodes[i].textContent ?? '');
        const text = parts.join('').trim();

        // Bold: check if any run has <w:b/> in <w:rPr>
        const runs = cell.getElementsByTagNameNS(W_NS, 'r');
        let bold = false;
        let italic = false;
        for (let i = 0; i < runs.length; i++) {
          const rPrs = (runs[i] as Element).getElementsByTagNameNS(W_NS, 'rPr');
          for (let j = 0; j < rPrs.length; j++) {
            const bNodes = (rPrs[j] as Element).getElementsByTagNameNS(W_NS, 'b');
            if (bNodes.length > 0) bold = true;
            const iNodes = (rPrs[j] as Element).getElementsByTagNameNS(W_NS, 'i');
            if (iNodes.length > 0) italic = true;
          }
        }

        // Indent: check <w:ind w:left="N"/> in paragraph properties
        let indentLeft = 0;
        const pNodes = cell.getElementsByTagNameNS(W_NS, 'p');
        for (let p = 0; p < pNodes.length; p++) {
          const pPrs = (pNodes[p] as Element).getElementsByTagNameNS(W_NS, 'pPr');
          for (let j = 0; j < pPrs.length; j++) {
            const indNodes = (pPrs[j] as Element).getElementsByTagNameNS(W_NS, 'ind');
            for (let k = 0; k < indNodes.length; k++) {
              const leftVal = (indNodes[k] as Element).getAttributeNS(W_NS, 'left');
              if (leftVal) indentLeft = parseInt(leftVal, 10);
            }
          }
        }

        return { bold, italic, indentLeft, text };
      });

      result.push(cellFormats);
    }

    return result;
  }

  return [];
}

describe('closing-checklist rendering', () => {
  it.openspec('OA-CKL-028')('renders stage-first 4-column checklist with linked items and unlinked fallbacks', async () => {
    const templateDir = findTemplateDir('closing-checklist');
    expect(templateDir).toBeTruthy();

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-closing-checklist-'));
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, 'closing-checklist.docx');

    await fillTemplate({
      templateDir: templateDir!,
      outputPath,
      values: buildChecklistTemplateContext({
        deal_name: 'Project Atlas - Series A Closing',
        updated_at: '2026-02-20',
        documents: {
          'doc-spa-form': {
            document_id: 'doc-spa-form',
            title: 'Stock Purchase Agreement (Form)',
            primary_link: 'https://drive.example.com/spa-form',
            labels: ['phase:signing'],
          },
          'doc-escrow-exec': {
            document_id: 'doc-escrow-exec',
            title: 'Escrow Agreement (Executed)',
            primary_link: 'https://drive.example.com/escrow-exec',
            labels: ['phase:closing'],
          },
        },
        checklist_entries: {
          'entry-spa': {
            entry_id: 'entry-spa',
            document_id: 'doc-spa-form',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'Stock Purchase Agreement (Form)',
            status: 'FORM_FINAL',
            citations: [{ ref: 'SPA §2.1' }],
          },
          'entry-escrow': {
            entry_id: 'entry-escrow',
            document_id: 'doc-escrow-exec',
            stage: 'CLOSING',
            sort_key: '200',
            title: 'Escrow Agreement (Executed)',
            status: 'PARTIALLY_SIGNED',
            responsible_party: { organization: 'Finance' },
            signatories: [
              {
                party: 'Buyer',
                name: 'A. Lee',
                status: 'RECEIVED',
                signature_artifacts: [{ uri: 'https://drive.example.com/buyer-escrow-sig.pdf' }],
              },
              {
                party: 'Seller',
                name: 'M. Kent',
                status: 'PENDING',
                signature_artifacts: [],
              },
            ],
          },
        },
        action_items: {
          'A-101': {
            action_id: 'A-101',
            description: 'Collect escrow signature pages',
            status: 'IN_PROGRESS',
            assigned_to: { organization: 'Finance' },
            due_date: '2026-02-24',
            related_document_ids: ['doc-escrow-exec'],
          },
          'A-102': {
            action_id: 'A-102',
            description: 'Order good standing certificate',
            status: 'NOT_STARTED',
            assigned_to: { organization: 'Paralegal' },
            due_date: '2026-02-25',
            related_document_ids: [],
          },
        },
        issues: {
          'I-77': {
            issue_id: 'I-77',
            title: 'MFN carveout language',
            status: 'OPEN',
            summary: 'Pending partner review',
            related_document_ids: ['doc-spa-form'],
          },
          'I-88': {
            issue_id: 'I-88',
            title: 'Outstanding tax certificate',
            status: 'OPEN',
            summary: 'Not yet raised to counterparty',
            related_document_ids: [],
          },
        },
      }),
      postProcess: formatChecklistDocx,
    });

    const tables = getTableRowsAsCellText(outputPath);

    // 3 tables: documents (4-col), action_items (5-col), open_issues (4-col)
    expect(tables).toHaveLength(3);

    // Documents table: header + data rows
    const docTable = tables[0];
    // Header row
    expect(docTable[0]).toEqual(['No.', 'Title', 'Status', 'Responsible Party']);

    // Find stage headings and entry rows (skip FOR control rows)
    const docDataRows = docTable.filter((row) => {
      // Skip header, FOR control rows (empty first cell with no title text)
      const hasContent = row.some((cell) => cell.length > 0);
      return hasContent && row[0] !== 'No.';
    });

    // Should contain stage headings and entries
    const signingHeading = docDataRows.find((row) => row[1].includes('SIGNING'));
    expect(signingHeading).toBeTruthy();

    const closingHeading = docDataRows.find((row) => row[1].includes('CLOSING'));
    expect(closingHeading).toBeTruthy();

    // Entry rows should have human-readable statuses
    const spaRow = docDataRows.find((row) => row[1].includes('Stock Purchase Agreement'));
    expect(spaRow).toBeTruthy();
    expect(spaRow![2]).toBe('Form Final');

    const escrowRow = docDataRows.find((row) => row[1].includes('Escrow Agreement'));
    expect(escrowRow).toBeTruthy();
    expect(escrowRow![2]).toBe('Partially Signed');
    expect(escrowRow![3]).toBe('Finance');

    // Citation sub-row
    const citationRow = docDataRows.find((row) => row[1].includes('Ref: SPA'));
    expect(citationRow).toBeTruthy();

    // Signatory sub-rows (now with checkbox prefixes)
    const buyerSigRow = docDataRows.find((row) => row[1].includes('Signatory: Buyer'));
    expect(buyerSigRow).toBeTruthy();
    expect(buyerSigRow![1]).toContain('Received');
    expect(buyerSigRow![1]).toContain('\u2611'); // ☑ for RECEIVED

    const sellerSigRow = docDataRows.find((row) => row[1].includes('Signatory: Seller'));
    expect(sellerSigRow).toBeTruthy();
    expect(sellerSigRow![1]).toContain('\u2610'); // ☐ for PENDING

    // Linked action sub-row (with checkbox)
    const linkedAction = docDataRows.find((row) => row[1].includes('Action A-101'));
    expect(linkedAction).toBeTruthy();
    expect(linkedAction![2]).toBe('In Progress');
    expect(linkedAction![1]).toContain('\u2610'); // ☐ for IN_PROGRESS (not COMPLETED)

    // Linked issue sub-row (with checkbox)
    const linkedIssue = docDataRows.find((row) => row[1].includes('Issue I-77'));
    expect(linkedIssue).toBeTruthy();
    expect(linkedIssue![2]).toBe('Open');
    expect(linkedIssue![1]).toContain('\u2610'); // ☐ for OPEN (not CLOSED)

    // Unlinked action items table (5-col)
    const actTable = tables[1];
    expect(actTable[0]).toEqual(['ID', 'Description', 'Status', 'Assigned To', 'Due Date']);
    const a102Row = actTable.find((row) => row[0] === 'A-102');
    expect(a102Row).toBeTruthy();
    expect(a102Row![2]).toBe('Not Started');

    // Unlinked issues table (4-col)
    const issTable = tables[2];
    expect(issTable[0]).toEqual(['ID', 'Title', 'Status', 'Summary']);
    const i88Row = issTable.find((row) => row[0] === 'I-88');
    expect(i88Row).toBeTruthy();
    expect(i88Row![2]).toBe('Open');

    // -----------------------------------------------------------------------
    // Formatting assertions (post-process: bold, italic, indent)
    // -----------------------------------------------------------------------
    const formatting = getTableRowFormatting(outputPath);
    expect(formatting.length).toBeGreaterThan(0);

    // Stage heading rows: title cell should be italic
    const stageHeadingFmt = formatting.find((row) => row[1]?.text.includes('SIGNING') && /^[IVX]+\./.test(row[1].text));
    expect(stageHeadingFmt).toBeTruthy();
    expect(stageHeadingFmt![1].italic).toBe(true);

    // Main entry rows: title cell should be bold
    const spaFmt = formatting.find((row) => row[1]?.text.includes('Stock Purchase Agreement'));
    expect(spaFmt).toBeTruthy();
    expect(spaFmt![1].bold).toBe(true);

    const escrowFmt = formatting.find((row) => row[1]?.text.includes('Escrow Agreement'));
    expect(escrowFmt).toBeTruthy();
    expect(escrowFmt![1].bold).toBe(true);

    // Citation sub-rows: title cell should be italic
    const citFmt = formatting.find((row) => row[1]?.text.includes('Ref: SPA'));
    expect(citFmt).toBeTruthy();
    expect(citFmt![1].italic).toBe(true);

    // Sub-rows should have indent > 0 and no leading NBSPs in text
    const sigFmt = formatting.find((row) => row[1]?.text.includes('Signatory: Buyer'));
    expect(sigFmt).toBeTruthy();
    expect(sigFmt![1].indentLeft).toBeGreaterThan(0);
    expect(sigFmt![1].text).not.toMatch(/^\u00A0/);

    const actionFmt = formatting.find((row) => row[1]?.text.includes('Action A-101'));
    expect(actionFmt).toBeTruthy();
    expect(actionFmt![1].indentLeft).toBeGreaterThan(0);
    expect(actionFmt![1].text).not.toMatch(/^\u00A0/);

    const issueFmt = formatting.find((row) => row[1]?.text.includes('Issue I-77'));
    expect(issueFmt).toBeTruthy();
    expect(issueFmt![1].indentLeft).toBeGreaterThan(0);
    expect(issueFmt![1].text).not.toMatch(/^\u00A0/);
  });
});
