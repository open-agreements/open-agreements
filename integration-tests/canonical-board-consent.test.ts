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

function extractStylesXml(docxPathOrBuffer: string | Buffer): string {
  const zip = typeof docxPathOrBuffer === 'string'
    ? new AdmZip(docxPathOrBuffer)
    : new AdmZip(docxPathOrBuffer);
  const stylesXml = zip.getEntry('word/styles.xml');
  if (!stylesXml) {
    throw new Error('word/styles.xml not found in DOCX');
  }
  return stylesXml.getData().toString('utf-8');
}

function extractStyleBlock(stylesXml: string, styleId: string): string {
  const re = new RegExp(
    `<w:style[^>]*w:styleId="${styleId}"[^>]*>([\\s\\S]*?)</w:style>`
  );
  const match = stylesXml.match(re);
  if (!match) {
    throw new Error(`style ${styleId} not found in styles.xml`);
  }
  return match[0];
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
  it.openspec(['OA-TMP-059', 'OA-TMP-047', 'OA-TMP-056'])('compiles canonical board consent source and metadata', () => {
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(compiled.contractSpec.template_id).toBe('openagreements-board-consent-safe');
    expect(compiled.contractSpec.layout_id).toBe('traditional-consent-v1');
    expect(compiled.contractSpec.document.version).toBe('0.1.2');
    expect(compiled.contractSpec.document.opening_note).toBeTruthy();
    expect(compiled.contractSpec.document.opening_recital).toContain('Section 141(f)');
    expect(compiled.contractSpec.sections.cover_terms).toBeUndefined();
    expect(compiled.contractSpec.sections.recitals).toMatchObject({
      heading_title: 'Recitals',
    });
    expect(compiled.contractSpec.sections.standard_terms.heading_title).toBe('Resolutions');
    expect(compiled.contractSpec.sections.signature).toMatchObject({
      heading_title: 'Signatures',
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

  it.openspec(['OA-TMP-059', 'OA-TMP-046', 'OA-TMP-048', 'OA-TMP-056'])('renders DOCX from the canonical board consent source with traditional structure', async () => {
    const style = loadStyleProfile(STYLE_PATH);
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const generatedText = normalizeText(extractDocxText(buffer));
    const generatedXml = extractDocxXml(buffer);

    // Title is centered all-caps with company_name placeholder preserved.
    expect(generatedText).toContain('ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF {company_name}');
    // The drafting note stays on the contract spec for MCP consumers but is deliberately
    // not painted onto the DOCX body — traditional consents (Cooley/Joey) carry no
    // in-document drafting note.
    expect(compiled.contractSpec.document.opening_note).toContain('Note: The following resolutions');
    expect(generatedText).not.toContain('Note: The following resolutions');
    expect(generatedText).toContain('pursuant to Section 141(f) of the Delaware General Corporation Law');
    expect(generatedText).toContain('Recitals');
    expect(generatedText).toContain('Resolutions');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toContain('General Authorizing Resolution');
    expect(generatedText).toContain('WHEREAS, the Board believes');
    expect(generatedText).toContain('RESOLVED, that each SAFE');
    expect(generatedText).toContain('RESOLVED FURTHER, that the officers');
    expect(generatedText).toContain('[Signature Page Follows]');
    expect(generatedText).toContain('Signatures');
    expect(generatedText).not.toContain('Standard Terms');

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

  it.openspec(['OA-TMP-059', 'OA-TMP-048', 'OA-TMP-056'])('fills board consent without leaving signer loop markers', async () => {
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
    expect(filledText).not.toContain('Note: The following resolutions');
    expect(filledText).toContain('pursuant to Section 141(f)');
    expect(filledText).toContain('Recitals');
    expect(filledText).toContain('Resolutions');
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
    expect(filledText).toContain('Signatures');

    // Negative: no cover table or modern artifacts.
    expect(filledXml).not.toMatch(/<w:tbl[\s>]/);
    expect(filledText).not.toContain('Cover Terms');
    expect(filledText).not.toContain('Cover Page controls');
    expect(filledText).not.toContain('Valuation Cap');
    expect(filledText).not.toContain('Discount Rate');
    expect(filledText).not.toContain('Governing Law');
  });

  it.openspec('OA-TMP-059')('rejects fills with empty board_members', async () => {
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

  it.openspec('OA-TMP-059')('rejects fills missing board_members entirely', async () => {
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

  // Apple Pages compatibility floor: see docs/contract-ir-safe-board-consent.md.
  // Pages drops or inherits paragraph properties unless every visible-text paragraph
  // references an explicit named style AND those styles carry their alignment / bold /
  // underline in styles.xml itself (not as inline direct formatting on the paragraph).
  // Failing to assert the *style properties* (not just pStyle presence) would let a
  // future regression to inline-centered headings on Normal sneak past CI.
  it.openspec(['OA-TMP-046', 'OA-TMP-048'])('renders Pages-compatible explicit-style tree (board)', async () => {
    const style = loadStyleProfile(STYLE_PATH);
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const stylesXml = extractStylesXml(buffer);
    const documentXml = extractDocxXml(buffer);

    // 1. Required named paragraph styles are defined in styles.xml.
    const normalBlock = extractStyleBlock(stylesXml, 'Normal');
    const titleBlock = extractStyleBlock(stylesXml, 'OATitle');
    const headingBlock = extractStyleBlock(stylesXml, 'OAClauseHeading');
    const sigFollowBlock = extractStyleBlock(stylesXml, 'OABlockSignatureFollow');

    // 2. Centered styles carry their own w:jc center INSIDE styles.xml. This is the
    // property that defends against the inline-alignment regression — Pages won't
    // honor inline w:jc on a Normal-styled paragraph.
    for (const [name, block] of [
      ['OATitle', titleBlock],
      ['OAClauseHeading', headingBlock],
      ['OABlockSignatureFollow', sigFollowBlock],
    ] as const) {
      expect(block, `${name} must declare w:jc center in styles.xml`).toMatch(/<w:jc w:val="center"\/>/);
      expect(block, `${name} must declare basedOn=Normal`).toMatch(/<w:basedOn w:val="Normal"\/>/);
      expect(block, `${name} must declare next=Normal`).toMatch(/<w:next w:val="Normal"\/>/);
    }

    // 3. OATitle is bold; OAClauseHeading is bold + underline. These live in the
    // style's run properties so they stick when applied via pStyle alone.
    expect(titleBlock, 'OATitle must declare bold in styles.xml').toMatch(/<w:b\/>/);
    expect(headingBlock, 'OAClauseHeading must declare bold in styles.xml').toMatch(/<w:b\/>/);
    expect(headingBlock, 'OAClauseHeading must declare underline in styles.xml').toMatch(/<w:u /);

    // 4. Normal carries the body-after spacing so paragraphs don't render flush.
    expect(normalBlock, 'Normal must define non-zero spacing-after').toMatch(/<w:spacing[^>]*w:after="(?!0")\d+"/);

    // 5. Every visible-text <w:p> in document.xml carries an explicit pStyle.
    // Section-break carrier paragraphs (only <w:sectPr>) are excluded.
    const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
    const unstyled: string[] = [];
    let visibleTextParas = 0;
    let m: RegExpExecArray | null;
    while ((m = paraRegex.exec(documentXml)) !== null) {
      const para = m[0];
      const hasText = /<w:t[^>]*>[^<]/.test(para);
      if (!hasText) continue;
      visibleTextParas++;
      if (!/<w:pStyle /.test(para)) {
        const text = para.match(/<w:t[^>]*>([^<]+)/)?.[1] ?? '';
        unstyled.push(text.slice(0, 80));
      }
    }
    expect(unstyled, `every visible text <w:p> must reference a named style`).toEqual([]);
    expect(visibleTextParas).toBeGreaterThan(0);

    // 6. Specific paragraphs use the expected named styles. (Ordering: pPr precedes runs.)
    expect(documentXml).toMatch(
      /<w:p>\s*<w:pPr><w:pStyle w:val="OATitle"\/>[\s\S]*?ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF/
    );
    expect(documentXml).toMatch(
      /<w:pStyle w:val="OAClauseHeading"\/>[\s\S]*?Approval of SAFE Financing/
    );
    expect(documentXml).toMatch(
      /<w:pStyle w:val="OAClauseHeading"\/>[\s\S]*?General Authorizing Resolution/
    );
    expect(documentXml).toMatch(
      /<w:pStyle w:val="OABlockSignatureFollow"\/>[\s\S]*?\[Signature Page Follows\]/
    );
  });

  it.openspec('OA-TMP-059')('preserves PAGE and NUMPAGES footer field codes through fill', async () => {
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
