import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import type { CleanConfig, GuidanceEntry, GuidanceOutput } from '../metadata.js';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface CleanResult {
  outputPath: string;
  guidance?: GuidanceOutput;
}

export interface CleanOptions {
  extractGuidance?: boolean;
  /** Pre-computed hashes for guidance staleness detection */
  sourceHash?: string;
  configHash?: string;
}

/**
 * Clean a DOCX document by removing footnotes, pattern-matched paragraphs,
 * and clearing specified parts.
 * Operates at the OOXML level to preserve formatting of retained content.
 *
 * Processes all general OOXML text parts (document, headers, footers, endnotes).
 * Footnotes.xml is handled separately with its separator/continuationSeparator logic.
 *
 * When options.extractGuidance is true, captures the text content of all
 * removed elements before deletion and returns them as structured guidance data.
 *
 * Note: Helpers use xmldom's own `Document`/`Element`/`Node` types to avoid
 * incompatibilities with the global DOM lib declarations.
 */
export async function cleanDocument(
  inputPath: string,
  outputPath: string,
  config: CleanConfig,
  options?: CleanOptions
): Promise<CleanResult> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const parts = enumerateTextParts(zip);
  const generalParts = getGeneralTextPartNames(parts);

  const extract = options?.extractGuidance ?? false;
  const entries: GuidanceEntry[] = [];
  let indexCounter = 0;

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

  // Collect footnote reference order from document.xml for proper ordering
  const footnoteRefOrder: string[] = [];
  if (config.removeFootnotes && extract) {
      const docEntry = zip.getEntry('word/document.xml');
    if (docEntry) {
      const docXml = docEntry.getData().toString('utf-8');
      const docDoc: Document = parser.parseFromString(docXml, 'text/xml');
      const refs = docDoc.getElementsByTagNameNS(W_NS, 'footnoteReference');
      for (let i = 0; i < refs.length; i++) {
        const id = refs[i].getAttributeNS(W_NS, 'id') ?? refs[i].getAttribute('w:id');
        if (id) footnoteRefOrder.push(id);
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
    const doc: Document = parser.parseFromString(xml, 'text/xml');
    let modified = false;

    if (config.removeFootnotes) {
      removeFootnoteReferences(doc);
      modified = true;
    }

    if (config.removeParagraphPatterns.length > 0) {
      if (extract) {
        const extracted = extractAndRemoveParagraphsByPattern(doc, config.removeParagraphPatterns);
        for (const text of extracted) {
          entries.push({ source: 'pattern', part: partName, index: indexCounter++, text });
        }
      } else {
        removeParagraphsByPattern(doc, config.removeParagraphPatterns);
      }
      modified = true;
    }

    if (config.removeRanges && config.removeRanges.length > 0) {
      if (extract) {
        const extracted = extractAndRemoveParagraphsByRange(doc, config.removeRanges);
        for (const group of extracted) {
          const groupId = `range-${indexCounter}`;
          for (const text of group) {
            entries.push({ source: 'range', part: partName, index: indexCounter++, text, groupId });
          }
        }
      } else {
        removeParagraphsByRange(doc, config.removeRanges);
      }
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
      const doc: Document = parser.parseFromString(xml, 'text/xml');

      if (extract) {
        const extracted = extractAndRemoveNormalFootnotes(doc, footnoteRefOrder);
        for (const text of extracted) {
          entries.push({ source: 'footnote', part: parts.footnotes, index: indexCounter++, text });
        }
      } else {
        removeNormalFootnotes(doc);
      }

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

  const result: CleanResult = { outputPath };
  if (extract) {
    result.guidance = {
      extractedFrom: {
        sourceHash: options?.sourceHash ?? '',
        configHash: options?.configHash ?? '',
      },
      entries,
    };
  }
  return result;
}

/**
 * Replace part content with a single empty paragraph, preserving the root element
 * and its namespace attributes.
 */
function clearPartContent(doc: Document): void {
  const root = doc.documentElement;
  if (!root) return;
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

function removeFootnoteReferences(doc: Document): void {
  const refs = doc.getElementsByTagNameNS(W_NS, 'footnoteReference');
  const runsToRemove: Element[] = [];

  for (let i = 0; i < refs.length; i++) {
    let node: Node | null = refs[i];
    while (node) {
      if (node.nodeType === 1) {
        const element = node as Element;
        if (element.localName === 'r' && element.namespaceURI === W_NS) {
          runsToRemove.push(element);
          break;
        }
      }
      node = node.parentNode;
    }
  }

  for (const run of runsToRemove) {
    run.parentNode?.removeChild(run);
  }
}

function removeNormalFootnotes(doc: Document): void {
  const footnotes = doc.getElementsByTagNameNS(W_NS, 'footnote');
  const toRemove: Element[] = [];

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

/** Extract text from footnotes ordered by reference occurrence, then remove them. */
function extractAndRemoveNormalFootnotes(doc: Document, refOrder: string[]): string[] {
  const footnotes = doc.getElementsByTagNameNS(W_NS, 'footnote');
  const fnMap = new Map<string, { node: Element; text: string }>();
  const toRemove: Element[] = [];

  for (let i = 0; i < footnotes.length; i++) {
    const fn = footnotes[i];
    const fnType = fn.getAttributeNS(W_NS, 'type');
    if (fnType !== 'separator' && fnType !== 'continuationSeparator') {
      const id = fn.getAttributeNS(W_NS, 'id') ?? fn.getAttribute('w:id') ?? '';
      const text = extractElementText(fn);
      fnMap.set(id, { node: fn, text });
      toRemove.push(fn);
    }
  }

  // Order by footnoteReference occurrence in document.xml
  const ordered: string[] = [];
  for (const id of refOrder) {
    const entry = fnMap.get(id);
    if (entry && entry.text) {
      ordered.push(entry.text);
      fnMap.delete(id);
    }
  }
  // Append any remaining footnotes not referenced (shouldn't happen normally)
  for (const entry of fnMap.values()) {
    if (entry.text) ordered.push(entry.text);
  }

  for (const fn of toRemove) {
    fn.parentNode?.removeChild(fn);
  }

  return ordered;
}

function removeParagraphsByPattern(doc: Document, patterns: string[]): void {
  const regexes = patterns.map((p) => new RegExp(p, 'i'));
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const toRemove: Element[] = [];

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

/** Extract text from pattern-matched paragraphs, then remove them. */
function extractAndRemoveParagraphsByPattern(doc: Document, patterns: string[]): string[] {
  const regexes = patterns.map((p) => new RegExp(p, 'i'));
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const toRemove: Element[] = [];
  const extracted: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = extractParagraphText(para);
    if (text && regexes.some((r) => r.test(text))) {
      toRemove.push(para);
      extracted.push(text);
    }
  }

  for (const para of toRemove) {
    para.parentNode?.removeChild(para);
  }

  return extracted;
}

function removeParagraphsByRange(
  doc: Document,
  ranges: Array<{ start: string; end: string }>
): void {
  for (const range of ranges) {
    const startRe = new RegExp(range.start, 'i');
    const endRe = new RegExp(range.end, 'i');
    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');

    const toRemove: Element[] = [];
    let inside = false;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = extractParagraphText(paragraphs[i]);
      if (!inside && text && startRe.test(text)) {
        inside = true;
      }
      if (inside) {
        toRemove.push(paragraphs[i]);
        if (text && endRe.test(text)) {
          inside = false;
        }
      }
    }

    for (const para of toRemove) {
      para.parentNode?.removeChild(para);
    }
  }
}

/** Extract text from range-deleted paragraphs, then remove them. Returns groups of text arrays. */
function extractAndRemoveParagraphsByRange(
  doc: Document,
  ranges: Array<{ start: string; end: string }>
): string[][] {
  const groups: string[][] = [];

  for (const range of ranges) {
    const startRe = new RegExp(range.start, 'i');
    const endRe = new RegExp(range.end, 'i');
    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');

    const toRemove: Element[] = [];
    const texts: string[] = [];
    let inside = false;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = extractParagraphText(paragraphs[i]);
      if (!inside && text && startRe.test(text)) {
        inside = true;
      }
      if (inside) {
        toRemove.push(paragraphs[i]);
        if (text) texts.push(text);
        if (text && endRe.test(text)) {
          // End of this range match — push group and continue scanning
          groups.push([...texts]);
          texts.length = 0;
          inside = false;
        }
      }
    }
    // If inside is still true (no end match), push remaining as a group
    if (texts.length > 0) {
      groups.push(texts);
    }

    for (const para of toRemove) {
      para.parentNode?.removeChild(para);
    }
  }

  return groups;
}

function extractParagraphText(para: Element): string {
  if (!para.getElementsByTagNameNS) return '';
  const textElements = para.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < textElements.length; i++) {
    parts.push(textElements[i].textContent ?? '');
  }
  return parts.join('').trim();
}

/** Extract all text from an element (used for footnotes which contain multiple paragraphs). */
function extractElementText(element: Element): string {
  if (!element.getElementsByTagNameNS) return '';
  const paragraphs = element.getElementsByTagNameNS(W_NS, 'p');
  const paraTexts: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const text = extractParagraphText(paragraphs[i]);
    if (text) paraTexts.push(text);
  }
  return paraTexts.join('\n');
}
