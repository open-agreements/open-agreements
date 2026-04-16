import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { afterAll, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { loadContractIrTemplate, renderContractIrTemplate } from '../scripts/contract_ir/index.mjs';
import { fillTemplate } from '../src/core/engine.js';
import { loadMetadata } from '../src/core/metadata.js';

const it = itAllure.epic('Filling & Rendering');
const TEMPLATE_DIR = join(import.meta.dirname, '..', 'content', 'templates', 'cooley-board-consent-safe');
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

function writeFixtureTemplate(
  mutator: (content: string) => string,
  templateName = 'invalid-contract-ir-fixture'
): string {
  const dir = mkdtempSync(join(tmpdir(), `${templateName}-`));
  tempDirs.push(dir);

  writeFileSync(
    join(dir, 'content.md'),
    mutator(readFileSync(join(TEMPLATE_DIR, 'content.md'), 'utf-8')),
    'utf-8'
  );
  writeFileSync(
    join(dir, 'schema.yaml'),
    readFileSync(join(TEMPLATE_DIR, 'schema.yaml'))
  );
  writeFileSync(
    join(dir, 'styles.yaml'),
    readFileSync(join(TEMPLATE_DIR, 'styles.yaml'))
  );

  return dir;
}

describe('Contract IR SAFE board consent', () => {
  it.openspec('OA-TMP-022')('loads Contract IR content with external schema and style registries', () => {
    const template = loadContractIrTemplate(TEMPLATE_DIR);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(template.frontmatter.template_id).toBe('cooley-board-consent-safe');
    expect(template.schemaRegistry.schema_id).toBe('cooley-board-consent-safe-v1');
    expect(template.styleRegistry.style_id).toBe('cooley-board-consent-safe-v1');
    expect(template.blocks.some((block) => block.blockStyle === 'note')).toBe(true);
    expect(
      template.blocks.filter((block) => block.type === 'heading' && block.level === 2)
    ).toHaveLength(2);

    expect(
      new Set(Object.keys(template.schemaRegistry.variables))
    ).toEqual(new Set(metadata.fields.map((field) => field.name)));
  });

  it.openspec('OA-TMP-023')('rejects unknown variables, unknown styles, and malformed style tags', () => {
    const unknownVariableDir = writeFixtureTemplate((content) =>
      content.replace('{{purchase_amount}}', '{{missing_amount}}')
    );
    expect(() => loadContractIrTemplate(unknownVariableDir)).toThrow(/Unknown variable "missing_amount"/);

    const unknownStyleDir = writeFixtureTemplate((content) =>
      content.replace('{style=note}', '{style=unknown-style}')
    );
    expect(() => loadContractIrTemplate(unknownStyleDir)).toThrow(/Unknown block style slug "unknown-style"/);

    const malformedStyleDir = writeFixtureTemplate((content) =>
      content.replace('{style=note}', '{style=note')
    );
    expect(() => loadContractIrTemplate(malformedStyleDir)).toThrow(/Malformed \{style=slug\} tag/);

    const malformedInlineStyleDir = writeFixtureTemplate((content) =>
      `${content}\n\nThis clause contains {SAFE}{style=defined-term.\n`
    );
    expect(() => loadContractIrTemplate(malformedInlineStyleDir)).toThrow(/Malformed \{style=slug\} tag|Malformed inline \{style=slug\} tag/);
  });

  it.openspec('OA-TMP-024')('renders DOCX and Markdown from the same normalized Contract IR model', async () => {
    const { buffer, markdown } = await renderContractIrTemplate(TEMPLATE_DIR);
    const xml = new AdmZip(buffer).getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
    const stylesXml = new AdmZip(buffer).getEntry('word/styles.xml')?.getData().toString('utf-8') ?? '';

    expect(buffer.length).toBeGreaterThan(5_000);
    expect(markdown).toContain('# ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF {company_name}');
    expect(markdown).toContain('## Approval of SAFE Financing');
    expect(markdown).toContain('${purchase_amount}');
    expect(markdown).toContain('Date: {effective_date}');

    expect(xml).toContain('{company_name}');
    expect(xml).toContain('{purchase_amount}');
    expect(xml).toContain('{board_member_1_name}');
    expect(xml).toContain('Approval of SAFE Financing');
    expect(xml).toContain('[Signature Page Follows]');
    expect(xml).toContain('w:pgSz w:w="12240" w:h="15840"');
    expect(xml).toContain('w:br w:type="page"');
    expect(xml).toContain('w:pStyle w:val="Normal"');
    expect(xml).toContain('w:pStyle w:val="OAHeading2"');
    expect(xml).toContain('w:pStyle w:val="OABlockNote"');
    expect(stylesXml).toContain('w:styleId="Normal"');
    expect(stylesXml).toContain('w:styleId="OAHeading2"');
    expect(stylesXml).toContain('w:styleId="OABlockNote"');
    expect(stylesXml).toContain('w:styleId="OABlockSignatureFollow"');
    expect(stylesXml).toContain('Times New Roman');
  });

  it.openspec('OA-TMP-025')('preserves source text, placeholders, and signature structure relative to Joey’s current source', async () => {
    const referencePath = join(TEMPLATE_DIR, 'reference-source.docx');
    const { buffer } = await renderContractIrTemplate(TEMPLATE_DIR);

    const generatedText = normalizeText(extractDocxText(buffer));
    const referenceText = normalizeText(extractDocxText(referencePath));

    expect(generatedText).toBe(referenceText);
    expect(generatedText).toContain('ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF {company_name}');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toContain('General Authorizing Resolution');
    expect(generatedText).toContain('{board_member_1_name}');
    expect(generatedText).toContain('{board_member_2_name}');
    expect(generatedText).toContain('{board_member_3_name}');
  });

  it.openspec('OA-TMP-025')('removes the introductory note from filled output via clean.json', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'cooley-board-fill-'));
    tempDirs.push(outputDir);
    const outputPath = join(outputDir, 'filled.docx');

    await fillTemplate({
      templateDir: TEMPLATE_DIR,
      outputPath,
      values: {
        company_name: 'Acme Labs, Inc.',
        effective_date: 'April 15, 2026',
        purchase_amount: '500,000',
        board_member_1_name: 'Alex Director',
        board_member_2_name: 'Blair Director',
        board_member_3_name: 'Casey Director',
      },
    });

    const filledText = normalizeText(extractDocxText(outputPath));
    expect(filledText).not.toContain('Note: The following resolutions');
    expect(filledText).toContain('ACTION BY UNANIMOUS WRITTEN CONSENT OF THE BOARD OF DIRECTORS OF Acme Labs, Inc.');
    expect(filledText).toContain('Approval of SAFE Financing');
  });
});
