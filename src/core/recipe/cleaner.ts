import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { CleanConfig } from '../metadata.js';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Clean a DOCX document by removing footnotes, pattern-matched paragraphs,
 * and clearing specified parts.
 * Operates at the OOXML level to preserve formatting of retained content.
 *
 * Processes all general OOXML text parts (document, headers, footers, endnotes).
 * Footnotes.xml is handled separately with its separator/continuationSeparator logic.
 *
 * Note: Internal helpers use `any` for DOM nodes because @xmldom/xmldom's types
 * are incompatible with the global DOM types (missing EventTarget methods).
 */
export async function cleanDocument(
  inputPath: string,
  outputPath: string,
  config: CleanConfig
): Promise<string> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const parts = enumerateTextParts(zip);
  const generalParts = getGeneralTextPartNames(parts);

  // Track which parts we modify so we can rebuild the zip cleanly
  const modifiedParts = new Map<string, Buffer>();

  // Clear specified parts (replace content with minimal valid XML)
  if (config.clearParts && config.clearParts.length > 0) {
    for (const entry of zip.getEntries()) {
      const filename = entry.entryName.split('/').pop() ?? '';
      if (config.clearParts.includes(filename)) {
        const xml = entry.getData().toString('utf-8');
        const doc = parser.parseFromString(xml, 'text/xml');
        clearPartContent(doc);
        modifiedParts.set(entry.entryName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
      }
    }
  }

  // Clean all general text parts (document, headers, footers, endnotes)
  for (const partName of generalParts) {
    // Skip parts already cleared
    if (modifiedParts.has(partName)) continue;

    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');
    let modified = false;

    if (config.removeFootnotes) {
      removeFootnoteReferences(doc);
      modified = true;
    }

    if (config.removeParagraphPatterns.length > 0) {
      removeParagraphsByPattern(doc, config.removeParagraphPatterns);
      modified = true;
    }

    if (config.removeRanges && config.removeRanges.length > 0) {
      removeParagraphsByRange(doc, config.removeRanges);
      modified = true;
    }

    if (modified) {
      modifiedParts.set(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
    }
  }

  // Clean footnotes.xml separately (has separator/continuationSeparator logic)
  if (config.removeFootnotes && parts.footnotes && !modifiedParts.has(parts.footnotes)) {
    const footnotesEntry = zip.getEntry(parts.footnotes);
    if (footnotesEntry) {
      const xml = footnotesEntry.getData().toString('utf-8');
      const doc = parser.parseFromString(xml, 'text/xml');
      removeNormalFootnotes(doc);
      modifiedParts.set(parts.footnotes, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
    }
  }

  // Rebuild the zip from scratch to avoid adm-zip data descriptor issues
  const outZip = new AdmZip();
  for (const entry of zip.getEntries()) {
    const data = modifiedParts.get(entry.entryName) ?? entry.getData();
    outZip.addFile(entry.entryName, data);
  }
  writeFileSync(outputPath, outZip.toBuffer());
  return outputPath;
}

/* eslint-disable @typescript-eslint/no-explicit-any --
   @xmldom/xmldom types are incompatible with global DOM types */

/**
 * Replace part content with a single empty paragraph, preserving the root element
 * and its namespace attributes.
 */
function clearPartContent(doc: any): void {
  const root = doc.documentElement;
  // Remove all children
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }
  // Add a minimal empty paragraph
  const p = doc.createElementNS(W_NS, 'w:p');
  const pPr = doc.createElementNS(W_NS, 'w:pPr');
  p.appendChild(pPr);
  root.appendChild(p);
}

function removeFootnoteReferences(doc: any): void {
  const refs = doc.getElementsByTagNameNS(W_NS, 'footnoteReference');
  const runsToRemove: any[] = [];

  for (let i = 0; i < refs.length; i++) {
    let node: any = refs[i];
    while (node && !(node.localName === 'r' && node.namespaceURI === W_NS)) {
      node = node.parentNode;
    }
    if (node) {
      runsToRemove.push(node);
    }
  }

  for (const run of runsToRemove) {
    run.parentNode?.removeChild(run);
  }
}

function removeNormalFootnotes(doc: any): void {
  const footnotes = doc.getElementsByTagNameNS(W_NS, 'footnote');
  const toRemove: any[] = [];

  for (let i = 0; i < footnotes.length; i++) {
    const fn = footnotes[i];
    const fnType = fn.getAttributeNS(W_NS, 'type');
    if (fnType !== 'separator' && fnType !== 'continuationSeparator') {
      toRemove.push(fn);
    }
  }

  for (const fn of toRemove) {
    fn.parentNode?.removeChild(fn);
  }
}

function removeParagraphsByPattern(doc: any, patterns: string[]): void {
  const regexes = patterns.map((p) => new RegExp(p, 'i'));
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const toRemove: any[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = extractParagraphText(para);
    if (text && regexes.some((r) => r.test(text))) {
      toRemove.push(para);
    }
  }

  for (const para of toRemove) {
    para.parentNode?.removeChild(para);
  }
}

function removeParagraphsByRange(
  doc: any,
  ranges: Array<{ start: string; end: string }>
): void {
  for (const range of ranges) {
    const startRe = new RegExp(range.start, 'i');
    const endRe = new RegExp(range.end, 'i');
    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');

    const toRemove: any[] = [];
    let inside = false;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = extractParagraphText(paragraphs[i]);
      if (!inside && text && startRe.test(text)) {
        inside = true;
      }
      if (inside) {
        toRemove.push(paragraphs[i]);
        if (text && endRe.test(text)) {
          break;
        }
      }
    }

    for (const para of toRemove) {
      para.parentNode?.removeChild(para);
    }
  }
}

function extractParagraphText(para: any): string {
  if (!para.getElementsByTagNameNS) return '';
  const textElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < textElements.length; i++) {
    parts.push(textElements[i].textContent ?? '');
  }
  return parts.join('').trim();
}
