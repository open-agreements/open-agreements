import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import { resolveNumberingSnapshots } from './numbering-counters.js';
import { materializeNumberingReferences } from './numbering-render-references.js';
import { applyNonbreakingHyphenFont, hasNonbreakingHyphen, validateNonbreakingHyphenFont, type GlyphFallbackReceipt } from './nonbreaking-hyphen-font.js';
import { enumerateTextParts, getAllTextPartNames } from './ooxml-parts.js';
import { applyStyleSeparatorSpacing, type StyleSeparatorSpacingOptions, type StyleSeparatorSpacingReceipt } from './style-separator-spacing.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export interface NumberingRenderCopyResult {
  renderOnly: true;
  inputSha256: string;
  outputSha256: string;
  outputPath: string;
  paragraphs: number;
  references: number;
  glyphFallback?: GlyphFallbackReceipt;
  styleSeparatorSpacing?: StyleSeparatorSpacingReceipt;
}

export interface NumberingRenderCopyOptions {
  nonbreakingHyphenFont?: string;
  styleSeparatorSpacing?: StyleSeparatorSpacingOptions;
}

function direct(parent: XmlElement, local: string): XmlElement | undefined {
  return Array.from(parent.childNodes).find((node) => node.nodeType === 1
    && (node as XmlElement).namespaceURI === W && (node as XmlElement).localName === local) as XmlElement | undefined;
}

/**
 * Create a disposable PDF-rendering input, NEVER an editable deliverable.
 * LibreOffice splits counters around Word style separators even with explicit
 * shared numIds. Snapshot each effective counter tuple only in this copy; the
 * original DOCX retains its automatic numbering and exact original bytes.
 */
