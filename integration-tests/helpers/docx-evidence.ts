/**
 * DOCX-native evidence helpers for Allure test reports.
 *
 * Renders closing-checklist data through the actual DOCX template, walks
 * OOXML to HTML for visual previews, and uses docx-comparison for redlines.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { fillTemplate } from '../../src/core/engine.js';
import { buildChecklistTemplateContext } from '../../src/core/checklist/index.js';
import { findTemplateDir } from '../../src/utils/paths.js';
import { compareDocuments } from '@usejunior/docx-core';
import { buildHtmlAttachment, escapeForHtml } from '@usejunior/allure-test-factory';
import { allureAttachment } from './allure-test.js';

// ── renderChecklistDocx ─────────────────────────────────────────────────────

/**
 * Fill the closing-checklist template with checklist data and return the DOCX
 * as a Buffer. Uses a temporary directory for the output file.
 */
export async function renderChecklistDocx(data: unknown): Promise<Buffer> {
  const templateDir = findTemplateDir('closing-checklist');
  if (!templateDir) {
    throw new Error('closing-checklist template not found');
  }

  const context = buildChecklistTemplateContext(data);
  const tempDir = mkdtempSync(join(tmpdir(), 'oa-checklist-'));
  const outputPath = join(tempDir, 'checklist.docx');

  try {
    await fillTemplate({
      templateDir,
      values: context as unknown as Record<string, unknown>,
      outputPath,
    });
    return readFileSync(outputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ── docxToHtml ──────────────────────────────────────────────────────────────

/**
 * Walk OOXML document.xml inside a DOCX buffer and produce an HTML string
 * suitable for Allure evidence attachments.
 *
 * Handles paragraphs, runs, tables, basic text formatting, and tracked
 * changes (w:ins / w:del / w:moveFrom / w:moveTo).
 */
export function docxToHtml(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const documentEntry = zip.getEntry('word/document.xml');
  if (!documentEntry) {
    throw new Error('word/document.xml not found in DOCX');
  }

  const xml = documentEntry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const body = doc.getElementsByTagName('w:body')[0];
  if (!body) {
    return '<p>(empty document)</p>';
  }

  const parts: string[] = [];
  walkChildren(body, parts, false);
  return parts.join('');
}

function walkChildren(parent: Node, parts: string[], inHeaderRow: boolean): void {
  const children = parent.childNodes;
  if (!children) return;
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    if (node.nodeType !== 1) continue; // Element nodes only
    walkElement(node as Element, parts, inHeaderRow);
  }
}

function walkElement(el: Element, parts: string[], inHeaderRow: boolean): void {
  const tag = el.localName ?? el.nodeName?.split(':').pop() ?? '';

  switch (tag) {
    case 'p': {
      const heading = detectHeading(el);
      if (heading) {
        parts.push(`<${heading}>`);
        walkChildren(el, parts, false);
        parts.push(`</${heading}>`);
      } else {
        parts.push('<p>');
        walkChildren(el, parts, false);
        parts.push('</p>');
      }
      break;
    }
    case 'r': {
      const styles = detectRunStyle(el);
      if (styles) {
        parts.push(`<span style="${styles}">`);
      }
      walkChildren(el, parts, inHeaderRow);
      if (styles) {
        parts.push('</span>');
      }
      break;
    }
    case 't': {
      const text = el.textContent ?? '';
      parts.push(escapeForHtml(text));
      break;
    }
    case 'tab': {
      parts.push('\u00A0\u00A0\u00A0\u00A0');
      break;
    }
    case 'br': {
      parts.push('<br>');
      break;
    }
    case 'tbl': {
      parts.push('<table class="docx-table">');
      walkChildren(el, parts, false);
      parts.push('</table>');
      break;
    }
    case 'tr': {
      const isHeader = hasChildTag(el, 'trPr', 'tblHeader');
      parts.push('<tr>');
      walkChildren(el, parts, isHeader);
      parts.push('</tr>');
      break;
    }
    case 'tc': {
      const cellTag = inHeaderRow ? 'th' : 'td';
      parts.push(`<${cellTag}>`);
      walkChildren(el, parts, false);
      parts.push(`</${cellTag}>`);
      break;
    }
    case 'ins': {
      parts.push('<span class="doc-ins">');
      walkChildren(el, parts, inHeaderRow);
      parts.push('</span>');
      break;
    }
    case 'del': {
      parts.push('<span class="doc-del">');
      walkDelChildren(el, parts, inHeaderRow);
      parts.push('</span>');
      break;
    }
    case 'moveFrom': {
      parts.push('<span class="doc-move-from">');
      walkDelChildren(el, parts, inHeaderRow);
      parts.push('</span>');
      break;
    }
    case 'moveTo': {
      parts.push('<span class="doc-move-to">');
      walkChildren(el, parts, inHeaderRow);
      parts.push('</span>');
      break;
    }
    case 'pPr':
    case 'rPr':
    case 'tblPr':
    case 'tblGrid':
    case 'trPr':
    case 'tcPr':
    case 'sectPr': {
      // Skip property elements
      break;
    }
    default: {
      // Recurse into unknown containers
      walkChildren(el, parts, inHeaderRow);
      break;
    }
  }
}

/**
 * Walk children inside w:del / w:moveFrom where text is in w:delText.
 */
function walkDelChildren(parent: Node, parts: string[], inHeaderRow: boolean): void {
  const children = parent.childNodes;
  if (!children) return;
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const localTag = el.localName ?? el.nodeName?.split(':').pop() ?? '';
    if (localTag === 'delText') {
      parts.push(escapeForHtml(el.textContent ?? ''));
    } else if (localTag === 'r') {
      // Walk into run, handle delText inside
      walkDelChildren(el, parts, inHeaderRow);
    } else {
      walkElement(el, parts, inHeaderRow);
    }
  }
}

/**
 * Detect heading level from paragraph properties (w:pStyle or w:sz).
 */
function detectHeading(pEl: Element): 'h1' | 'h2' | null {
  const pPr = getFirstChild(pEl, 'pPr');
  if (!pPr) return null;

  const pStyle = getFirstChild(pPr, 'pStyle');
  if (pStyle) {
    const val = pStyle.getAttribute('w:val') ?? '';
    if (/^Heading1$/i.test(val) || /^Title$/i.test(val)) return 'h1';
    if (/^Heading2$/i.test(val) || /^Subtitle$/i.test(val)) return 'h2';
  }

  // Fall back to font size heuristic
  const rPr = getFirstChild(pPr, 'rPr');
  if (rPr) {
    const sz = getFirstChild(rPr, 'sz');
    if (sz) {
      const sizeVal = parseInt(sz.getAttribute('w:val') ?? '0', 10);
      if (sizeVal >= 36) return 'h1'; // 18pt+
      if (sizeVal >= 28) return 'h2'; // 14pt+
    }
  }

  return null;
}

/**
 * Detect inline run styles (bold, italic, color).
 */
function detectRunStyle(rEl: Element): string | null {
  const rPr = getFirstChild(rEl, 'rPr');
  if (!rPr) return null;

  const styles: string[] = [];
  if (getFirstChild(rPr, 'b')) styles.push('font-weight:bold');
  if (getFirstChild(rPr, 'i')) styles.push('font-style:italic');
  const color = getFirstChild(rPr, 'color');
  if (color) {
    const val = color.getAttribute('w:val');
    if (val && val !== 'auto') styles.push(`color:#${val}`);
  }

  return styles.length > 0 ? styles.join(';') : null;
}

function getFirstChild(parent: Element, localName: string): Element | null {
  const children = parent.childNodes;
  if (!children) return null;
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tag = el.localName ?? el.nodeName?.split(':').pop() ?? '';
    if (tag === localName) return el;
  }
  return null;
}

