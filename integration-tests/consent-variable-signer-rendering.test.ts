import { afterAll, describe, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { itAllure } from './helpers/allure-test.js';
import { renderContractIrTemplate } from '../scripts/contract_ir/index.mjs';
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

async function createRenderedBoardTemplateFixture(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'oa-board-rendered-'));
  tempDirs.push(dir);

  const { buffer } = await renderContractIrTemplate(BOARD_TEMPLATE_DIR);
  writeFileSync(join(dir, 'template.docx'), buffer);
  writeFileSync(join(dir, 'metadata.yaml'), readFileSync(join(BOARD_TEMPLATE_DIR, 'metadata.yaml')));
  writeFileSync(join(dir, 'clean.json'), readFileSync(join(BOARD_TEMPLATE_DIR, 'clean.json')));

  return dir;
}

async function fillBoardConsent(signerCount: number): Promise<string[]> {
  const templateDir = await createRenderedBoardTemplateFixture();
  const outputDir = mkdtempSync(join(tmpdir(), `oa-board-filled-${signerCount}-`));
  tempDirs.push(outputDir);
  const outputPath = join(outputDir, 'filled.docx');

  await fillTemplate({
    templateDir,
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

async function createRenderedStockholderTemplateFixture(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'oa-stockholder-rendered-'));
  tempDirs.push(dir);

  const { buffer } = await renderContractIrTemplate(STOCKHOLDER_TEMPLATE_DIR);
  writeFileSync(join(dir, 'template.docx'), buffer);
  writeFileSync(join(dir, 'metadata.yaml'), readFileSync(join(STOCKHOLDER_TEMPLATE_DIR, 'metadata.yaml')));
  writeFileSync(join(dir, 'clean.json'), readFileSync(join(STOCKHOLDER_TEMPLATE_DIR, 'clean.json')));

  return dir;
}

async function fillStockholderConsent(signerCount: number): Promise<string[]> {
  const templateDir = await createRenderedStockholderTemplateFixture();
  const outputDir = mkdtempSync(join(tmpdir(), `oa-stockholder-filled-${signerCount}-`));
  tempDirs.push(outputDir);
  const outputPath = join(outputDir, 'filled.docx');

  await fillTemplate({
    templateDir,
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
      `renders board consent with exactly ${signerCount} signature blocks from Contract IR output`,
      async () => {
        const paragraphs = await fillBoardConsent(signerCount);

        expect(paragraphs.filter((paragraph) => paragraph === '______________________________')).toHaveLength(
          signerCount
        );
        expect(paragraphs.filter((paragraph) => paragraph === 'Date: April 16, 2026')).toHaveLength(
          signerCount
        );
        expect(paragraphs).not.toContain('_______');
        expect(paragraphs).not.toContain('Date: _______');
        expect(paragraphs.join('\n')).not.toContain('{FOR ');
        expect(paragraphs.join('\n')).not.toContain('{END-FOR ');
        expect(paragraphs.join('\n')).not.toContain('{$member.name}');
        expect(paragraphs.join('\n')).not.toContain('Note: The following resolutions');

        for (let i = 1; i <= signerCount; i++) {
          expect(paragraphs).toContain(`Director ${i}`);
        }
      }
    );

    it.openspec('OA-FIL-024')(
      `renders stockholder consent with exactly ${signerCount} signature blocks from Contract IR output`,
      async () => {
        const paragraphs = await fillStockholderConsent(signerCount);

        expect(paragraphs.filter((paragraph) => paragraph === '______________________________')).toHaveLength(
          signerCount
        );
        expect(paragraphs.filter((paragraph) => paragraph === 'Date: April 16, 2026')).toHaveLength(
          signerCount
        );
        expect(paragraphs).not.toContain('_______');
        expect(paragraphs).not.toContain('Date: _______');
        expect(paragraphs.join('\n')).not.toContain('{FOR ');
        expect(paragraphs.join('\n')).not.toContain('{END-FOR ');
        expect(paragraphs.join('\n')).not.toContain('{$stockholder.name}');

        for (let i = 1; i <= signerCount; i++) {
          expect(paragraphs).toContain(`Stockholder ${i}`);
        }
      }
    );
  }
});
