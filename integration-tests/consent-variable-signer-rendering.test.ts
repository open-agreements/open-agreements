import { afterAll, describe, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { itAllure } from './helpers/allure-test.js';
import { fillTemplate } from '../src/core/engine.js';
import { findTemplateDir } from '../src/utils/paths.js';

const it = itAllure.epic('Filling & Rendering');
const BOARD_TEMPLATE_DIR = findTemplateDir('openagreements-board-consent-safe');
if (!BOARD_TEMPLATE_DIR) throw new Error('openagreements-board-consent-safe template not found');
const STOCKHOLDER_TEMPLATE_DIR = findTemplateDir('openagreements-stockholder-consent-safe');
if (!STOCKHOLDER_TEMPLATE_DIR) throw new Error('openagreements-stockholder-consent-safe template not found');
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

/**
 * Behavioral (layout-agnostic) assertions: the consents are LE-authored
 * ("authored-wins"), so the signature-block ANATOMY is owned by the upstream
 * renderer and has legitimately changed across syncs — underscore signature
 * lines (OA-native traditional-consent-v1) became bordered table cells in the
 * LE render. What must hold in EVERY layout: one signature block per signer
 * (each signer's name exactly once), a per-signer date, and zero unfilled
 * docx-templates commands leaking into the document.
 */
function assertSignerBlocks(paragraphs: string[], names: string[], date: string): void {
  const fullText = paragraphs.join('\n');
  for (const name of names) {
    expect(
      paragraphs.filter((paragraph) => paragraph.includes(name)),
      `exactly one signature block for ${name}`
    ).toHaveLength(1);
  }
  const dateOccurrences = fullText.split(date).length - 1;
  expect(dateOccurrences, 'a filled date per signer').toBeGreaterThanOrEqual(names.length);
  // No unfilled fill-commands may survive: {FOR …}, {END-FOR …}, {$item.x},
  // {IF …}, or bare {field} tokens.
  expect(fullText).not.toMatch(/\{[^}\n]*\}/);
}

describe('SAFE consent variable signer rendering', () => {
  for (const signerCount of [1, 3, 7]) {
    it(`renders board consent with exactly ${signerCount} signature blocks`, async () => {
      const paragraphs = await fillBoardConsent(signerCount);
      const names = Array.from({ length: signerCount }, (_v, i) => `Director ${i + 1}`);
      assertSignerBlocks(paragraphs, names, 'April 16, 2026');
      // Out-of-range signers must not render (loop iterates the array exactly).
      expect(paragraphs.join('\n')).not.toContain(`Director ${signerCount + 1}`);
    });

    it(`renders stockholder consent with exactly ${signerCount} signature blocks`, async () => {
      const paragraphs = await fillStockholderConsent(signerCount);
      const names = Array.from({ length: signerCount }, (_v, i) => `Stockholder ${i + 1}`);
      assertSignerBlocks(paragraphs, names, 'April 16, 2026');
      expect(paragraphs.join('\n')).not.toContain(`Stockholder ${signerCount + 1}`);
    });
  }
});
