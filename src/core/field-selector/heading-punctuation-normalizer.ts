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

/** Join an isolated punctuation continuation back to its matching split heading. */
export function normalizeDetachedHeadingPunctuation(inputPath: string, outputPath: string): number {
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('heading punctuation normalizer: word/document.xml not found');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p')) as Element[];
  let normalized = 0;

  for (const continuation of paragraphs) {
    if (!/^[.,;:!?]\s*$/.test(getParagraphText(continuation as unknown as globalThis.Element))) continue;
    if (['fldChar', 'drawing', 'pict', 'object', 'footnoteReference', 'endnoteReference', 'br']
      .some((name) => continuation.getElementsByTagNameNS(W_NS, name).length > 0)) continue;

    let previous = continuation.previousSibling;
    while (previous && previous.nodeType !== 1) previous = previous.previousSibling;
    if (!previous) continue;
    const heading = previous as Element;
    if (heading.localName !== 'p' || heading.namespaceURI !== W_NS ||
        !matchingSplitHeadingStyles(heading, continuation)) continue;

    for (const child of directElementChildren(continuation)) {
      if (child.localName === 'pPr' && child.namespaceURI === W_NS) continue;
      if (child.localName === 'r' && child.namespaceURI === W_NS) {
        const text = getParagraphText(continuation as unknown as globalThis.Element);
        const runText = Array.from(child.getElementsByTagNameNS(W_NS, 't'))
          .map((node) => node.textContent ?? '').join('');
        if (runText.trim().length === 0 && text.trim().length > 0) continue;
      }
      heading.appendChild(child);
    }
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
