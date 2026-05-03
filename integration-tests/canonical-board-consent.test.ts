import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { Packer } from 'docx';
import { afterAll, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceFile } from '../scripts/template_renderer/canonical-source.mjs';
import { loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';
import { fillTemplate } from '../src/core/engine.js';
import { loadMetadata } from '../src/core/metadata.js';

const it = itAllure.epic('Filling & Rendering');
const REPO_ROOT = join(import.meta.dirname, '..');
const TEMPLATE_DIR = join(REPO_ROOT, 'content', 'templates', 'openagreements-board-consent-safe');
const SOURCE_PATH = join(TEMPLATE_DIR, 'template.md');
const STYLE_PATH = join(REPO_ROOT, 'scripts', 'template-specs', 'styles', 'openagreements-default-v1.json');
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function extractDocxText(docxPathOrBuffer: string | Buffer): string {
  const zip = typeof docxPathOrBuffer === 'string'
    ? new AdmZip(docxPathOrBuffer)
    : new AdmZip(docxPathOrBuffer);
  const documentXml = zip.getEntry('word/document.xml');
  if (!documentXml) {
    throw new Error('word/document.xml not found in DOCX');
  }

  const xml = documentXml.getData().toString('utf-8');
  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const textParts: string[] = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(paraXml)) !== null) {
      textParts.push(textMatch[1]);
    }
    if (textParts.length > 0) {
      paragraphs.push(textParts.join(''));
    }
  }

  return paragraphs.join('\n');
}

