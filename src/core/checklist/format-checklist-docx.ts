/**
 * Post-fill formatter for closing-checklist DOCX files.
 *
 * After docx-templates fills the template, every row looks identical.
 * This formatter opens the DOCX, finds the Documents table, classifies
 * each row (stage heading, main entry, citation, signatory, action, issue),
 * and applies semantic XML formatting: bold, italic, color, indentation.
 */

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XMLDocument, Element, Node } from '@xmldom/xmldom';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const DOCUMENTS_HEADERS = ['No.', 'Title', 'Status', 'Responsible Party'];

// ---------------------------------------------------------------------------
// Row classification
// ---------------------------------------------------------------------------

type RowType = 'stage_heading' | 'main_entry' | 'citation' | 'signatory' | 'action' | 'issue' | 'unknown';

function classifyRow(numberText: string, titleText: string): RowType {
  // Stage heading: number cell empty, title matches roman numeral pattern
  if (!numberText.trim() && /^[IVX]+\.\s/.test(titleText.trim())) {
    return 'stage_heading';
  }
  // Main entry: number cell non-empty
  if (numberText.trim()) {
    return 'main_entry';
  }
  // Sub-rows: number cell empty, classify by title content
  const stripped = titleText.replace(/^\u00A0+/, '').trim();
  if (stripped.startsWith('Ref:')) return 'citation';
  if (/^\u2610\s+Signatory:|^\u2611\s+Signatory:|^Signatory:/.test(stripped)) return 'signatory';
  if (/^\u2610\s+Action\s|^\u2611\s+Action\s|^Action\s/.test(stripped)) return 'action';
  if (/^\u2610\s+Issue\s|^\u2611\s+Issue\s|^Issue\s/.test(stripped)) return 'issue';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// XML helpers (same patterns as recipe/patcher.ts)
// ---------------------------------------------------------------------------

function ensureRunProperties(run: Element): Element {
  const doc = run.ownerDocument as XMLDocument;
  const children = run.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'rPr' && child.namespaceURI === W_NS) {
      return child;
    }
  }
  const rPr = doc.createElementNS(W_NS, 'w:rPr');
  run.insertBefore(rPr, run.firstChild);
  return rPr;
}

function setRunBold(run: Element): void {
  const rPr = ensureRunProperties(run);
  // Check if <w:b/> already exists
  const children = rPr.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'b' && child.namespaceURI === W_NS) return;
  }
  const doc = run.ownerDocument as XMLDocument;
  const b = doc.createElementNS(W_NS, 'w:b');
  rPr.appendChild(b);
}

function setRunItalic(run: Element): void {
  const rPr = ensureRunProperties(run);
  const children = rPr.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'i' && child.namespaceURI === W_NS) return;
  }
  const doc = run.ownerDocument as XMLDocument;
  const iEl = doc.createElementNS(W_NS, 'w:i');
  rPr.appendChild(iEl);
}

function setRunColor(run: Element, colorHex: string): void {
  const rPr = ensureRunProperties(run);
  const doc = run.ownerDocument as XMLDocument;
  const children = rPr.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'color' && child.namespaceURI === W_NS) {
      child.setAttributeNS(W_NS, 'w:val', colorHex);
      return;
    }
  }
  const color = doc.createElementNS(W_NS, 'w:color');
  color.setAttributeNS(W_NS, 'w:val', colorHex);
  rPr.appendChild(color);
}

function ensureParagraphProperties(para: Element): Element {
  const doc = para.ownerDocument as XMLDocument;
  const children = para.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'pPr' && child.namespaceURI === W_NS) {
      return child;
    }
  }
  const pPr = doc.createElementNS(W_NS, 'w:pPr');
  para.insertBefore(pPr, para.firstChild);
  return pPr;
}

function setParagraphIndent(para: Element, leftDxa: number): void {
  const pPr = ensureParagraphProperties(para);
  const doc = para.ownerDocument as XMLDocument;

  // Find or create <w:ind>
  const children = pPr.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.localName === 'ind' && child.namespaceURI === W_NS) {
      child.setAttributeNS(W_NS, 'w:left', String(leftDxa));
      return;
    }
  }
  const ind = doc.createElementNS(W_NS, 'w:ind');
  ind.setAttributeNS(W_NS, 'w:left', String(leftDxa));
  pPr.appendChild(ind);
}

// ---------------------------------------------------------------------------
// NBSP indent handling
// ---------------------------------------------------------------------------

const NBSP = '\u00A0';
const DXA_PER_LEVEL = 360;

/**
 * Count leading NBSP pairs in all text nodes of a table cell,
 * strip them from the text content, and return the indent level.
 */
