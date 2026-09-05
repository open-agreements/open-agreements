import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import type { CleanConfig, GuidanceEntry, GuidanceOutput } from '../metadata.js';
import { copyEntriesSkippingDirs, enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/**
 * Default size threshold for removeHeaderFooterDrawings, in bytes.
 *
 * Empirically calibrated against the bundled corpus (2026-08): the largest
 * benign header/footer media across all 187 bundled DOCX files is a 146-byte
 * spacer PNG (40 occurrences across 21 Common Paper templates), while the
 * known-bad artifact class — full-page "how to use this template" screenshots
 * from Google-Docs exports (legal-explainer#1800) — starts around 125 KB.
 * 50 KB sits comfortably between the two and matches legal-explainer's
 * source-side vendored-docx audit threshold.
 */
export const DEFAULT_HEADER_FOOTER_DRAWING_MIN_BYTES = 50 * 1024;

const HEADER_FOOTER_PART_PATTERN = /^word\/(?:header|footer)\d+\.xml$/;

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
  // Entries dropped entirely (orphaned media parts)
  const removedEntries = new Set<string>();
  // Media part names dereferenced by removed drawings (orphan candidates)
  const orphanMediaCandidates = new Set<string>();

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

    // Remove cover-page paragraphs before anchor pattern (document.xml only)
    if (config.removeBeforePattern && partName === 'word/document.xml') {
      if (extract) {
        const extracted = extractAndRemoveParagraphsBeforePattern(doc, config.removeBeforePattern);
        for (const text of extracted) {
          entries.push({ source: 'pattern', part: partName, index: indexCounter++, text });
        }
      } else {
        removeParagraphsBeforePattern(doc, config.removeBeforePattern);
      }
      modified = true;
    }

    if (config.removeFootnotes) {
      removeNoteReferences(doc);
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

    // Strip oversized drawings from header/footer parts (image-only content
    // invisible to text-anchored mechanisms — see legal-explainer#1800)
    if (config.removeHeaderFooterDrawings && HEADER_FOOTER_PART_PATTERN.test(partName)) {
      const minBytes = config.headerFooterDrawingMinBytes ?? DEFAULT_HEADER_FOOTER_DRAWING_MIN_BYTES;
      const result = removeOversizedDrawings(doc, zip, partName, minBytes, parser, serializer, modifiedParts);
      if (result.removedDrawings > 0) {
        modified = true;
        for (const media of result.orphanMediaCandidates) {
          orphanMediaCandidates.add(media);
        }
      }
    }

    // Post-clean pass: drop empty leading body paragraphs, transplanting any
    // section-break header/footer references forward (document.xml only)
    if (config.removeEmptyLeadingParagraphs && partName === 'word/document.xml') {
      if (removeEmptyLeadingParagraphs(doc)) {
        modified = true;
      }
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

  // Drop media parts orphaned by drawing removal (only when no relationship
  // in the final package state still targets them)
  if (orphanMediaCandidates.size > 0) {
    for (const media of orphanMediaCandidates) {
      if (!isMediaReferenced(zip, media, modifiedParts)) {
        removedEntries.add(media);
      }
    }
  }

  // Rebuild the zip from scratch to avoid adm-zip data descriptor issues
  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip, (entryName, entryData) => {
    if (removedEntries.has(entryName)) return null;
    const data = modifiedParts.get(entryName) ?? entryData;
    return data;
  });
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

/**
 * Remove inline note markers without discarding other content that happens to
 * share their run. Word commonly gives a reference its own styled run, but
 * producers are allowed to place text and a reference in the same run.
 */
function removeNoteReferences(doc: Document): void {
  const refs: Element[] = [];
  for (const localName of ['footnoteReference', 'endnoteReference']) {
    const matches = doc.getElementsByTagNameNS(W_NS, localName);
    for (let i = 0; i < matches.length; i++) refs.push(matches[i]);
  }

  const affectedRuns = new Set<Element>();
  for (const ref of refs) {
    let node: Node | null = ref.parentNode;
    while (node) {
      if (node.nodeType === 1) {
        const element = node as Element;
        if (element.localName === 'r' && element.namespaceURI === W_NS) {
          affectedRuns.add(element);
          break;
        }
      }
      node = node.parentNode;
    }
    ref.parentNode?.removeChild(ref);
  }

  // A reference-only run now contains, at most, its run properties. Drop that
  // structural shell; preserve runs with text, tabs, drawings, or other OOXML.
  for (const run of affectedRuns) {
    let hasContent = false;
    for (let child = run.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) {
        const element = child as Element;
        if (!(element.namespaceURI === W_NS && element.localName === 'rPr')) {
          hasContent = true;
          break;
        }
      } else if (child.nodeType === 3 && (child.nodeValue ?? '').trim() !== '') {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) run.parentNode?.removeChild(run);
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

/**
 * Remove all paragraphs from the start of <w:body> up to (but not including) the first
 * paragraph whose text matches the given regex pattern. No-op if no match is found.
 */
function removeParagraphsBeforePattern(doc: Document, pattern: string): void {
  const regex = new RegExp(pattern);
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return;

  const paragraphs = body.getElementsByTagNameNS(W_NS, 'p');
  const toRemove: Element[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    // Only consider direct children of <w:body>
    if (para.parentNode !== body) continue;
    const text = extractParagraphText(para);
    if (regex.test(text)) {
      // Found the anchor — stop collecting
      break;
    }
    toRemove.push(para);
  }

  // Only remove if we found the anchor (i.e., we didn't exhaust all paragraphs)
  if (toRemove.length === 0) return;
  // Verify anchor was actually found by checking we didn't collect all body paragraphs
  const bodyParas: Element[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].parentNode === body) bodyParas.push(paragraphs[i]);
  }
  if (toRemove.length >= bodyParas.length) return; // No anchor found — no-op

  for (const para of toRemove) {
    para.parentNode?.removeChild(para);
  }
}

/** Extract text from paragraphs before anchor pattern, then remove them. */
function extractAndRemoveParagraphsBeforePattern(doc: Document, pattern: string): string[] {
  const regex = new RegExp(pattern);
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return [];

  const paragraphs = body.getElementsByTagNameNS(W_NS, 'p');
  const toRemove: Element[] = [];
  const extracted: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (para.parentNode !== body) continue;
    const text = extractParagraphText(para);
    if (regex.test(text)) {
      break;
    }
    toRemove.push(para);
    if (text) extracted.push(text);
  }

  const bodyParas: Element[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].parentNode === body) bodyParas.push(paragraphs[i]);
  }
  if (toRemove.length >= bodyParas.length) return [];

  for (const para of toRemove) {
    para.parentNode?.removeChild(para);
  }

  return extracted;
}

