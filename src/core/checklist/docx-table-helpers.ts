/**
 * Shared OOXML helpers for checklist DOCX processing.
 *
 * Extracted from format-checklist-docx.ts for reuse by the import module.
 */

import type { Document as XMLDocument, Element, Node } from '@xmldom/xmldom';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// ---------------------------------------------------------------------------
// Documents table headers (5 columns)
// ---------------------------------------------------------------------------

export const DOCUMENTS_HEADERS = ['ID', 'Title', 'Link', 'Status', 'Responsible'];

// Action Items headers (5 columns)
export const ACTION_ITEMS_HEADERS = ['ID', 'Description', 'Status', 'Assigned To', 'Due Date'];

// Issues headers (5 columns)
export const ISSUES_HEADERS = ['ID', 'Title', 'Status', 'Summary', 'Citation'];

// ---------------------------------------------------------------------------
// Row classification
// ---------------------------------------------------------------------------

export type RowType = 'stage_heading' | 'main_entry' | 'citation' | 'signatory' | 'action' | 'issue' | 'unknown';

/**
 * Classify a documents table row based on the ID and title cell text.
 */
export function classifyRow(idText: string, titleText: string): RowType {
  // Stage heading: ID cell empty, title matches roman numeral pattern
  if (!idText.trim() && /^[IVX]+\.\s/.test(titleText.trim())) {
    return 'stage_heading';
  }
  // Main entry: ID cell non-empty
  if (idText.trim()) {
    return 'main_entry';
  }
  // Sub-rows: ID cell empty, classify by title content
  const stripped = titleText.replace(/^\u00A0+/, '').trim();
  if (stripped.startsWith('Ref:')) return 'citation';
  if (/^(?:\[\s*\]|\[\s*[xXvV]\s*\])\s+Signatory:|^Signatory:/.test(stripped)) return 'signatory';
  if (/^(?:\[\s*\]|\[\s*[xXvV]\s*\])\s+Action\s|^Action\s/.test(stripped)) return 'action';
  if (/^(?:\[\s*\]|\[\s*[xXvV]\s*\])\s+Issue\s|^Issue\s/.test(stripped)) return 'issue';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// DOM traversal helpers
// ---------------------------------------------------------------------------

export function getDirectChildRows(table: Element): Element[] {
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

export function getDirectChildCells(row: Element): Element[] {
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

export function getCellText(tc: Element): string {
  const tNodes = tc.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tNodes.length; i++) {
    parts.push(tNodes[i].textContent ?? '');
  }
  return parts.join('');
}

/**
 * Find a table by matching its header row against expected headers.
 */
export function findTableByHeaders(xmlDoc: XMLDocument, headers: string[]): Element | null {
  const tables = xmlDoc.getElementsByTagNameNS(W_NS, 'tbl');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t]!;
    const rows = getDirectChildRows(table as unknown as Element);
    if (rows.length === 0) continue;

    const headerRow = rows[0]!;
    const cells = getDirectChildCells(headerRow);
    const headerTexts = cells.map((c) => getCellText(c).trim());

    if (
      headerTexts.length === headers.length &&
      headerTexts.every((text, i) => text === headers[i])
    ) {
      return table as unknown as Element;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Control row detection (for docx-templates FOR/END-FOR rows)
// ---------------------------------------------------------------------------

/**
 * Returns true if a row is a docx-templates control row ({FOR ...} / {END-FOR ...}).
 * These are identified by tiny font size (≤ 4 half-points) or {FOR / {END-FOR text.
 */
export function isControlRow(row: Element): boolean {
  const cells = getDirectChildCells(row);
  if (cells.length === 0) return false;

  const firstCellText = getCellText(cells[0]!).trim();
  if (firstCellText.startsWith('{FOR') || firstCellText.startsWith('{END-FOR')) {
    return true;
  }

  // Check font size of all runs in first cell
  const runs = cells[0]!.getElementsByTagNameNS(W_NS, 'r');
  for (let r = 0; r < runs.length; r++) {
    const rPr = runs[r].getElementsByTagNameNS(W_NS, 'rPr');
    if (rPr.length === 0) continue;
    const szEls = rPr[0].getElementsByTagNameNS(W_NS, 'sz');
    if (szEls.length > 0) {
      const szVal = szEls[0].getAttributeNS(W_NS, 'val') ?? szEls[0].getAttribute('w:val');
      if (szVal && parseInt(szVal, 10) <= 4) {
        return true;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Render version marker
// ---------------------------------------------------------------------------

export const RENDER_VERSION_MARKER = '<!--oa:render_version=closing-checklist-->';

/**
 * Extract the render version marker from document text content.
 * Returns the version string or null if not found.
 */
export function extractRenderVersion(xmlDoc: XMLDocument): string | null {
  const W_NS_LOCAL = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body = xmlDoc.getElementsByTagNameNS(W_NS_LOCAL, 'body').item(0);
  if (!body) return null;

  const paragraphs = body.getElementsByTagNameNS(W_NS_LOCAL, 'p');
  for (let i = 0; i < paragraphs.length; i++) {
    const tNodes = paragraphs[i].getElementsByTagNameNS(W_NS_LOCAL, 't');
    for (let t = 0; t < tNodes.length; t++) {
      const text = tNodes[t].textContent ?? '';
      const match = /<!--oa:render_version=([^>]+)-->/.exec(text);
      if (match) return match[1]!;
    }
  }
  return null;
}
