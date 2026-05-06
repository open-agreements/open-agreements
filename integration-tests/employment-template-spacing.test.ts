import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  EMPLOYMENT_TEMPLATE_CASES,
  isClauseHeadingParagraph,
  isDefinitionItemParagraph,
  loadDocumentXml,
  paragraphSpacing,
  standardTermsParagraphs,
} from './helpers/standard-terms-docx.js';

const it = itAllure.epic('Verification & Drift');

const repoRoot = new URL('..', import.meta.url).pathname;

describe('employment template standard-terms spacing', () => {
  for (const testCase of EMPLOYMENT_TEMPLATE_CASES) {
    it.openspec('OA-FIL-020')(`${testCase.templatePath} keeps 6pt spacing in Standard Terms`, () => {
      const documentXml = loadDocumentXml(repoRoot, testCase.templatePath);
      const paragraphs = standardTermsParagraphs(documentXml, testCase.endMarker);
      expect(paragraphs.length).toBeGreaterThan(0);

      // In OOXML, explicit "false" is semantically equivalent to absent (null)
      const isSet = (v: string | null) => v !== null && v !== 'false';
      const spacingFailures: string[] = [];

      for (const { text, paragraph } of paragraphs) {
        const spacing = paragraphSpacing(paragraph);
        const isHeading = isClauseHeadingParagraph(text);
        const isDefinition = isDefinitionItemParagraph(text);
        const expectedAfter = isHeading ? '120' : '280';
        const beforeOk = isDefinition
          ? spacing.before === '0' || spacing.before === '320'
          : spacing.before === (isHeading ? '320' : '0');

        if (
          !beforeOk
          || spacing.after !== expectedAfter
          || spacing.line !== '340'
          || isSet(spacing.afterAutospacing)
          || isSet(spacing.beforeAutospacing)
          || isSet(spacing.contextualSpacing)
        ) {
          const expectedBeforeDescription = isDefinition ? '0|320' : isHeading ? '320' : '0';
          spacingFailures.push(
            `expectedBefore=${expectedBeforeDescription} before=${spacing.before ?? 'missing'} expectedAfter=${expectedAfter} `
            + `after=${spacing.after ?? 'missing'} line=${spacing.line ?? 'missing'} `
            + `afterAuto=${spacing.afterAutospacing ?? 'missing'} beforeAuto=${spacing.beforeAutospacing ?? 'missing'} `
            + `contextual=${spacing.contextualSpacing ?? 'missing'} `
            + `text="${text.slice(0, 80)}"`
          );
        }
      }

      expect(spacingFailures).toEqual([]);
    });
  }
});