// ---------------------------------------------------------------------------
// Header/footer drawing removal (removeHeaderFooterDrawings)
// ---------------------------------------------------------------------------

interface DrawingRemovalOutcome {
  removedDrawings: number;
  /** Resolved media part names dereferenced by removed drawings. */
  orphanMediaCandidates: string[];
}

/**
 * Resolve an OPC relationship Target against the directory of the part that
 * owns the .rels file (e.g. "media/image1.png" in word/_rels/header1.xml.rels
 * resolves to "word/media/image1.png").
 */
function resolveRelTarget(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  return posix.normalize(posix.join(baseDir, target));
}

/** Collect the values of all attributes in the relationships namespace (r:embed, r:id, r:link, ...). */
function collectRelationshipIdAttrs(element: Element, ids: Set<string>): void {
  const attrs = element.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs.item(i);
      if (attr && attr.namespaceURI === R_NS && attr.value) {
        ids.add(attr.value);
      }
    }
  }
  for (let child: Node | null = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) collectRelationshipIdAttrs(child as Element, ids);
  }
}

/** Find the nearest ancestor <w:r> run of an element, if any. */
function findAncestorRun(element: Element): Element | null {
  let node: Node | null = element;
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.localName === 'r' && el.namespaceURI === W_NS) return el;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * Remove <w:drawing>/<w:pict> elements (with their containing <w:r> run) from a
 * header/footer part when the largest media part they reference exceeds
 * `minBytes`. Also removes relationships that become orphaned in the part's
 * .rels file, writing the updated rels into `modifiedParts`.
 *
 * Drawings whose referenced media is at or below the threshold — or that
 * reference no media at all (vector shapes, external links) — are preserved.
 */
