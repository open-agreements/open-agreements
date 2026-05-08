import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Verification & Drift');

const repoRoot = join(import.meta.dirname, '..');
const checklistSlugs = ['closing-checklist', 'working-group-list'] as const;
const tokenPattern = /\{[^}]+\}/g;

function extractDocxText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const documentXml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  return [...documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

function normalizeSourceText(source: string): string {
  return source
    .toLowerCase()
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNormalizedTokens(source: string): string[] {
  return [...new Set(
    [...normalizeSourceText(source).matchAll(tokenPattern)]
      .map((match) => match[0].replace(/\s+/g, ' ').trim())
  )].sort();
}

function diffTokens(expected: string[], actual: string[]): string[] {
  const actualSet = new Set(actual);
  return expected.filter((token) => !actualSet.has(token));
}

describe('checklist canonical markdown token drift', () => {
  for (const slug of checklistSlugs) {
    it(`${slug} keeps template.md in sync with template.docx tokens`, () => {
      const templateDir = join(repoRoot, 'content', 'templates', slug);
      const markdownTokens = extractNormalizedTokens(
        readFileSync(join(templateDir, 'template.md'), 'utf-8')
      );
      const docxTokens = extractNormalizedTokens(
        extractDocxText(join(templateDir, 'template.docx'))
      );

      expect(
        {
          missing_in_template_md: diffTokens(docxTokens, markdownTokens),
          missing_in_template_docx: diffTokens(markdownTokens, docxTokens),
        },
        `${slug}: template.md token set drifted from template.docx`
      ).toEqual({
        missing_in_template_md: [],
        missing_in_template_docx: [],
      });
    });
  }
});