function countAndStripNbspIndent(tc: Element): number {
  const paragraphs = tc.getElementsByTagNameNS(W_NS, 'p');
  let maxLevel = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const runs = paragraphs[p].getElementsByTagNameNS(W_NS, 'r');
    if (runs.length === 0) continue;

    // Collect full text to count leading NBSPs
    let fullText = '';
    for (let r = 0; r < runs.length; r++) {
      const tEls = runs[r].getElementsByTagNameNS(W_NS, 't');
      for (let t = 0; t < tEls.length; t++) {
        fullText += tEls[t].textContent ?? '';
      }
    }

    // Count leading NBSP pairs
    let nbspCount = 0;
    for (let i = 0; i < fullText.length; i++) {
      if (fullText[i] === NBSP) {
        nbspCount++;
      } else {
        break;
      }
    }
    const level = Math.floor(nbspCount / 2);
    if (level > maxLevel) maxLevel = level;

    if (nbspCount > 0) {
      // Strip leading NBSPs from text runs
      let remaining = nbspCount;
      for (let r = 0; r < runs.length && remaining > 0; r++) {
        const tEls = runs[r].getElementsByTagNameNS(W_NS, 't');
        for (let t = 0; t < tEls.length && remaining > 0; t++) {
          const text = tEls[t].textContent ?? '';
          let stripCount = 0;
          for (let c = 0; c < text.length && remaining > 0; c++) {
            if (text[c] === NBSP) {
              stripCount++;
              remaining--;
            } else {
              break;
            }
          }
          if (stripCount > 0) {
            const newText = text.slice(stripCount);
            tEls[t].textContent = newText;
            if (newText.startsWith(' ') || newText.endsWith(' ') || newText === '') {
              (tEls[t] as Element).setAttribute('xml:space', 'preserve');
            }
          }
        }
      }

      // Set paragraph indent
      if (level > 0) {
        setParagraphIndent(paragraphs[p], level * DXA_PER_LEVEL);
      }
    }
  }

  return maxLevel;
}

// ---------------------------------------------------------------------------
// Cell text extraction
// ---------------------------------------------------------------------------

function getCellText(tc: Element): string {
  const tNodes = tc.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tNodes.length; i++) {
    parts.push(tNodes[i].textContent ?? '');
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Apply formatting to all runs in a cell
// ---------------------------------------------------------------------------

function getAllRunsInCell(tc: Element): Element[] {
  const runs: Element[] = [];
  const rNodes = tc.getElementsByTagNameNS(W_NS, 'r');
  for (let i = 0; i < rNodes.length; i++) {
    runs.push(rNodes[i] as Element);
  }
  return runs;
}

function formatCellRuns(tc: Element, format: { bold?: boolean; italic?: boolean; color?: string }): void {
  const runs = getAllRunsInCell(tc);
  for (const run of runs) {
    if (format.bold) setRunBold(run);
    if (format.italic) setRunItalic(run);
    if (format.color) setRunColor(run, format.color);
  }
}

// ---------------------------------------------------------------------------
// Find Documents table by matching header row
// ---------------------------------------------------------------------------

function findDocumentsTable(xmlDoc: XMLDocument): Element | null {
  const tables = xmlDoc.getElementsByTagNameNS(W_NS, 'tbl');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t] as Element;
    const rows = getDirectChildRows(table);
    if (rows.length === 0) continue;

    const headerRow = rows[0];
    const cells = getDirectChildCells(headerRow);
    const headerTexts = cells.map((c) => getCellText(c).trim());

    if (
      headerTexts.length === DOCUMENTS_HEADERS.length &&
      headerTexts.every((text, i) => text === DOCUMENTS_HEADERS[i])
    ) {
      return table;
    }
  }
  return null;
}

function getDirectChildRows(table: Element): Element[] {
  const rows: Element[] = [];
  const children = table.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Node;
    if (child.nodeType === 1) {
      const el = child as Element;
      if (el.localName === 'tr' && el.namespaceURI === W_NS) {
        rows.push(el);
      }
    }
  }
  return rows;
}

function getDirectChildCells(row: Element): Element[] {
  const cells: Element[] = [];
  const children = row.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Node;
    if (child.nodeType === 1) {
      const el = child as Element;
      if (el.localName === 'tc' && el.namespaceURI === W_NS) {
        cells.push(el);
      }
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Main formatter
// ---------------------------------------------------------------------------

export async function formatChecklistDocx(docxPath: string): Promise<void> {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return;

  const xmlStr = entry.getData().toString('utf-8');
  const xmlDoc = new DOMParser().parseFromString(xmlStr, 'text/xml');

  const docsTable = findDocumentsTable(xmlDoc);
  if (!docsTable) return;

  const rows = getDirectChildRows(docsTable);
  // Skip header row (index 0)
  for (let r = 1; r < rows.length; r++) {
    const cells = getDirectChildCells(rows[r]);
    if (cells.length < 2) continue;

    const numberText = getCellText(cells[0]);
    const titleText = getCellText(cells[1]);
    const rowType = classifyRow(numberText, titleText);

    // Convert NBSP indentation to OOXML indent on title cell
    countAndStripNbspIndent(cells[1]);

    const titleCell = cells[1];

    switch (rowType) {
      case 'stage_heading':
        formatCellRuns(titleCell, { italic: true, color: '8C8D8E' });
        break;
      case 'main_entry':
        formatCellRuns(titleCell, { bold: true });
        break;
      case 'citation':
        formatCellRuns(titleCell, { italic: true, color: '494A4B' });
        break;
      case 'signatory':
      case 'action':
      case 'issue':
        // Normal formatting; checkboxes already in text
        break;
      case 'unknown':
        break;
    }
  }

  // Serialize and write back
  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
  zip.writeZip(docxPath);
}
