import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { Packer } from 'docx';
import { afterAll, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { loadContractSpec, loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';
import { fillTemplate } from '../src/core/engine.js';
import { loadMetadata } from '../src/core/metadata.js';

const it = itAllure.epic('Filling & Rendering');
const REPO_ROOT = join(import.meta.dirname, '..');
const TEMPLATE_DIR = join(REPO_ROOT, 'content', 'templates', 'openagreements-board-consent-safe');
const SPEC_PATH = join(TEMPLATE_DIR, 'template.json');
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

describe('JSON SAFE board consent', () => {
  it.openspec('OA-TMP-032')('loads board consent JSON spec and metadata', () => {
    const spec = loadContractSpec(SPEC_PATH);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(spec.template_id).toBe('openagreements-board-consent-safe');
    expect(spec.layout_id).toBe('cover-standard-signature-v1');
    expect(spec.sections.signature.repeat).toEqual({
      collection_field: 'board_members',
      item_name: 'member',
    });
    expect(new Set(metadata.fields.map((field) => field.name))).toEqual(
      new Set(['company_name', 'effective_date', 'purchase_amount', 'board_members'])
    );
  });

  it.openspec('OA-TMP-032')('renders DOCX and Markdown from the JSON spec with loop-backed signatures', async () => {
    const style = loadStyleProfile(STYLE_PATH);
    const spec = loadContractSpec(SPEC_PATH);
    const rendered = renderFromValidatedSpec(spec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const generatedText = normalizeText(extractDocxText(buffer));

    expect(rendered.markdown).toContain('# Board Consent for SAFE Financing');
    expect(rendered.markdown).toContain('| **Company** | {company_name} |');
    expect(rendered.markdown).toContain('{FOR member IN board_members}');
    expect(rendered.markdown).toContain('{$member.name}');
    expect(rendered.markdown).toContain('Date: {effective_date}');

    expect(generatedText).toContain('Board Consent for SAFE Financing');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toContain('Board Action Under Delaware Law');
    expect(generatedText).toContain('{FOR member IN board_members}');
    expect(generatedText).toContain('{$member.name}');
    expect(generatedText).toContain('{END-FOR member}');
  });

  it.openspec('OA-TMP-032')('fills board consent without leaving signer loop markers', async () => {
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
    expect(filledText).toContain('Approval of SAFE Financing');
    expect(filledText).toContain('Acme Labs, Inc.');
    expect(filledText).not.toContain('{FOR ');
    expect(filledText).not.toContain('{END-FOR ');
    expect(filledText).not.toContain('{$member.name}');
  });

  it.openspec('OA-TMP-032')('preserves PAGE and NUMPAGES footer field codes through fill', async () => {
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
