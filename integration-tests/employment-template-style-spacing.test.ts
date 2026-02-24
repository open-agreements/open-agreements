import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Verification & Drift');

const EMPLOYMENT_TEMPLATE_CASES = [
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

function loadXmlPart(templatePath: string, partPath: string): string {
  const absolutePath = join(import.meta.dirname, '..', templatePath);
  const zip = new AdmZip(readFileSync(absolutePath));
  const entry = zip.getEntry(partPath);
  if (!entry) {
    throw new Error(`${partPath} missing in ${templatePath}`);
  }
  return entry.getData().toString('utf-8');
}

function paragraphText(paragraph: Element): string {
  const textNodes = paragraph.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < textNodes.length; i += 1) {
    text += textNodes[i].textContent ?? '';
  }
  return text.trim();
}

function isClauseHeadingParagraph(text: string): boolean {
  return /^\d+\.\s/.test(text);
}

function directChild(parent: Element, localName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const child = parent.childNodes[i] as Element;
    if (!child || child.nodeType !== 1 || child.localName !== localName || child.namespaceURI !== W_NS) {
      continue;
    }
    return child;
  }
  return null;
}

function wordAttr(node: Element | null, name: string): string | null {
  if (!node) return null;
  return node.getAttributeNS(W_NS, name) ?? node.getAttribute(`w:${name}`) ?? node.getAttribute(name);
}

function paragraphStyle(paragraph: Element): string | null {
  const pPr = directChild(paragraph, 'pPr');
  if (!pPr) return null;
  const pStyle = directChild(pPr, 'pStyle');
  return wordAttr(pStyle, 'val');
}

function paragraphSpacing(paragraph: Element): {
  before: string | null;
  after: string | null;
  line: string | null;
} {
  const pPr = directChild(paragraph, 'pPr');
  if (!pPr) {
    return { before: null, after: null, line: null };
  }
  const spacing = directChild(pPr, 'spacing');
  if (!spacing) {
    return { before: null, after: null, line: null };
  }
  return {
    before: wordAttr(spacing, 'before'),
    after: wordAttr(spacing, 'after'),
    line: wordAttr(spacing, 'line'),
  };
}

function standardTermsParagraphs(documentXml: string, endMarker: string): Array<{ text: string; paragraph: Element }> {
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

describe('employment template style and spacing', () => {
  for (const testCase of EMPLOYMENT_TEMPLATE_CASES) {
    it.openspec('OA-173')(`${testCase.templatePath} emits Standard Terms paragraph styles`, () => {
      const stylesXml = loadXmlPart(testCase.templatePath, 'word/styles.xml');
      const stylesDoc = new DOMParser().parseFromString(stylesXml, 'text/xml');
      const styleNodes = stylesDoc.getElementsByTagNameNS(W_NS, 'style');
      const paragraphStyleIds = new Set<string>();

      for (let i = 0; i < styleNodes.length; i += 1) {
        const node = styleNodes[i];
        if (wordAttr(node, 'type') !== 'paragraph') continue;
        const styleId = wordAttr(node, 'styleId');
        if (styleId) paragraphStyleIds.add(styleId);
      }

      expect(paragraphStyleIds.has('Normal')).toBe(true);
      expect(paragraphStyleIds.has('OAClauseHeading')).toBe(true);
      expect(paragraphStyleIds.has('OAClauseBody')).toBe(true);

      const documentXml = loadXmlPart(testCase.templatePath, 'word/document.xml');
      const paragraphs = standardTermsParagraphs(documentXml, testCase.endMarker);
      expect(paragraphs.length).toBeGreaterThan(0);

      const styleFailures: string[] = [];
      for (const { text, paragraph } of paragraphs) {
        const expectedStyle = isClauseHeadingParagraph(text) ? 'OAClauseHeading' : 'OAClauseBody';
        const actualStyle = paragraphStyle(paragraph);
        if (actualStyle !== expectedStyle) {
          styleFailures.push(
            `expectedStyle=${expectedStyle} actualStyle=${actualStyle ?? 'missing'} text="${text.slice(0, 80)}"`
          );
        }
      }

      expect(styleFailures).toEqual([]);
    });

    it.openspec('OA-173')(`${testCase.templatePath} keeps Standard Terms spacing values`, () => {
      const documentXml = loadXmlPart(testCase.templatePath, 'word/document.xml');
      const paragraphs = standardTermsParagraphs(documentXml, testCase.endMarker);
      expect(paragraphs.length).toBeGreaterThan(0);

      const spacingFailures: string[] = [];
      for (const { text, paragraph } of paragraphs) {
        const expectedBefore = isClauseHeadingParagraph(text) ? '320' : '0';
        const expectedAfter = isClauseHeadingParagraph(text) ? '120' : '280';
        const spacing = paragraphSpacing(paragraph);

        if (
          spacing.before !== expectedBefore
          || spacing.after !== expectedAfter
          || spacing.line !== '340'
        ) {
          spacingFailures.push(
            `expectedBefore=${expectedBefore} before=${spacing.before ?? 'missing'} `
            + `expectedAfter=${expectedAfter} after=${spacing.after ?? 'missing'} `
            + `line=${spacing.line ?? 'missing'} `
            + `text="${text.slice(0, 80)}"`
          );
        }
      }

      expect(spacingFailures).toEqual([]);
    });
  }
});
