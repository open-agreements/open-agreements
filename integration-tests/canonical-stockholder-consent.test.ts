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
const TEMPLATE_DIR = join(REPO_ROOT, 'content', 'templates', 'openagreements-stockholder-consent-safe');
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

describe('Canonical SAFE stockholder consent (traditional)', () => {
  it.openspec(['OA-TMP-038', 'OA-TMP-047'])('compiles canonical stockholder consent source and metadata', () => {
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(compiled.contractSpec.template_id).toBe('openagreements-stockholder-consent-safe');
    expect(compiled.contractSpec.layout_id).toBe('traditional-consent-v1');
    expect(compiled.contractSpec.document.version).toBe('1.2');
    expect(compiled.contractSpec.document.opening_recital).toContain('Section 228');
    expect(compiled.contractSpec.sections.cover_terms).toBeUndefined();
    expect(compiled.contractSpec.sections.signature).toMatchObject({
      mode: 'signers',
      arrangement: 'stacked',
      repeat: {
        collection_field: 'stockholders',
        item_name: 'stockholder',
      },
    });
    expect(new Set(metadata.fields.map((field) => field.name))).toEqual(
      new Set(['company_name', 'effective_date', 'purchase_amount', 'stockholders'])
    );
  });

  it.openspec(['OA-TMP-038', 'OA-TMP-046', 'OA-TMP-048'])('renders DOCX from the canonical stockholder consent source with traditional structure', async () => {
    const style = loadStyleProfile(STYLE_PATH);
    const compiled = compileCanonicalSourceFile(SOURCE_PATH);
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const generatedText = normalizeText(extractDocxText(buffer));
    const generatedXml = extractDocxXml(buffer);

    expect(generatedText).toContain('ACTION BY WRITTEN CONSENT OF THE STOCKHOLDERS OF {company_name}');
    expect(generatedText).toContain('Note: The following resolutions do not cover all matters');
    expect(generatedText).toContain('pursuant to Section 228 of the Delaware General Corporation Law');
    expect(generatedText).toContain('such later effectiveness shall not exceed 60 days');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toContain('General Authorizing Resolution');
    expect(generatedText).toContain('WHEREAS, the Company');
    expect(generatedText).toContain('RESOLVED, that each SAFE');
    expect(generatedText).toContain('[Signature Page Follows]');

    expect(generatedText).toContain('{FOR stockholder IN stockholders}');
    expect(generatedText).toContain('{$stockholder.name}');
    expect(generatedText).toContain('Date: {effective_date}');
    expect(generatedText).toContain('{END-FOR stockholder}');

    expect(generatedXml).not.toMatch(/<w:tbl[\s>]/);
    expect(generatedText).not.toContain('Cover Terms');
    expect(generatedText).not.toContain('Cover Page controls');
    expect(generatedText).not.toContain('Governing Law');
  });

  it.openspec(['OA-TMP-038', 'OA-TMP-048'])('fills stockholder consent without leaving signer loop markers', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'stockholder-consent-fill-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled.docx');

    await fillTemplate({
      templateDir: TEMPLATE_DIR,
      outputPath,
      values: {
        company_name: 'Acme Labs, Inc.',
        effective_date: 'April 15, 2026',
        purchase_amount: '500,000',
        stockholders: [
          { name: 'Alex Holder' },
          { name: 'Blair Holder' },
          { name: 'Casey Holder' },
        ],
      },
    });

    const filledText = normalizeText(extractDocxText(outputPath));
    const filledXml = extractDocxXml(outputPath);

    expect(filledText).toContain('ACTION BY WRITTEN CONSENT OF THE STOCKHOLDERS OF Acme Labs, Inc.');
    expect(filledText).toContain('Approval of SAFE Financing');
    expect(filledText).toContain('Acme Labs, Inc.');
    expect(filledText).toContain('Alex Holder');
    expect(filledText).toContain('Blair Holder');
    expect(filledText).toContain('Casey Holder');
    expect(filledText).not.toContain('Print Name:');
    expect(filledText.match(/Date: April 15, 2026/g)?.length).toBe(3);

    expect(filledText).not.toContain('{FOR ');
    expect(filledText).not.toContain('{END-FOR ');
    expect(filledText).not.toContain('{$stockholder.name}');
    expect(filledText).not.toContain('{company_name}');

    expect(filledXml).not.toMatch(/<w:tbl[\s>]/);
    expect(filledText).not.toContain('Cover Terms');
    expect(filledText).not.toContain('Cover Page controls');
    expect(filledText).not.toContain('Governing Law');
  });

  it.openspec('OA-TMP-038')('rejects fills with empty stockholders', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'stockholder-consent-empty-'));
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
          stockholders: [],
        },
      })
    ).rejects.toThrow(/stockholders/);
  });

  it.openspec('OA-TMP-038')('preserves PAGE and NUMPAGES footer field codes through fill', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'stockholder-consent-footer-fields-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled-footer.docx');

    await fillTemplate({
      templateDir: TEMPLATE_DIR,
      outputPath,
      values: {
        company_name: 'Acme Labs, Inc.',
        effective_date: 'April 15, 2026',
        purchase_amount: '500,000',
        stockholders: [{ name: 'Alex Holder' }],
      },
    });

    const zip = new AdmZip(outputPath);
    const footerXml = zip.getEntry('word/footer1.xml')?.getData().toString('utf-8') ?? '';

    expect(footerXml).toContain('OpenAgreements Stockholder Consent for SAFE Financing (v1.2). Free to use under CC BY 4.0.');
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/);
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*NUMPAGES\s*<\/w:instrText>/);
  });
});
