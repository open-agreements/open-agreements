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
const TEMPLATE_DIR = join(
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
  templateName = 'invalid-stockholder-contract-ir-fixture'
): string {
  const dir = mkdtempSync(join(tmpdir(), `${templateName}-`));
  tempDirs.push(dir);

  writeFileSync(
    join(dir, 'template.md'),
    mutator(readFileSync(join(TEMPLATE_DIR, 'template.md'), 'utf-8')),
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

describe('Contract IR SAFE stockholder consent', () => {
  it.openspec('OA-TMP-029')('loads Contract IR stockholder consent with external schema and style registries', () => {
    const template = loadContractIrTemplate(TEMPLATE_DIR);
    const metadata = loadMetadata(TEMPLATE_DIR);

    expect(template.frontmatter.template_id).toBe('openagreements-stockholder-consent-safe');
    expect(template.schemaRegistry.schema_id).toBe('openagreements-stockholder-consent-safe-v1');
    expect(template.styleRegistry.style_id).toBe('openagreements-stockholder-consent-safe-v1');
    expect(template.blocks.some((block) => block.blockStyle === 'note')).toBe(true);
    expect(
      template.blocks.filter((block) => block.type === 'heading' && block.level === 2)
    ).toHaveLength(2);

    expect(
      new Set(Object.keys(template.schemaRegistry.variables))
    ).toEqual(new Set(metadata.fields.map((field) => field.name)));
  });

  it.openspec('OA-TMP-030')('rejects bad stockholder consent variables, styles, and malformed style tags', () => {
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

  it.openspec('OA-TMP-031')('renders DOCX and Markdown for the stockholder consent from the same normalized Contract IR model', async () => {
    const { buffer, markdown } = await renderContractIrTemplate(TEMPLATE_DIR);
    const zip = new AdmZip(buffer);
    const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
    const stylesXml = zip.getEntry('word/styles.xml')?.getData().toString('utf-8') ?? '';
    const headerXml = zip.getEntry('word/header1.xml')?.getData().toString('utf-8') ?? '';
    const footerXml = zip.getEntry('word/footer1.xml')?.getData().toString('utf-8') ?? '';
    const relsXml = zip.getEntry('word/_rels/document.xml.rels')?.getData().toString('utf-8') ?? '';

    expect(buffer.length).toBeGreaterThan(5_000);
    expect(markdown).toContain('# ACTION BY WRITTEN CONSENT OF THE STOCKHOLDERS OF {company_name}');
    expect(markdown).toContain('## Approval of SAFE Financing');
    expect(markdown).toContain('${purchase_amount}');
    expect(markdown).toContain('Date: {effective_date}');

    expect(xml).toContain('{company_name}');
    expect(xml).toContain('{purchase_amount}');
    expect(xml).toContain('{FOR stockholder IN stockholders}');
    expect(xml).toContain('{$stockholder.name}');
    expect(xml).toContain('{END-FOR stockholder}');
    expect(xml).toContain('Approval of SAFE Financing');
    expect(xml).toContain('Section 228 of the Delaware General Corporation Law');
    expect(xml).toContain('[Signature Page Follows]');
    expect(xml).toContain('w:pgSz w:w="12240" w:h="15840"');
    expect(xml).toContain('w:br w:type="page"');
    expect(xml).toContain('w:headerReference w:type="first"');
    expect(xml).toContain('w:footerReference w:type="default"');
    expect(xml).toContain('w:footerReference w:type="first"');
    expect(xml).toContain('w:titlePg');
    expect(xml).toContain('w:pStyle w:val="Normal"');
    expect(xml).toContain('w:pStyle w:val="OAHeading2"');
    expect(xml).toContain('w:pStyle w:val="OABlockNote"');
    expect(stylesXml).toContain('w:styleId="Normal"');
    expect(stylesXml).toContain('w:styleId="OAHeading2"');
    expect(stylesXml).toContain('w:styleId="OABlockNote"');
    expect(stylesXml).toContain('w:styleId="OABlockSignatureFollow"');
    expect(stylesXml).toContain('Times New Roman');
    expect(headerXml).toContain('STOCKHOLDER CONSENT FOR APPROVING SAFE (DELAWARE)');
    expect(headerXml).toContain('107087');
    expect(footerXml).toContain('Stockholder Consent for SAFE Financing (v1.0). Free to use under CC BY 4.0.');
    expect(relsXml).toContain('header1.xml');
    expect(relsXml).toContain('footer1.xml');
    expect(relsXml).toContain('footer2.xml');
  });

  it.openspec('OA-TMP-026')('preserves stockholder consent source text and uses loop-based signature structure', async () => {
    const { buffer } = await renderContractIrTemplate(TEMPLATE_DIR);

    const generatedText = normalizeText(extractDocxText(buffer));

    expect(generatedText).toContain('ACTION BY WRITTEN CONSENT OF THE STOCKHOLDERS OF {company_name}');
    expect(generatedText).toContain('Approval of SAFE Financing');
    expect(generatedText).toContain('General Authorizing Resolution');
    expect(generatedText).toContain('Section 228 of the Delaware General Corporation Law');
    expect(generatedText).toContain('60 days from the earliest date of delivery of this Action by Written Consent');
    expect(generatedText).toContain('{FOR stockholder IN stockholders}');
    expect(generatedText).toContain('{$stockholder.name}');
    expect(generatedText).toContain('{END-FOR stockholder}');
    expect(generatedText).not.toContain('{stockholder_1_name}');
  });

  it.openspec('OA-TMP-027')('removes the introductory note from filled stockholder consent output via clean.json', async () => {
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
    expect(filledText).not.toContain('Note: The following resolutions');
    expect(filledText).toContain('ACTION BY WRITTEN CONSENT OF THE STOCKHOLDERS OF Acme Labs, Inc.');
    expect(filledText).toContain('Approval of SAFE Financing');
    expect(filledText).toContain('60 days from the earliest date of delivery of this Action by Written Consent');
  });

  it.openspec('OA-TMP-027')('preserves PAGE and NUMPAGES footer field codes through fill', async () => {
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

    expect(footerXml).toContain('Stockholder Consent for SAFE Financing (v1.0). Free to use under CC BY 4.0.');
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/);
    expect(footerXml).toMatch(/<w:instrText[^>]*>\s*NUMPAGES\s*<\/w:instrText>/);
  });
});
