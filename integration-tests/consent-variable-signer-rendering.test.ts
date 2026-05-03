import { afterAll, describe, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { itAllure } from './helpers/allure-test.js';
import { fillTemplate } from '../src/core/engine.js';

const it = itAllure.epic('Filling & Rendering');
const BOARD_TEMPLATE_DIR = join(
  import.meta.dirname,
  '..',
  'content',
  'templates',
  'openagreements-board-consent-safe'
);
const STOCKHOLDER_TEMPLATE_DIR = join(
  import.meta.dirname,
  '..',
  'content',
  'templates',
  'openagreements-stockholder-consent-safe'
);
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function extractParagraphs(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  return [...xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)]
    .map((match) =>
      [...match[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((textMatch) => textMatch[1])
        .join('')
        .trim()
    )
    .filter(Boolean);
}

async function fillBoardConsent(signerCount: number): Promise<string[]> {
  const outputDir = mkdtempSync(join(tmpdir(), `oa-board-filled-${signerCount}-`));
  tempDirs.push(outputDir);
  const outputPath = join(outputDir, 'filled.docx');

  await fillTemplate({
    templateDir: BOARD_TEMPLATE_DIR,
    outputPath,
    values: {
      company_name: 'Acme Labs, Inc.',
      effective_date: 'April 16, 2026',
      purchase_amount: '500,000',
      board_members: Array.from({ length: signerCount }, (_value, index) => ({
        name: `Director ${index + 1}`,
      })),
    },
  });

  return extractParagraphs(outputPath);
}

async function fillStockholderConsent(signerCount: number): Promise<string[]> {
  const outputDir = mkdtempSync(join(tmpdir(), `oa-stockholder-filled-${signerCount}-`));
  tempDirs.push(outputDir);
  const outputPath = join(outputDir, 'filled.docx');

  await fillTemplate({
    templateDir: STOCKHOLDER_TEMPLATE_DIR,
    outputPath,
    values: {
      company_name: 'Acme Labs, Inc.',
      effective_date: 'April 16, 2026',
      purchase_amount: '500,000',
      stockholders: Array.from({ length: signerCount }, (_value, index) => ({
        name: `Stockholder ${index + 1}`,
      })),
    },
  });

  return extractParagraphs(outputPath);
}

describe('SAFE consent variable signer rendering', () => {
  for (const signerCount of [1, 3, 7]) {
    it.openspec('OA-FIL-024')(
      `renders board consent with exactly ${signerCount} signature blocks from canonical template output`,
      async () => {
        const paragraphs = await fillBoardConsent(signerCount);

        expect(paragraphs.filter((paragraph) => paragraph === '______________________________')).toHaveLength(
          signerCount
        );
        expect(paragraphs.filter((paragraph) => paragraph === `Date: April 16, 2026`)).toHaveLength(
          signerCount
        );
        expect(paragraphs.filter((paragraph) => paragraph === 'Director')).toHaveLength(signerCount);
        expect(paragraphs).not.toContain('_______');
        expect(paragraphs.join('\n')).not.toContain('{FOR ');
        expect(paragraphs.join('\n')).not.toContain('{END-FOR ');
        expect(paragraphs.join('\n')).not.toContain('{$member.name}');

        for (let i = 1; i <= signerCount; i++) {
          expect(paragraphs).toContain(`Print Name: Director ${i}`);
        }
      }
    );

    it.openspec('OA-FIL-024')(
      `renders stockholder consent with exactly ${signerCount} signature blocks from canonical template output`,
      async () => {
        const paragraphs = await fillStockholderConsent(signerCount);

        expect(paragraphs.filter((paragraph) => paragraph === '______________________________')).toHaveLength(
          signerCount
        );
        expect(paragraphs.filter((paragraph) => paragraph === `Date: April 16, 2026`)).toHaveLength(
          signerCount
        );
        expect(paragraphs.filter((paragraph) => paragraph === 'Stockholder')).toHaveLength(signerCount);
        expect(paragraphs).not.toContain('_______');
        expect(paragraphs.join('\n')).not.toContain('{FOR ');
        expect(paragraphs.join('\n')).not.toContain('{END-FOR ');
        expect(paragraphs.join('\n')).not.toContain('{$stockholder.name}');

        for (let i = 1; i <= signerCount; i++) {
          expect(paragraphs).toContain(`Print Name: Stockholder ${i}`);
        }
      }
    );
  }
});
