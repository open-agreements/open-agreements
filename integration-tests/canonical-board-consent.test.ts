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

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

describe('Canonical SAFE board consent', () => {
  it.openspec('OA-TMP-037')('compiles canonical board consent source and metadata', () => {
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(compiled.contractSpec.template_id).toBe('openagreements-board-consent-safe');
    expect(compiled.contractSpec.layout_id).toBe('cover-standard-signature-v1');
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
        'safe_valuation_cap',
        'safe_discount_rate',
        'safe_changes_to_standard_terms',
        'board_members',
      ])
    );
  });

  it.openspec('OA-TMP-037')('renders DOCX and Markdown from the canonical board consent source', async () => {
    const style = loadStyleProfile(STYLE_PATH);
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const generatedText = normalizeText(extractDocxText(buffer));

    expect(rendered.markdown).toContain('# Board Consent for SAFE Financing');
    expect(rendered.markdown).toContain('## Key Terms of Board Consent');
    expect(rendered.markdown).toContain('| **Company** | {company_name} |');
    expect(rendered.markdown).toContain('| **SAFE** | Simple Agreement for Future Equity ("SAFE") |');
    expect(rendered.markdown).toContain('| Valuation Cap (Post-Money) | {safe_valuation_cap} |');
    expect(rendered.markdown).toContain('| Discount Rate | {safe_discount_rate} |');
    expect(rendered.markdown).toContain('| Changes to Standard Terms | {safe_changes_to_standard_terms} |');
    expect(rendered.markdown).toContain('is referred to as the "Company"');
    expect(rendered.markdown).toContain('This Board Consent shall be filed with the minutes of the proceedings of the Board.');
    expect(rendered.markdown).toContain('By signing below, each director adopts this Board Consent');
    expect(rendered.markdown).toContain('solely in his or her capacity as a director of the Company, and not as a purchaser of any SAFE');
    expect(rendered.markdown).toContain('{FOR member IN board_members}');
    expect(rendered.markdown).toContain('{$member.name}');
    expect(rendered.markdown).toContain('Date: {effective_date}');
    expect(rendered.markdown).toContain('{END-FOR member}');

    expect(generatedText).toContain('Board Consent for SAFE Financing');
    expect(generatedText).toContain('Key Terms of Board Consent');
    expect(generatedText).toContain('Action by Written Consent of the Board');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toMatch(/is referred to as the (?:&quot;|")Company(?:&quot;|")/);
    expect(generatedText).toContain('This Board Consent shall be filed with the minutes of the proceedings of the Board.');
    expect(generatedText).toContain('By signing below, each director adopts this Board Consent');
    expect(generatedText).toContain('solely in his or her capacity as a director of the Company, and not as a purchaser of any SAFE');
    expect(generatedText).toContain('{FOR member IN board_members}');
    expect(generatedText).toContain('{$member.name}');
    expect(generatedText).toContain('{END-FOR member}');
  });

  it.openspec('OA-TMP-037')('fills board consent without leaving signer loop markers', async () => {
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
    expect(filledText).toContain('Board Consent for SAFE Financing');
    expect(filledText).toContain('Valuation Cap (Post-Money)');
    expect(filledText).toContain('None');
    expect(filledText).toContain('Approval of SAFE Financing');
    expect(filledText).toContain('Acme Labs, Inc.');
    expect(filledText).toMatch(/is referred to as the (?:&quot;|")Company(?:&quot;|")/);
    expect(filledText).toContain('This Board Consent shall be filed with the minutes of the proceedings of the Board.');
    expect(filledText).toContain('By signing below, each director adopts this Board Consent');
    expect(filledText).toContain('solely in his or her capacity as a director of the Company, and not as a purchaser of any SAFE');
    expect(filledText).toContain('Alex Director');
    expect(filledText).toContain('Blair Director');
    expect(filledText).toContain('Casey Director');
    expect(filledText.match(/Print Name:/g)?.length).toBe(3);
    expect(filledText.match(/^Director$/gm)?.length).toBe(3);
    expect(filledText).not.toContain('{FOR ');
    expect(filledText).not.toContain('{END-FOR ');
    expect(filledText).not.toContain('{$member.name}');
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

    expect(footerXml).toContain('OpenAgreements Board Consent for SAFE Financing (v1.1). Free to use under CC BY 4.0.');
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/);
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*NUMPAGES\s*<\/w:instrText>/);
  });
});