function removeOversizedDrawings(
  doc: Document,
  zip: AdmZip,
  partName: string,
  minBytes: number,
  parser: DOMParser,
  serializer: XMLSerializer,
  modifiedParts: Map<string, Buffer>,
): DrawingRemovalOutcome {
  const partFile = partName.split('/').pop() ?? '';
  const relsName = `word/_rels/${partFile}.rels`;

  // Build relId → { target, size } from the part's rels (respecting any
  // earlier in-process modification of the rels part)
  const relsBuffer = modifiedParts.get(relsName) ?? zip.getEntry(relsName)?.getData();
  const relTargets = new Map<string, string>(); // relId → resolved internal target
  const relSizes = new Map<string, number>();
  let relsDoc: Document | null = null;
  if (relsBuffer) {
    relsDoc = parser.parseFromString(relsBuffer.toString('utf-8'), 'text/xml');
    const rels = relsDoc.getElementsByTagNameNS(PKG_REL_NS, 'Relationship');
    for (let i = 0; i < rels.length; i++) {
      const rel = rels[i];
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (!id || !target) continue;
      if ((rel.getAttribute('TargetMode') ?? 'Internal') === 'External') continue;
      const resolved = resolveRelTarget('word', target);
      relTargets.set(id, resolved);
      const entry = zip.getEntry(resolved);
      relSizes.set(id, entry ? entry.getData().length : 0);
    }
  }

  // Collect drawing/pict elements up front (snapshot before mutation)
  const drawingEls: Element[] = [];
  for (const localName of ['drawing', 'pict']) {
    const found = doc.getElementsByTagNameNS(W_NS, localName);
    for (let i = 0; i < found.length; i++) drawingEls.push(found[i]);
  }

  let removedDrawings = 0;
  const removedRelIds = new Set<string>();
  for (const el of drawingEls) {
    const ids = new Set<string>();
    collectRelationshipIdAttrs(el, ids);
    let maxSize = 0;
    for (const id of ids) {
      maxSize = Math.max(maxSize, relSizes.get(id) ?? 0);
    }
    if (maxSize <= minBytes) continue; // benign spacer / vector shape — keep

    const container = findAncestorRun(el) ?? el;
    container.parentNode?.removeChild(container);
    removedDrawings++;
    for (const id of ids) removedRelIds.add(id);
  }

  if (removedDrawings === 0) return { removedDrawings: 0, orphanMediaCandidates: [] };

  // A removed rel id may still be referenced by a surviving element in this part
  const remainingIds = new Set<string>();
  if (doc.documentElement) collectRelationshipIdAttrs(doc.documentElement, remainingIds);

  const orphanMediaCandidates: string[] = [];
  if (relsDoc) {
    let relsModified = false;
    const rels = relsDoc.getElementsByTagNameNS(PKG_REL_NS, 'Relationship');
    const toRemove: Element[] = [];
    for (let i = 0; i < rels.length; i++) {
      const id = rels[i].getAttribute('Id');
      if (id && removedRelIds.has(id) && !remainingIds.has(id)) {
        toRemove.push(rels[i]);
        const target = relTargets.get(id);
        if (target) orphanMediaCandidates.push(target);
      }
    }
    for (const rel of toRemove) {
      rel.parentNode?.removeChild(rel);
      relsModified = true;
    }
    if (relsModified) {
      modifiedParts.set(relsName, Buffer.from(serializer.serializeToString(relsDoc), 'utf-8'));
    }
  }

  return { removedDrawings, orphanMediaCandidates };
}

/**
 * Whether any relationship in the package (respecting in-process modifications)
 * still targets the given media part.
 */
