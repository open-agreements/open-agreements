import AdmZip from 'adm-zip';
import { writeFileSync } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import { createParagraphNumberingResolver } from './paragraph-numbering.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface NumberingNormalizationStats { sections: number; paragraphs: number }

function attr(el: XmlElement, local: string): string | null {
  return el.getAttributeNS(W, local) ?? el.getAttribute(`w:${local}`);
}

function direct(parent: XmlElement, local: string): XmlElement | null {
  for (let node = parent.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && (node as XmlElement).localName === local) return node as XmlElement;
  }
  return null;
}

export function normalizeNumberedHeadingSections(inputPath: string, outputPath: string): NumberingNormalizationStats {
  const zip = new AdmZip(inputPath);
  const documentEntry = zip.getEntry('word/document.xml');
  const stylesEntry = zip.getEntry('word/styles.xml');
  const numberingEntry = zip.getEntry('word/numbering.xml');
  if (!documentEntry || !stylesEntry || !numberingEntry) return { sections: 0, paragraphs: 0 };
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const document = parser.parseFromString(documentEntry.getData().toString('utf8'), 'text/xml');
  const styles = parser.parseFromString(stylesEntry.getData().toString('utf8'), 'text/xml');
  const numbering = parser.parseFromString(numberingEntry.getData().toString('utf8'), 'text/xml');

  const resolveNumbering = createParagraphNumberingResolver(styles);
  const numToAbstract = new Map<string, string>();
  const hierarchicalAbstracts = new Set<string>();
  const abstractElements = new Map<string, XmlElement>();
  let maxAbstractNumId = 0;
  for (const abstract of Array.from(numbering.getElementsByTagNameNS(W, 'abstractNum'))) {
    const id = attr(abstract, 'abstractNumId');
    if (id) { abstractElements.set(id, abstract); maxAbstractNumId = Math.max(maxAbstractNumId, Number(id)); }
    const levels = Array.from(abstract.getElementsByTagNameNS(W, 'lvl'));
    if (id && levels.some((level) => attr(level, 'ilvl') === '1')) hierarchicalAbstracts.add(id);
  }
  let maxNumId = 0;
  for (const num of Array.from(numbering.getElementsByTagNameNS(W, 'num'))) {
    const id = attr(num, 'numId');
    const abstract = direct(num, 'abstractNumId');
    if (id && abstract) numToAbstract.set(id, attr(abstract, 'val')!);
    if (id) maxNumId = Math.max(maxNumId, Number(id));
  }

  const paragraphs = Array.from(document.getElementsByTagNameNS(W, 'p'));
  const candidates = paragraphs.map((paragraph) => {
    const pPr = direct(paragraph, 'pPr');
    const resolved = resolveNumbering(paragraph);
    return pPr && resolved && resolved.outlineLvl !== undefined
      ? { paragraph, pPr, ...resolved }
      : null;
  });
  const roots = candidates.filter((item) => item?.ilvl === 0 && hierarchicalAbstracts.has(numToAbstract.get(item.numId) ?? ''));
  if (roots.length < 2) return { sections: 0, paragraphs: 0 };
  const counts = new Map<string, number>();
  for (const root of roots) counts.set(root!.numId, (counts.get(root!.numId) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    throw new Error('numbering normalization: ambiguous dominant top-level numbering instance');
  }
  const sourceNumId = ranked[0][0];
  const abstractNumId = numToAbstract.get(sourceNumId);
  if (!abstractNumId) throw new Error(`numbering normalization: missing abstract numbering for numId ${sourceNumId}`);
  const sourceAbstract = abstractElements.get(abstractNumId);
  if (!sourceAbstract) throw new Error(`numbering normalization: missing abstractNum ${abstractNumId}`);

  let section = 0;
  let rewritten = 0;
  let activeNumId: string | null = null;
  for (const item of candidates) {
    if (!item || item.numId !== sourceNumId) continue;
    if (item.ilvl === 0) {
      section += 1;
      activeNumId = String(++maxNumId);
      const sectionAbstract = sourceAbstract.cloneNode(true) as XmlElement;
      const sectionAbstractId = String(++maxAbstractNumId);
      sectionAbstract.setAttributeNS(W, 'w:abstractNumId', sectionAbstractId);
      const levelZero = Array.from(sectionAbstract.getElementsByTagNameNS(W, 'lvl')).find((level) => attr(level, 'ilvl') === '0');
      const levelStart = levelZero && direct(levelZero, 'start');
      if (!levelStart) throw new Error('numbering normalization: level zero has no start value');
      levelStart.setAttributeNS(W, 'w:val', String(section));
      if (!numbering.documentElement) throw new Error('numbering normalization: missing numbering root');
      numbering.documentElement.appendChild(sectionAbstract);
      const num = numbering.createElementNS(W, 'w:num');
      num.setAttributeNS(W, 'w:numId', activeNumId);
      const abstract = numbering.createElementNS(W, 'w:abstractNumId');
      abstract.setAttributeNS(W, 'w:val', sectionAbstractId);
      num.appendChild(abstract);
      numbering.documentElement.appendChild(num);
    }
    if (!activeNumId) throw new Error('numbering normalization: subordinate heading precedes its top-level heading');
    let numPr: XmlElement | null = direct(item.pPr, 'numPr');
    if (!numPr) {
      numPr = document.createElementNS(W, 'w:numPr');
      item.pPr.appendChild(numPr);
    }
    const concreteNumPr = numPr;
    let ilvl: XmlElement | null = direct(concreteNumPr, 'ilvl');
    if (!ilvl) { ilvl = document.createElementNS(W, 'w:ilvl'); concreteNumPr.appendChild(ilvl); }
    ilvl.setAttributeNS(W, 'w:val', String(item.ilvl));
    let numId: XmlElement | null = direct(concreteNumPr, 'numId');
    if (!numId) { numId = document.createElementNS(W, 'w:numId'); concreteNumPr.appendChild(numId); }
    numId.setAttributeNS(W, 'w:val', activeNumId);
    rewritten += 1;
  }
  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(document)));
  zip.updateFile('word/numbering.xml', Buffer.from(serializer.serializeToString(numbering)));
  writeFileSync(outputPath, zip.toBuffer());
  return { sections: section, paragraphs: rewritten };
}
