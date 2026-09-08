import type { Document, Element, Node } from '@xmldom/xmldom';
import { preserveXmlSpace } from './ooxml-parts.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const is = (node: Node, name: string): node is Element => node.nodeType === 1 && node.namespaceURI === W && node.localName === name;

export interface GlyphFallbackReceipt {
  fontFamily: string;
  codePoint: 'U+2011';
  replacements: number;
  parts: string[];
}

export function validateNonbreakingHyphenFont(family: string): void {
  if (typeof family !== 'string' || !family.trim() || family !== family.trim()
    || Array.from(family).some(character => { const code = character.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159); })) {
    throw new Error('render-copy: nonbreaking-hyphen font must be a nonblank family without surrounding whitespace or controls');
  }
}

export function hasNonbreakingHyphen(document: Document | Element): boolean {
  return document.getElementsByTagNameNS(W, 'noBreakHyphen').length > 0
    || Array.from(document.getElementsByTagNameNS(W, 't')).some(text => text.textContent?.includes('\u2011'));
}

/** Only split affected main-story runs; never discover or substitute host fonts. */
export function applyNonbreakingHyphenFont(document: Document, fontFamily: string): GlyphFallbackReceipt {
  validateNonbreakingHyphenFont(fontFamily);
  const tokens = [
    ...Array.from(document.getElementsByTagNameNS(W, 'noBreakHyphen')),
    ...Array.from(document.getElementsByTagNameNS(W, 't')).filter(text => text.textContent?.includes('\u2011')),
  ];
  const runs = new Set<Element>();
  // Preflight the entire affected set before changing any nodes.
  for (const token of tokens) {
    const run = token.parentNode;
    if (!run || !is(run, 'r')) throw new Error('render-copy: unsupported nonbreaking-hyphen run');
    for (let ancestor: Node | null = run; ancestor; ancestor = ancestor.parentNode) {
      if ((ancestor.namespaceURI === MC && ancestor.localName === 'AlternateContent')
        || (ancestor.namespaceURI === W && ['txbxContent', 'del', 'ins', 'moveFrom', 'moveTo', 'ruby'].includes(ancestor.localName ?? ''))) {
        throw new Error('render-copy: nonbreaking hyphens in alternate, revision, ruby or textbox stories are unsupported');
      }
    }
    if (run.getElementsByTagNameNS(W, 'rPrChange').length) throw new Error('render-copy: revised glyph run properties are unsupported');
    if (Array.from(run.childNodes).filter(node => is(node, 'rPr')).length > 1) throw new Error('render-copy: duplicate glyph run properties');
    runs.add(run);
  }
  let replacements = 0;
  for (const run of runs) {
    const properties = Array.from(run.childNodes).find(node => is(node, 'rPr')) as Element | undefined;
    const fresh = (): Element => {
      const result = run.cloneNode(false) as Element;
      if (properties) result.appendChild(properties.cloneNode(true));
      return result;
    };
    const segments: Element[] = [];
    let ordinary = fresh();
    const flush = (): void => {
      if (Array.from(ordinary.childNodes).some(node => !is(node, 'rPr'))) segments.push(ordinary);
      ordinary = fresh();
    };
    const glyph = (): void => {
      flush();
      const result = fresh();
      let rPr = Array.from(result.childNodes).find(node => is(node, 'rPr')) as Element | undefined;
      if (!rPr) { rPr = document.createElementNS(W, 'w:rPr'); result.insertBefore(rPr, result.firstChild); }
      for (const fonts of Array.from(rPr.childNodes).filter(node => is(node, 'rFonts'))) rPr.removeChild(fonts);
      const fonts = document.createElementNS(W, 'w:rFonts');
      for (const script of ['ascii', 'hAnsi', 'eastAsia', 'cs']) fonts.setAttributeNS(W, `w:${script}`, fontFamily);
      const afterStyle = Array.from(rPr.childNodes).find(node => !is(node, 'rStyle'));
      rPr.insertBefore(fonts, afterStyle ?? null);
      const text = document.createElementNS(W, 'w:t'); text.appendChild(document.createTextNode('\u2011'));
      result.appendChild(text); segments.push(result); replacements++;
    };
    for (const item of Array.from(run.childNodes)) {
      if (is(item, 'rPr')) continue;
      if (is(item, 'noBreakHyphen')) { glyph(); continue; }
      if (is(item, 't') && item.textContent?.includes('\u2011')) {
        const pieces = item.textContent.split('\u2011');
        pieces.forEach((piece, index) => {
          if (index) glyph();
          if (piece) {
            const text = item.cloneNode(false) as Element;
            preserveXmlSpace(text); text.appendChild(document.createTextNode(piece)); ordinary.appendChild(text);
          }
        });
      } else ordinary.appendChild(item.cloneNode(true));
    }
    flush();
    for (const segment of segments) run.parentNode!.insertBefore(segment, run);
    run.parentNode!.removeChild(run);
  }
  return { fontFamily, codePoint: 'U+2011', replacements, parts: replacements ? ['word/document.xml'] : [] };
}
