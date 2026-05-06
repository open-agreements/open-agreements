import { DOMParser } from '@xmldom/xmldom';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  EMPLOYMENT_TEMPLATE_CASES,
  W_NS,
  isClauseHeadingParagraph,
  isDefinitionItemParagraph,
  loadXmlPart,
  paragraphSpacing,
  paragraphStyle,
  standardTermsParagraphs,
  wordAttr,
} from './helpers/standard-terms-docx.js';

const it = itAllure.epic('Verification & Drift');

const repoRoot = new URL('..', import.meta.url).pathname;

describe('employment template style and spacing', () => {
  for (const testCase of EMPLOYMENT_TEMPLATE_CASES) {
    it.openspec('OA-FIL-020')(`${testCase.templatePath} emits Standard Terms paragraph styles`, () => {
      const stylesXml = loadXmlPart(repoRoot, testCase.templatePath, 'word/styles.xml');
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

      const documentXml = loadXmlPart(repoRoot, testCase.templatePath, 'word/document.xml');
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

    it.openspec('OA-FIL-020')(`${testCase.templatePath} keeps Standard Terms spacing values`, () => {
      const documentXml = loadXmlPart(repoRoot, testCase.templatePath, 'word/document.xml');
      const paragraphs = standardTermsParagraphs(documentXml, testCase.endMarker);
      expect(paragraphs.length).toBeGreaterThan(0);

      const spacingFailures: string[] = [];
      for (const { text, paragraph } of paragraphs) {
        const isHeading = isClauseHeadingParagraph(text);
        const isDefinition = isDefinitionItemParagraph(text);
        const expectedAfter = isHeading ? '120' : '280';
        const spacing = paragraphSpacing(paragraph);

        const beforeOk = isDefinition
          ? spacing.before === '0' || spacing.before === '320'
          : spacing.before === (isHeading ? '320' : '0');

        if (
          !beforeOk
          || spacing.after !== expectedAfter
          || spacing.line !== '340'
        ) {
          const expectedBeforeDescription = isDefinition ? '0|320' : isHeading ? '320' : '0';
          spacingFailures.push(
            `expectedBefore=${expectedBeforeDescription} before=${spacing.before ?? 'missing'} `
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
