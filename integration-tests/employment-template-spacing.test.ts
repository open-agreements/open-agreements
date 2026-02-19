import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Verification & Drift');

const EMPLOYMENT_SPACING_CASES = [
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

function loadDocumentXml(templatePath: string): string {
  const absolutePath = join(import.meta.dirname, '..', templatePath);
  const zip = new AdmZip(readFileSync(absolutePath));
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error(`word/document.xml missing in ${templatePath}`);
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

function paragraphSpacing(paragraph: Element): {
  after: string | null;
  before: string | null;
  line: string | null;
  afterAutospacing: string | null;
  beforeAutospacing: string | null;
  contextualSpacing: string | null;
} {
  const pPrNodes = paragraph.getElementsByTagNameNS(W_NS, 'pPr');
  if (pPrNodes.length === 0) {
    return {
      after: null,
      before: null,
      line: null,
      afterAutospacing: null,
      beforeAutospacing: null,
      contextualSpacing: null,
    };
  }
  const spacingNodes = pPrNodes[0].getElementsByTagNameNS(W_NS, 'spacing');
  const contextualNodes = pPrNodes[0].getElementsByTagNameNS(W_NS, 'contextualSpacing');
  const contextualSpacing = contextualNodes.length > 0
    ? contextualNodes[0].getAttributeNS(W_NS, 'val')
    : null;
  if (spacingNodes.length === 0) {
    return {
      after: null,
      before: null,
      line: null,
      afterAutospacing: null,
      beforeAutospacing: null,
      contextualSpacing,
    };
  }
  return {
    before: spacingNodes[0].getAttributeNS(W_NS, 'before'),
    after: spacingNodes[0].getAttributeNS(W_NS, 'after'),
    line: spacingNodes[0].getAttributeNS(W_NS, 'line'),
    afterAutospacing: spacingNodes[0].getAttributeNS(W_NS, 'afterAutospacing'),
    beforeAutospacing: spacingNodes[0].getAttributeNS(W_NS, 'beforeAutospacing'),
    contextualSpacing,
  };
}

describe('employment template standard-terms spacing', () => {
  for (const testCase of EMPLOYMENT_SPACING_CASES) {
    it(`${testCase.templatePath} keeps 6pt spacing in Standard Terms`, () => {
      const xml = loadDocumentXml(testCase.templatePath);
      const doc = new DOMParser().parseFromString(xml, 'text/xml');

      const bodyNodes = doc.getElementsByTagNameNS(W_NS, 'body');
      expect(bodyNodes.length).toBeGreaterThan(0);
      const body = bodyNodes[0];

      const paragraphs: Element[] = [];
      for (let i = 0; i < body.childNodes.length; i += 1) {
        const node = body.childNodes[i] as Element;
        if (!node || node.localName !== 'p' || node.namespaceURI !== W_NS) continue;
        paragraphs.push(node);
      }

      let inStandardTerms = false;
      const spacingFailures: string[] = [];
      let checkedParagraphs = 0;

      for (const paragraph of paragraphs) {
        const text = paragraphText(paragraph);
        if (text === 'Standard Terms') {
          inStandardTerms = true;
          continue;
        }
        if (text === testCase.endMarker) {
          inStandardTerms = false;
        }
        if (!inStandardTerms || text === '') continue;

        const spacing = paragraphSpacing(paragraph);
        checkedParagraphs += 1;
        const expectedBefore = isClauseHeadingParagraph(text) ? '320' : '0';
        const expectedAfter = isClauseHeadingParagraph(text) ? '120' : '280';
        // In OOXML, explicit "false" is semantically equivalent to absent (null)
        const isSet = (v: string | null) => v !== null && v !== 'false';
        if (
          spacing.before !== expectedBefore
          || spacing.after !== expectedAfter
          || spacing.line !== '340'
          || isSet(spacing.afterAutospacing)
          || isSet(spacing.beforeAutospacing)
          || isSet(spacing.contextualSpacing)
        ) {
          spacingFailures.push(
            `expectedBefore=${expectedBefore} before=${spacing.before ?? 'missing'} expectedAfter=${expectedAfter} `
            + `after=${spacing.after ?? 'missing'} line=${spacing.line ?? 'missing'} `
            + `afterAuto=${spacing.afterAutospacing ?? 'missing'} beforeAuto=${spacing.beforeAutospacing ?? 'missing'} `
            + `contextual=${spacing.contextualSpacing ?? 'missing'} `
            + `text="${text.slice(0, 80)}"`
          );
        }
      }

      expect(checkedParagraphs).toBeGreaterThan(0);
      expect(spacingFailures).toEqual([]);
    });
  }
});
