import type { Document, Element } from '@xmldom/xmldom';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface ParagraphNumbering {
  numId: string;
  ilvl: number;
  outlineLvl?: number;
}

interface StyleNumbering {
  basedOn?: string;
  numId?: string;
  ilvl?: number;
  outlineLvl?: number;
}

function attr(element: Element, localName: string): string | null {
  return element.getAttributeNS(W_NS, localName) ?? element.getAttribute(`w:${localName}`);
}

function direct(parent: Element, localName: string): Element | null {
  for (let node = parent.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1) {
      const element = node as Element;
      if (element.namespaceURI === W_NS && element.localName === localName) return element;
    }
  }
  return null;
}

function numberingFromProperties(properties: Element | null): Partial<ParagraphNumbering> {
  const numPr = properties && direct(properties, 'numPr');
  if (!numPr) return {};
  const numId = direct(numPr, 'numId');
  const ilvl = direct(numPr, 'ilvl');
  return {
    ...(numId ? { numId: attr(numId, 'val') ?? undefined } : {}),
    ...(ilvl ? { ilvl: Number(attr(ilvl, 'val') ?? 0) } : {}),
  };
}

function outlineFromProperties(properties: Element | null): Pick<ParagraphNumbering, 'outlineLvl'> | Record<string, never> {
  const outline = properties && direct(properties, 'outlineLvl');
  return outline ? { outlineLvl: Number(attr(outline, 'val') ?? 0) } : {};
}

/** Resolve paragraph numbering through OOXML's basedOn style inheritance. */
export function createParagraphNumberingResolver(styles: Document | undefined): (paragraph: Element) => ParagraphNumbering | null {
  const definitions = new Map<string, StyleNumbering>();
  if (styles) {
    for (const style of Array.from(styles.getElementsByTagNameNS(W_NS, 'style'))) {
      if (attr(style, 'type') !== 'paragraph') continue;
      const styleId = attr(style, 'styleId');
      if (!styleId) continue;
      const basedOn = direct(style, 'basedOn');
      const properties = direct(style, 'pPr');
      definitions.set(styleId, {
        ...(basedOn ? { basedOn: attr(basedOn, 'val') ?? undefined } : {}),
        ...numberingFromProperties(properties),
        ...outlineFromProperties(properties),
      });
    }
  }

  const cache = new Map<string, ParagraphNumbering | null>();
  const resolving = new Set<string>();
  const resolveStyle = (styleId: string): ParagraphNumbering | null => {
    if (cache.has(styleId)) return cache.get(styleId) ?? null;
    if (resolving.has(styleId)) return null;
    resolving.add(styleId);
    const definition = definitions.get(styleId);
    const inherited = definition?.basedOn ? resolveStyle(definition.basedOn) : null;
    const numId = definition?.numId ?? inherited?.numId;
    const ilvl = definition?.ilvl ?? inherited?.ilvl ?? 0;
    const outlineLvl = definition?.outlineLvl ?? inherited?.outlineLvl;
    const result = numId ? { numId, ilvl, ...(outlineLvl !== undefined ? { outlineLvl } : {}) } : null;
    resolving.delete(styleId);
    cache.set(styleId, result);
    return result;
  };

  return (paragraph: Element): ParagraphNumbering | null => {
    const pPr = direct(paragraph, 'pPr');
    if (!pPr) return null;
    const pStyle = direct(pPr, 'pStyle');
    const inherited = pStyle ? resolveStyle(attr(pStyle, 'val') ?? '') : null;
    const directNumbering = numberingFromProperties(pPr);
    const directOutline = direct(pPr, 'outlineLvl');
    const numId = directNumbering.numId ?? inherited?.numId;
    const ilvl = directNumbering.ilvl ?? inherited?.ilvl ?? 0;
    const outlineLvl = directOutline ? Number(attr(directOutline, 'val') ?? 0) : inherited?.outlineLvl;
    return numId ? { numId, ilvl, ...(outlineLvl !== undefined ? { outlineLvl } : {}) } : null;
  };
}