function isMediaReferenced(
  zip: AdmZip,
  mediaPartName: string,
  modifiedParts: Map<string, Buffer>,
): boolean {
  const parser = new DOMParser();
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.endsWith('.rels')) continue;
    // Base dir of the part that owns this rels file: "<dir>/_rels/<file>.rels" → "<dir>"
    const relsDir = posix.dirname(entry.entryName); // "<dir>/_rels" or "_rels"
    const baseDir = posix.dirname(relsDir) === '.' ? '' : posix.dirname(relsDir);
    const buffer = modifiedParts.get(entry.entryName) ?? entry.getData();
    const relsDoc = parser.parseFromString(buffer.toString('utf-8'), 'text/xml');
    const rels = relsDoc.getElementsByTagNameNS(PKG_REL_NS, 'Relationship');
    for (let i = 0; i < rels.length; i++) {
      const target = rels[i].getAttribute('Target');
      if (!target) continue;
      if ((rels[i].getAttribute('TargetMode') ?? 'Internal') === 'External') continue;
      if (resolveRelTarget(baseDir, target) === mediaPartName) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Empty leading paragraph removal (removeEmptyLeadingParagraphs)
// ---------------------------------------------------------------------------

/**
 * Whether a paragraph carries no visible content: no non-whitespace text and no
 * drawing/picture/embedded-object. A paragraph holding only formatting, a
 * section break (<w:sectPr>), or a page break counts as empty; a logo or other
 * image-bearing paragraph does not.
 */
export function isParagraphContentEmpty(para: Element): boolean {
  if (!para.getElementsByTagNameNS) return true;
  if (extractParagraphText(para) !== '') return false;
  for (const localName of ['drawing', 'pict', 'object']) {
    if (para.getElementsByTagNameNS(W_NS, localName).length > 0) return false;
  }
  return true;
}

/** The <w:sectPr> directly under a paragraph's <w:pPr>, if present. */
function getDirectSectPr(para: Element): Element | null {
  for (let child: Node | null = para.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    if (el.localName !== 'pPr' || el.namespaceURI !== W_NS) continue;
    for (let sub: Node | null = el.firstChild; sub; sub = sub.nextSibling) {
      if (sub.nodeType !== 1) continue;
      const subEl = sub as Element;
      if (subEl.localName === 'sectPr' && subEl.namespaceURI === W_NS) return subEl;
    }
  }
  return null;
}

/** Direct-child header/footer references of a sectPr. */
function getHeaderFooterReferences(sectPr: Element): Element[] {
  const refs: Element[] = [];
  for (let child: Node | null = sectPr.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    if (
      el.namespaceURI === W_NS &&
      (el.localName === 'headerReference' || el.localName === 'footerReference')
    ) {
      refs.push(el);
    }
  }
  return refs;
}

/** The w:type of a header/footer reference (default | first | even), defaulting to "default". */
function getReferenceType(ref: Element): string {
  return ref.getAttributeNS(W_NS, 'type') ?? ref.getAttribute('w:type') ?? 'default';
}

/**
 * Remove leading empty paragraphs from <w:body> (post-clean pass).
 *
 * Stops at the first paragraph with visible content or the first non-paragraph
 * block element (table, sdt, ...). When a removed paragraph carries a
 * <w:sectPr> section break, the effective header/footer references of the
 * removed sections (accumulated in document order, mirroring OOXML section
 * inheritance) are transplanted onto the next surviving <w:sectPr> for each
 * reference slot (kind + w:type) it does not define itself — so downstream
 * sections that relied on inheriting the removed section's headers/footers
 * keep them.
 *
 * Returns true when at least one paragraph was removed.
 */
function removeEmptyLeadingParagraphs(doc: Document): boolean {
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return false;

  const toRemove: Element[] = [];
  for (let node: Node | null = body.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1) continue; // skip whitespace/comment nodes
    const el = node as Element;
    if (el.localName === 'p' && el.namespaceURI === W_NS && isParagraphContentEmpty(el)) {
      toRemove.push(el);
      continue;
    }
    break; // first content-bearing paragraph or non-paragraph block element
  }
  if (toRemove.length === 0) return false;

  // Never empty the body entirely: keep the last empty paragraph if removal
  // would leave no block content (only the body-level sectPr)
  let remainingBlocks = 0;
  for (let node: Node | null = body.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    if (el.localName === 'sectPr' && el.namespaceURI === W_NS) continue;
    remainingBlocks++;
  }
  while (toRemove.length > 0 && remainingBlocks - toRemove.length < 1) {
    toRemove.pop();
  }
  if (toRemove.length === 0) return false;

  // Accumulate effective header/footer references across removed section
  // breaks, in document order (later sections inherit from earlier ones, and a
  // later explicit reference overrides the inherited one for its slot)
  const effectiveRefs = new Map<string, Element>(); // "<kind>:<type>" → reference element
  for (const para of toRemove) {
    const sectPr = getDirectSectPr(para);
    if (!sectPr) continue;
    for (const ref of getHeaderFooterReferences(sectPr)) {
      effectiveRefs.set(`${ref.localName}:${getReferenceType(ref)}`, ref);
    }
  }

  for (const para of toRemove) {
    para.parentNode?.removeChild(para);
  }

  if (effectiveRefs.size > 0) {
    // The next section boundary in document order (a paragraph-level sectPr or
    // the body-level sectPr)
    const destSectPr = doc.getElementsByTagNameNS(W_NS, 'sectPr')[0];
    if (destSectPr) {
      const existingRefs = getHeaderFooterReferences(destSectPr);
      const existingSlots = new Set(
        existingRefs.map((ref) => `${ref.localName}:${getReferenceType(ref)}`),
      );
      const transplanted: Element[] = [];
      for (const [slot, ref] of effectiveRefs) {
        if (existingSlots.has(slot)) continue;
        transplanted.push(ref.cloneNode(true) as Element);
      }
      if (transplanted.length > 0) {
        // CT_SectPr is a sequence: headerReference* then footerReference* then
        // the remaining section properties. Detach the existing references,
        // merge with the transplanted ones, and re-insert in schema order
        // (existing before transplanted within each kind, order preserved).
        const merged = [...existingRefs, ...transplanted];
        const headers = merged.filter((ref) => ref.localName === 'headerReference');
        const footers = merged.filter((ref) => ref.localName === 'footerReference');
        for (const ref of existingRefs) {
          destSectPr.removeChild(ref);
        }
        const anchor = destSectPr.firstChild; // first non-reference child (or null → append)
        for (const ref of [...headers, ...footers]) {
          destSectPr.insertBefore(ref, anchor);
        }
      }
    }
  }

  return true;
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
