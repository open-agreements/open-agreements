import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element, Node } from '@xmldom/xmldom';
import { writeFileSync } from 'node:fs';
import { getParagraphText } from '@usejunior/docx-core';
import { copyEntriesSkippingDirs } from './ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function paragraphStyle(para: Element): string | null {
  const styles = para.getElementsByTagNameNS(W_NS, 'pStyle');
  if (styles.length === 0) return null;
  return styles[0].getAttributeNS(W_NS, 'val') || styles[0].getAttribute('w:val');
}

function matchingSplitHeadingStyles(heading: Element, continuation: Element): boolean {
  const headingMatch = /^Heading(\d+)$/.exec(paragraphStyle(heading) ?? '');
  const continuationMatch = /^HeadingPara(\d+)$/.exec(paragraphStyle(continuation) ?? '');
  return headingMatch !== null && continuationMatch !== null && headingMatch[1] === continuationMatch[1];
}

function directElementChildren(node: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i] as Node;
    if (child.nodeType === 1) result.push(child as Element);
  }
  return result;
}

function child(parent: Element | undefined, name: string): Element | undefined {
  return parent && directElementChildren(parent).find(node => node.namespaceURI === W_NS && node.localName === name);
}

function inheritedProperty(paragraph: Element, styles: Element | undefined, name: string, mark: boolean): Element | null | undefined {
  const properties = child(paragraph, 'pPr');
  const own = child(mark ? child(properties, 'rPr') : properties, name);
  if (own) return own;
  let id = child(properties, 'pStyle')?.getAttributeNS(W_NS, 'val');
  const seen = new Set<string>();
  while (id && styles) {
    if (seen.has(id)) return undefined;
    seen.add(id);
    const matches = directElementChildren(styles).filter(node => node.localName === 'style' && node.namespaceURI === W_NS && node.getAttributeNS(W_NS, 'styleId') === id);
    if (matches.length !== 1) return undefined;
    const style = matches[0], pPr = child(style, 'pPr');
    const found = mark ? child(child(pPr, 'rPr'), name) ?? child(child(style, 'rPr'), name) : child(pPr, name);
    // Style-level hidden formatting has toggle semantics: style false does
    // not necessarily cancel inherited hiding. This narrow join deliberately
    // declines inherited hidden declarations rather than implementing a full
    // style cascade. A direct paragraph-mark false above remains absolute.
    // https://learn.microsoft.com/en-us/office/open-xml/word/how-to-remove-hidden-text-from-a-word-processing-document
    if (found) return mark ? undefined : found;
    id = child(style, 'basedOn')?.getAttributeNS(W_NS, 'val');
  }
  const defaults = child(styles, 'docDefaults');
  const inherited = child(child(child(defaults, mark ? 'rPrDefault' : 'pPrDefault'), mark ? 'rPr' : 'pPr'), name);
  return inherited ? (mark ? undefined : inherited) : null;
}

function flag(property: Element | null | undefined): boolean | undefined {
  if (property === undefined) return undefined;
  if (property === null) return false;
  const value = property.getAttributeNS(W_NS, 'val');
  if (!value || ['1', 'true', 'on'].includes(value)) return true;
  if (['0', 'false', 'off'].includes(value)) return false;
  return undefined;
}

function safeVisibleCarrier(paragraph: Element, styles: Element | undefined): boolean {
  const pPr = child(paragraph, 'pPr');
  // These are the only carrier properties currently preserved by this narrow
  // punctuation join. Do not erase structural/layout/revision properties.
  if (pPr && directElementChildren(pPr).some(node => node.namespaceURI !== W_NS || !['pStyle', 'keepNext', 'widowControl', 'rPr'].includes(node.localName ?? ''))) return false;
  if (['rPrChange', 'del', 'ins', 'moveFrom', 'moveTo', 'rStyle'].some(name => pPr?.getElementsByTagNameNS(W_NS, name).length)) return false;
  if (inheritedProperty(paragraph, styles, 'framePr', false) !== null) return false;
  if (flag(inheritedProperty(paragraph, styles, 'pageBreakBefore', false)) !== false) return false;
  return ['vanish', 'specVanish'].every(name => flag(inheritedProperty(paragraph, styles, name, true)) === false);
}