export function createNumberingRenderCopy(inputPath: string, outputPath: string, options: NumberingRenderCopyOptions = {}): NumberingRenderCopyResult {
  if (options.nonbreakingHyphenFont !== undefined) validateNonbreakingHyphenFont(options.nonbreakingHyphenFont);
  const input = realpathSync(inputPath);
  const output = resolve(outputPath);
  if (input === output || !output.endsWith('.render.docx') || input.endsWith('.render.docx')) {
    throw new Error('render-copy requires an original DOCX and a distinct, new *.render.docx output');
  }
  const original = readFileSync(input);
  const inputSha256 = hash(original);
  const zip = new AdmZip(original);
  const documentEntry = zip.getEntry('word/document.xml');
  if (!documentEntry) throw new Error('render-copy: missing Word document part');
  const numberingEntry = zip.getEntry('word/numbering.xml');
  let paragraphs = 0;
  const parser = new DOMParser({ onError: (level, message) => {
    if (level !== 'warning') throw new Error(`render-copy: ${message}`);
  } });
  const document = parser.parseFromString(documentEntry.getData().toString('utf8'), 'text/xml');
  if (options.nonbreakingHyphenFont !== undefined) {
    for (const name of getAllTextPartNames(enumerateTextParts(zip)).filter(name => name !== 'word/document.xml')) {
      if (hasNonbreakingHyphen(parser.parseFromString(zip.readAsText(name), 'text/xml'))) {
        throw new Error(`render-copy: nonbreaking hyphens in ${name} are unsupported`);
      }
    }
  }
  const numbering = parser.parseFromString(numberingEntry?.getData().toString('utf8') ?? `<w:numbering xmlns:w="${W}"/>`, 'text/xml');
  const stylesEntry = zip.getEntry('word/styles.xml');
  const styles = stylesEntry ? parser.parseFromString(stylesEntry.getData().toString('utf8'), 'text/xml') : undefined;
  const styleSeparatorSpacing = options.styleSeparatorSpacing === undefined ? undefined
    : applyStyleSeparatorSpacing(zip, document, styles, options.styleSeparatorSpacing);
  const snapshots = resolveNumberingSnapshots(document, styles, numbering);
  // Choice and Fallback are mutually exclusive renderer branches. Walking both
  // would consume phantom counters or combine incompatible field instructions.
  // Until capability negotiation is implemented, reject affected alternatives.
  for (const alternate of Array.from(document.getElementsByTagNameNS(MC, 'AlternateContent'))) {
    const numbered = snapshots.some((snapshot) => {
      for (let node = snapshot.paragraph.parentNode; node; node = node.parentNode) if (node === alternate) return true;
      return false;
    });
    const instructions = Array.from(alternate.getElementsByTagNameNS(W, 'instrText')).map((node) => node.textContent ?? '').join('')
      + '\n' + Array.from(alternate.getElementsByTagNameNS(W, 'fldSimple')).map((node) => node.getAttributeNS(W, 'instr') ?? '').join('\n');
    if (numbered || /\bREF\s/i.test(instructions)) {
      throw new Error('render-copy: numbering or references in AlternateContent are unsupported');
    }
  }
  // Other Word stories have independent list scope. Never count a textbox
  // inside the main story or silently leave a numbered header unprocessed.
  for (const snapshot of snapshots) {
    for (let ancestor = snapshot.paragraph.parentNode; ancestor; ancestor = ancestor.parentNode) {
      if (ancestor.nodeType === 1 && (ancestor as XmlElement).namespaceURI === W
        && (ancestor as XmlElement).localName === 'txbxContent') {
        throw new Error('render-copy: numbered textbox stories are unsupported');
      }
    }
  }
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith('word/') || !entry.entryName.endsWith('.xml')
      || ['word/document.xml', 'word/numbering.xml', 'word/styles.xml'].includes(entry.entryName)) continue;
    const story = parser.parseFromString(entry.getData().toString('utf8'), 'text/xml');
    const root = story.documentElement;
    if (options.nonbreakingHyphenFont !== undefined && hasNonbreakingHyphen(story)) {
      throw new Error(`render-copy: nonbreaking hyphens in ${entry.entryName} are unsupported`);
    }
    if (!root || root.namespaceURI !== W || !['hdr', 'ftr', 'footnotes', 'endnotes', 'comments'].includes(root.localName ?? '')) continue;
    const instruction = Array.from(story.getElementsByTagNameNS(W, 'p')).map((paragraph) =>
      Array.from(paragraph.getElementsByTagNameNS(W, 'instrText')).map((node) => node.textContent ?? '').join('')).join('\n')
      + '\n' + Array.from(story.getElementsByTagNameNS(W, 'fldSimple')).map((node) => node.getAttributeNS(W, 'instr') ?? '').join('\n');
    if (resolveNumberingSnapshots(story, styles, numbering).length > 0 || /\bREF\s/i.test(instruction)) {
      throw new Error(`render-copy: numbering or references in ${entry.entryName} are unsupported`);
    }
  }
  const references = materializeNumberingReferences(document, snapshots, styles);
  const glyphFallback = options.nonbreakingHyphenFont === undefined ? undefined
    : applyNonbreakingHyphenFont(document, options.nonbreakingHyphenFont);
  let abstractId = Math.max(0, ...Array.from(numbering.getElementsByTagNameNS(W, 'abstractNum'))
    .map((node) => Number(node.getAttributeNS(W, 'abstractNumId'))));
  let numId = Math.max(0, ...Array.from(numbering.getElementsByTagNameNS(W, 'num'))
    .map((node) => Number(node.getAttributeNS(W, 'numId'))));
  if (!Number.isSafeInteger(abstractId) || !Number.isSafeInteger(numId)) throw new Error('render-copy: invalid numbering IDs');
  if (abstractId > Number.MAX_SAFE_INTEGER - snapshots.length || numId > Number.MAX_SAFE_INTEGER - snapshots.length) {
    throw new Error('render-copy: numbering ID overflow');
  }
  const usedNsids = new Set(Array.from(numbering.getElementsByTagNameNS(W, 'nsid'))
    .map((node) => (node.getAttributeNS(W, 'val') ?? '').toUpperCase()));
  const firstNumber = direct(numbering.documentElement!, 'num');
  const numberingTail = direct(numbering.documentElement!, 'numIdMacAtCleanup');
  for (const snapshot of snapshots) {
    const abstract = numbering.importNode(snapshot.effectiveAbstract, true) as XmlElement;
    const id = String(++abstractId);
    abstract.setAttributeNS(W, 'w:abstractNumId', id);
    let nsid = direct(abstract, 'nsid');
    if (!nsid) { nsid = numbering.createElementNS(W, 'w:nsid'); abstract.insertBefore(nsid, abstract.firstChild); }
    let salt = 0;
    let identity: string;
    do {
      identity = createHash('sha256').update(`${inputSha256}:${id}:${salt++}`).digest('hex').slice(0, 8).toUpperCase();
    } while (usedNsids.has(identity));
    usedNsids.add(identity);
    nsid.setAttributeNS(W, 'w:val', identity);
    // Do not let renderer-global heading-style associations override the
    // explicit per-paragraph snapshot. Fonts/indents and list glyphs remain.
    for (const style of Array.from(abstract.getElementsByTagNameNS(W, 'pStyle'))) style.parentNode!.removeChild(style);
    for (const level of Array.from(abstract.getElementsByTagNameNS(W, 'lvl'))) {
      const index = Number(level.getAttributeNS(W, 'ilvl'));
      let start = direct(level, 'start');
      if (!start) { start = numbering.createElementNS(W, 'w:start'); level.insertBefore(start, level.firstChild); }
      start.setAttributeNS(W, 'w:val', String(snapshot.counters[index]));
    }
    // CT_Numbering requires every abstractNum before any concrete num.
    numbering.documentElement!.insertBefore(abstract, firstNumber ?? numberingTail ?? null);
    const number = numbering.createElementNS(W, 'w:num');
    const concreteId = String(++numId);
    number.setAttributeNS(W, 'w:numId', concreteId);
    const link = numbering.createElementNS(W, 'w:abstractNumId');
    link.setAttributeNS(W, 'w:val', id);
    number.appendChild(link);
    numbering.documentElement!.insertBefore(number, numberingTail ?? null);
    let properties = direct(snapshot.paragraph, 'pPr');
    if (!properties) {
      properties = document.createElementNS(W, 'w:pPr');
      snapshot.paragraph.insertBefore(properties, snapshot.paragraph.firstChild);
    }
    let numPr = direct(properties, 'numPr');
    if (!numPr) {
      numPr = document.createElementNS(W, 'w:numPr');
      const before = Array.from(properties.childNodes).find((node) => node.nodeType === 1
        && !['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl'].includes((node as XmlElement).localName ?? ''));
      properties.insertBefore(numPr, before ?? null);
    }
    for (const [local, value] of [['ilvl', String(snapshot.ilvl)], ['numId', concreteId]]) {
      let node = direct(numPr, local);
      if (!node) {
        node = document.createElementNS(W, `w:${local}`);
        if (local === 'ilvl') numPr.insertBefore(node, numPr.firstChild);
        else numPr.appendChild(node);
      }
      node.setAttributeNS(W, `w:val`, value);
    }
    paragraphs += 1;
  }
  const serializer = new XMLSerializer();
  if (numberingEntry || glyphFallback?.replacements || styleSeparatorSpacing?.replacements) {
    zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(document)));
  }
  if (numberingEntry) {
    zip.updateFile('word/numbering.xml', Buffer.from(serializer.serializeToString(numbering)));
  }
  if (hash(readFileSync(input)) !== inputSha256) throw new Error('render-copy: input changed during preparation');
  const bytes = zip.toBuffer();
  // Exclusive creation also rejects symlink/hardlink aliases and stale copies.
  writeFileSync(output, bytes, { flag: 'wx' });
  return { renderOnly: true, inputSha256, outputSha256: hash(bytes), outputPath: output, paragraphs, references,
    ...(glyphFallback ? { glyphFallback } : {}), ...(styleSeparatorSpacing ? { styleSeparatorSpacing } : {}) };
}
