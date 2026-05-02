import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';

export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export const EMPLOYMENT_TEMPLATE_CASES = [
  {
    templatePath: 'content/templates/openagreements-employment-offer-letter/template.docx',
    endMarker: 'Signatures',
  },
  {
    templatePath: 'content/templates/openagreements-employee-ip-inventions-assignment/template.docx',
    endMarker: 'Signatures',
  },
  {
    templatePath: 'content/templates/openagreements-employment-confidentiality-acknowledgement/template.docx',
    endMarker: 'Acknowledgement Signature',
  },
] as const;

export type EmploymentTemplateCase = typeof EMPLOYMENT_TEMPLATE_CASES[number];

export function loadXmlPart(repoRoot: string, templatePath: string, partPath: string): string {
  const absolutePath = join(repoRoot, templatePath);
  const zip = new AdmZip(readFileSync(absolutePath));
  const entry = zip.getEntry(partPath);
  if (!entry) {
    throw new Error(`${partPath} missing in ${templatePath}`);
  }
  return entry.getData().toString('utf-8');
}

export function loadDocumentXml(repoRoot: string, templatePath: string): string {
  return loadXmlPart(repoRoot, templatePath, 'word/document.xml');
}

export function directChild(parent: Element, localName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const child = parent.childNodes[i] as Element;
    if (!child || child.nodeType !== 1 || child.localName !== localName || child.namespaceURI !== W_NS) {
      continue;
    }
    return child;
  }
  return null;
}

export function wordAttr(node: Element | null, name: string): string | null {
  if (!node) return null;
  return node.getAttributeNS(W_NS, name) ?? node.getAttribute(`w:${name}`) ?? node.getAttribute(name);
}

export function paragraphText(paragraph: Element): string {
  const textNodes = paragraph.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < textNodes.length; i += 1) {
    text += textNodes[i].textContent ?? '';
  }
  return text.trim();
}

export function isClauseHeadingParagraph(text: string): boolean {
  return /^\d+\.\s/.test(text);
}

export function isDefinitionItemParagraph(text: string): boolean {
  return /^\d+\.\d+\s/.test(text);
}

export function paragraphStyle(paragraph: Element): string | null {
  const pPr = directChild(paragraph, 'pPr');
  if (!pPr) return null;
  const pStyle = directChild(pPr, 'pStyle');
  return wordAttr(pStyle, 'val');
}

export interface ParagraphSpacing {
  before: string | null;
  after: string | null;
  line: string | null;
  afterAutospacing: string | null;
  beforeAutospacing: string | null;
  contextualSpacing: string | null;
}

export function paragraphSpacing(paragraph: Element): ParagraphSpacing {
  const pPr = directChild(paragraph, 'pPr');
  if (!pPr) {
    return {
      before: null,
      after: null,
      line: null,
      afterAutospacing: null,
      beforeAutospacing: null,
      contextualSpacing: null,
    };
  }
  const contextualNode = directChild(pPr, 'contextualSpacing');
  const contextualSpacing = wordAttr(contextualNode, 'val');
  const spacing = directChild(pPr, 'spacing');
  if (!spacing) {
    return {
      before: null,
      after: null,
      line: null,
      afterAutospacing: null,
      beforeAutospacing: null,
      contextualSpacing,
    };
  }
  return {
    before: wordAttr(spacing, 'before'),
    after: wordAttr(spacing, 'after'),
    line: wordAttr(spacing, 'line'),
    afterAutospacing: wordAttr(spacing, 'afterAutospacing'),
    beforeAutospacing: wordAttr(spacing, 'beforeAutospacing'),
    contextualSpacing,
  };
}

export function standardTermsParagraphs(
  documentXml: string,
  endMarker: string
): Array<{ text: string; paragraph: Element }> {
  const doc = new DOMParser().parseFromString(documentXml, 'text/xml');
  const bodyNodes = doc.getElementsByTagNameNS(W_NS, 'body');
  if (bodyNodes.length === 0) {
    throw new Error('word/body missing');
  }

  const body = bodyNodes[0];
  let inStandardTerms = false;
  const matches: Array<{ text: string; paragraph: Element }> = [];

  for (let i = 0; i < body.childNodes.length; i += 1) {
    const node = body.childNodes[i] as Element;
    if (!node || node.nodeType !== 1 || node.localName !== 'p' || node.namespaceURI !== W_NS) {
      continue;
    }

    const text = paragraphText(node);
    if (text === 'Standard Terms') {
      inStandardTerms = true;
      continue;
    }
    if (text === endMarker) {
      inStandardTerms = false;
    }
    if (!inStandardTerms || text === '') {
      continue;
    }

    matches.push({ text, paragraph: node });
  }

  return matches;
}

export function sectionNodesAfterHeading(documentXml: string, headingText: string): Element[] {
  const doc = new DOMParser().parseFromString(documentXml, 'text/xml');
  const bodyNodes = doc.getElementsByTagNameNS(W_NS, 'body');
  if (bodyNodes.length === 0) {
    throw new Error('word/body missing');
  }

  const body = bodyNodes[0];
  let inSection = false;
  const matches: Element[] = [];

  for (let i = 0; i < body.childNodes.length; i += 1) {
    const node = body.childNodes[i] as Element;
    if (!node || node.nodeType !== 1 || node.namespaceURI !== W_NS) {
      continue;
    }

    if (node.localName === 'p' && paragraphText(node) === headingText) {
      inSection = true;
      continue;
    }
    if (!inSection) {
      continue;
    }
    if (node.localName === 'sectPr') {
      break;
    }

    matches.push(node);
  }

  return matches;
}

export function nodeText(node: Element): string {
  const textNodes = node.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < textNodes.length; i += 1) {
    text += textNodes[i].textContent ?? '';
  }
  return text.trim();
}

export function tableTextsAfterHeading(documentXml: string, headingText: string): string[] {
  return sectionNodesAfterHeading(documentXml, headingText)
    .filter((node) => node.localName === 'tbl')
    .map((node) => nodeText(node));
}