function terminateVisibleHeading(heading: Element, continuation: Element): void {
  const pPr = child(heading, 'pPr')!;
  const terminal = child(continuation, 'pPr');
  for (const name of ['keepNext', 'widowControl']) {
    const property = child(terminal, name);
    if (!property) continue;
    const existing = child(pPr, name);
    if (existing) pPr.removeChild(existing);
    const preceding = name === 'keepNext' ? ['pStyle'] : ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr'];
    const following = directElementChildren(pPr).find(node => node.namespaceURI !== W_NS || !preceding.includes(node.localName ?? ''));
    pPr.insertBefore(property.cloneNode(true), following ?? null);
  }
  let mark = child(pPr, 'rPr');
  if (!mark) { mark = heading.ownerDocument!.createElementNS(W_NS, 'w:rPr'); pPr.appendChild(mark); }
  const terminalMark = child(terminal, 'rPr');
  if (terminalMark) {
    for (const property of directElementChildren(terminalMark)) {
      if (property.namespaceURI === W_NS && ['vanish', 'specVanish'].includes(property.localName ?? '')) continue;
      for (const previous of directElementChildren(mark).filter(node => node.namespaceURI === property.namespaceURI && node.localName === property.localName)) mark.removeChild(previous);
      mark.appendChild(property.cloneNode(true));
    }
  }
  for (const name of ['vanish', 'specVanish']) {
    let property = child(mark, name);
    if (!property) { property = heading.ownerDocument!.createElementNS(W_NS, `w:${name}`); mark.appendChild(property); }
    // Explicit false also overrides a hidden mark inherited from the heading
    // style. Removing only the direct flag would not preserve the boundary.
    property.setAttributeNS(W_NS, 'w:val', '0');
  }
}

/** Join an isolated punctuation continuation back to its matching split heading. */
export function normalizeDetachedHeadingPunctuation(inputPath: string, outputPath: string): number {
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('heading punctuation normalizer: word/document.xml not found');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const stylesEntry = zip.getEntry('word/styles.xml');
  const styles = stylesEntry ? new DOMParser().parseFromString(stylesEntry.getData().toString('utf-8'), 'text/xml').documentElement ?? undefined : undefined;
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p')) as Element[];
  let normalized = 0;

  for (const continuation of paragraphs) {
    if (!/^[.,;:!?]\s*$/.test(getParagraphText(continuation as unknown as globalThis.Element))) continue;
    if (!safeVisibleCarrier(continuation, styles)) continue;
    if (['fldChar', 'drawing', 'pict', 'object', 'footnoteReference', 'endnoteReference', 'br']
      .some((name) => continuation.getElementsByTagNameNS(W_NS, name).length > 0)) continue;

    let previous = continuation.previousSibling;
    while (previous && previous.nodeType !== 1) previous = previous.previousSibling;
    if (!previous) continue;
    const heading = previous as Element;
    if (heading.localName !== 'p' || heading.namespaceURI !== W_NS ||
        !matchingSplitHeadingStyles(heading, continuation)) continue;
    if (['sectPr', 'framePr', 'pageBreakBefore', 'pPrChange', 'rPrChange', 'del', 'ins', 'moveFrom', 'moveTo', 'rStyle'].some(name => child(heading, 'pPr')?.getElementsByTagNameNS(W_NS, name).length)) continue;

    for (const child of directElementChildren(continuation)) {
      if (child.localName === 'pPr' && child.namespaceURI === W_NS) continue;
      heading.appendChild(child);
    }
    // The punctuation carrier supplied the visible paragraph termination.
    // Keep that termination when deleting its paragraph, rather than allowing
    // the next numbered child (or next heading) to join this hidden separator.
    terminateVisibleHeading(heading, continuation);
    continuation.parentNode?.removeChild(continuation);
    normalized++;
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip, (name, data) =>
    name === 'word/document.xml' ? Buffer.from(serialized, 'utf-8') : data,
  );
  writeFileSync(outputPath, outZip.toBuffer());
  return normalized;
}