function extractDocxXml(docxPathOrBuffer: string | Buffer): string {
  const zip = typeof docxPathOrBuffer === 'string'
    ? new AdmZip(docxPathOrBuffer)
    : new AdmZip(docxPathOrBuffer);
  const documentXml = zip.getEntry('word/document.xml');
  if (!documentXml) {
    throw new Error('word/document.xml not found in DOCX');
  }
  return documentXml.getData().toString('utf-8');
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

describe('Canonical SAFE board consent (traditional)', () => {
  it.openspec(['OA-TMP-037', 'OA-TMP-047'])('compiles canonical board consent source and metadata', () => {
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(compiled.contractSpec.template_id).toBe('openagreements-board-consent-safe');
    expect(compiled.contractSpec.layout_id).toBe('traditional-consent-v1');
    expect(compiled.contractSpec.document.version).toBe('1.2');
    expect(compiled.contractSpec.document.opening_note).toBeTruthy();
    expect(compiled.contractSpec.document.opening_recital).toContain('Section 141(f)');
    expect(compiled.contractSpec.sections.cover_terms).toBeUndefined();
    expect(compiled.contractSpec.sections.signature).toMatchObject({
      mode: 'signers',
      arrangement: 'stacked',
      repeat: {
        collection_field: 'board_members',
        item_name: 'member',
      },
    });
    expect(new Set(metadata.fields.map((field) => field.name))).toEqual(
      new Set([
        'company_name',
        'effective_date',
        'purchase_amount',
        'board_members',
      ])
    );
  });

  it.openspec(['OA-TMP-032', 'OA-TMP-037', 'OA-TMP-046', 'OA-TMP-048'])('renders DOCX from the canonical board consent source with traditional structure', async () => {
    const style = loadStyleProfile(STYLE_PATH);
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const generatedText = normalizeText(extractDocxText(buffer));
    const generatedXml = extractDocxXml(buffer);

    // Title is centered all-caps with company_name placeholder preserved.
    expect(generatedText).toContain('ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF {company_name}');
    expect(generatedText).toContain('Note: The following resolutions do not cover all matters');
    expect(generatedText).toContain('pursuant to Section 141(f) of the Delaware General Corporation Law');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toContain('General Authorizing Resolution');
    expect(generatedText).toContain('WHEREAS, the Board believes');
    expect(generatedText).toContain('RESOLVED, that each SAFE');
    expect(generatedText).toContain('RESOLVED FURTHER, that the officers');
    expect(generatedText).toContain('[Signature Page Follows]');

    // Loop placeholders preserved before fill.
    expect(generatedText).toContain('{FOR member IN board_members}');
    expect(generatedText).toContain('{$member.name}');
    expect(generatedText).toContain('Date: {effective_date}');
    expect(generatedText).toContain('{END-FOR member}');

    // Negative structural anchors: no cover table, no productized labels, no modern language.
    expect(generatedXml).not.toMatch(/<w:tbl[\s>]/);
    expect(generatedText).not.toContain('Cover Terms');
    expect(generatedText).not.toContain('Key Terms of Board Consent');
    expect(generatedText).not.toContain('Cover Page controls');
    expect(generatedText).not.toContain('Valuation Cap');
    expect(generatedText).not.toContain('Discount Rate');
    expect(generatedText).not.toContain('solely in his or her capacity');
    expect(generatedText).not.toContain('Governing Law');
  });

  it.openspec(['OA-TMP-037', 'OA-TMP-048'])('fills board consent without leaving signer loop markers', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'board-consent-fill-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled.docx');

    await fillTemplate({
      templateDir: TEMPLATE_DIR,
      outputPath,
      values: {
        company_name: 'Acme Labs, Inc.',
        effective_date: 'April 15, 2026',
        purchase_amount: '500,000',
        board_members: [
          { name: 'Alex Director' },
          { name: 'Blair Director' },
          { name: 'Casey Director' },
        ],
      },
    });

    const filledText = normalizeText(extractDocxText(outputPath));
    const filledXml = extractDocxXml(outputPath);

    expect(filledText).toContain('ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF Acme Labs, Inc.');
    expect(filledText).toContain('Note: The following resolutions do not cover all matters');
    expect(filledText).toContain('pursuant to Section 141(f)');
    expect(filledText).toContain('Approval of SAFE Financing');
    expect(filledText).toContain('General Authorizing Resolution');
    expect(filledText).toContain('Acme Labs, Inc.');
    expect(filledText).toContain('Alex Director');
    expect(filledText).toContain('Blair Director');
    expect(filledText).toContain('Casey Director');
    // Joey/Cooley traditional places the bare name under the signature line — no "Print Name:" label.
    expect(filledText).not.toContain('Print Name:');
    expect(filledText.match(/Date: April 15, 2026/g)?.length).toBe(3);

    // No loop markers leak into the filled output.
    expect(filledText).not.toContain('{FOR ');
    expect(filledText).not.toContain('{END-FOR ');
    expect(filledText).not.toContain('{$member.name}');
    expect(filledText).not.toContain('{company_name}');

    // Negative: no cover table or modern artifacts.
    expect(filledXml).not.toMatch(/<w:tbl[\s>]/);
    expect(filledText).not.toContain('Cover Terms');
    expect(filledText).not.toContain('Cover Page controls');
    expect(filledText).not.toContain('Valuation Cap');
    expect(filledText).not.toContain('Discount Rate');
    expect(filledText).not.toContain('Governing Law');
  });

  it.openspec('OA-TMP-037')('rejects fills with empty board_members', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'board-consent-empty-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled.docx');

    await expect(
      fillTemplate({
        templateDir: TEMPLATE_DIR,
        outputPath,
        values: {
          company_name: 'Acme Labs, Inc.',
          effective_date: 'April 15, 2026',
          purchase_amount: '500,000',
          board_members: [],
        },
      })
    ).rejects.toThrow(/board_members/);
  });

  it.openspec('OA-TMP-037')('rejects fills missing board_members entirely', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'board-consent-missing-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled.docx');

    await expect(
      fillTemplate({
        templateDir: TEMPLATE_DIR,
        outputPath,
        values: {
          company_name: 'Acme Labs, Inc.',
          effective_date: 'April 15, 2026',
          purchase_amount: '500,000',
        },
      })
    ).rejects.toThrow(/board_members/);
  });

  it.openspec('OA-TMP-037')('preserves PAGE and NUMPAGES footer field codes through fill', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'board-consent-footer-fields-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled-footer.docx');

    await fillTemplate({
      templateDir: TEMPLATE_DIR,
      outputPath,
      values: {
        company_name: 'Acme Labs, Inc.',
        effective_date: 'April 15, 2026',
        purchase_amount: '500,000',
        board_members: [{ name: 'Alex Director' }],
      },
    });

    const zip = new AdmZip(outputPath);
    const footerXml = zip.getEntry('word/footer1.xml')?.getData().toString('utf-8') ?? '';

    expect(footerXml).toContain('OpenAgreements Board Consent for SAFE Financing (v1.2). Free to use under CC BY 4.0.');
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/);
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*NUMPAGES\s*<\/w:instrText>/);
  });
});