function hasChildTag(parent: Element, prName: string, childName: string): boolean {
  const pr = getFirstChild(parent, prName);
  if (!pr) return false;
  return getFirstChild(pr, childName) !== null;
}

// ── compareChecklistDocx ────────────────────────────────────────────────────

/**
 * Compare two checklist DOCX buffers using the atomizer engine.
 * Returns a redline DOCX with tracked changes.
 */
export async function compareChecklistDocx(
  before: Buffer,
  after: Buffer,
): Promise<Buffer> {
  const result = await compareDocuments(before, after, {
    engine: 'atomizer',
    author: 'Checklist Patch',
    reconstructionMode: 'inplace',
  });

  if (
    result.reconstructionModeRequested === 'inplace' &&
    result.reconstructionModeUsed === 'rebuild'
  ) {
    console.warn(
      '[docx-evidence] inplace reconstruction fell back to rebuild:',
      result.fallbackReason,
    );
  }

  return result.document;
}

// ── Allure convenience functions ────────────────────────────────────────────

const HTML_CONTENT_TYPE = 'text/html';

/**
 * Render a checklist DOCX buffer to HTML and attach as an Allure evidence.
 */
export async function attachChecklistDocxPreview(
  name: string,
  buffer: Buffer,
  options?: { title?: string },
): Promise<void> {
  const html = docxToHtml(buffer);
  const body = [
    '<section class="doc-panel">',
    options?.title ? `<h2 class="doc-title">${escapeForHtml(options.title)}</h2>` : '',
    `<div class="doc-text">${html}</div>`,
    '</section>',
  ].join('');
  await allureAttachment(name, buildHtmlAttachment(body), HTML_CONTENT_TYPE);
}

/**
 * Compare two checklist DOCX buffers and attach before / after / redline
 * evidence to the current Allure test.
 */
export async function attachChecklistRedline(
  name: string,
  before: Buffer,
  after: Buffer,
  options?: { title?: string },
): Promise<void> {
  const redlineDocx = await compareChecklistDocx(before, after);
  const html = docxToHtml(redlineDocx);
  const body = [
    '<section class="doc-panel">',
    options?.title ? `<h2 class="doc-title">${escapeForHtml(options.title)}</h2>` : '',
    `<div class="doc-text">${html}</div>`,
    '</section>',
  ].join('');
  await allureAttachment(name, buildHtmlAttachment(body), HTML_CONTENT_TYPE);
}
