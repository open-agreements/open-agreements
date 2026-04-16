import { afterEach, describe, expect, it as vitestIt } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import yaml from 'js-yaml';
import { fillTemplate } from '../src/core/engine.js';

const it = itAllure.epic('Filling & Rendering');
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const WORD_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildDocxBuffer(paragraphTexts: string[]): Buffer {
  const paragraphs = paragraphTexts
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join('');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${paragraphs}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

function extractParagraphTexts(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const paragraphs = [...xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((match) => match[0]);
  return paragraphs
    .map((paragraph) => [...paragraph.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((match) => match[1]).join('').trim())
    .filter(Boolean);
}

function createTemplateFixture(
  fields: unknown[],
  paragraphTexts: string[],
  priorityFieldNames: string[] = ['signer_1_name'],
): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-variable-signers-'));
  tempDirs.push(dir);

  const metadata = {
    name: 'Variable Signer Fixture',
    source_url: 'https://example.com/template.docx',
    version: '1.0',
    license: 'CC0-1.0',
    allow_derivatives: true,
    attribution_text: 'Fixture template for variable signer rendering tests.',
    fields,
    priority_fields: priorityFieldNames,
  };

  writeFileSync(join(dir, 'metadata.yaml'), yaml.dump(metadata), 'utf-8');
  writeFileSync(join(dir, 'template.docx'), buildDocxBuffer(paragraphTexts));
  return dir;
}

describe('variable signer rendering', () => {
  vitestIt('reproduces the current dangling fixed-slot signature-block behavior', async () => {
    const templateDir = createTemplateFixture(
      [
        { name: 'signer_1_name', type: 'string', description: 'Signer 1 name' },
        { name: 'signer_1_date', type: 'date', description: 'Signer 1 date' },
        { name: 'signer_2_name', type: 'string', description: 'Signer 2 name' },
        { name: 'signer_2_date', type: 'date', description: 'Signer 2 date' },
        { name: 'signer_3_name', type: 'string', description: 'Signer 3 name' },
        { name: 'signer_3_date', type: 'date', description: 'Signer 3 date' },
      ],
      [
        '_______',
        '{signer_1_name}',
        'Date: {signer_1_date}',
        '_______',
        '{signer_2_name}',
        'Date: {signer_2_date}',
        '_______',
        '{signer_3_name}',
        'Date: {signer_3_date}',
      ],
      ['signer_1_name'],
    );

    const outputPath = join(templateDir, 'output.docx');
    await fillTemplate({
      templateDir,
      outputPath,
      values: {
        signer_1_name: 'Alice Johnson',
        signer_1_date: '2026-04-14',
      },
    });

    const paragraphs = extractParagraphTexts(outputPath);
    expect(paragraphs).toContain('Date: _______');
    expect(paragraphs.filter((paragraph) => paragraph === '_______').length).toBeGreaterThan(1);
  });

  it.openspec('OA-FIL-023')('prunes optional fixed signer slots wrapped in IF blocks', async () => {
    const templateDir = createTemplateFixture(
      [
        { name: 'signer_1_name', type: 'string', description: 'Signer 1 name' },
        { name: 'signer_1_date', type: 'date', description: 'Signer 1 date' },
        { name: 'signer_2_name', type: 'string', description: 'Signer 2 name', default: '' },
        { name: 'signer_2_date', type: 'date', description: 'Signer 2 date' },
        { name: 'signer_3_name', type: 'string', description: 'Signer 3 name', default: '' },
        { name: 'signer_3_date', type: 'date', description: 'Signer 3 date' },
      ],
      [
        '_______',
        '{signer_1_name}',
        'Date: {signer_1_date}',
        '{IF signer_2_name}',
        '_______',
        '{signer_2_name}',
        'Date: {signer_2_date}',
        '{END-IF}',
        '{IF signer_3_name}',
        '_______',
        '{signer_3_name}',
        'Date: {signer_3_date}',
        '{END-IF}',
      ],
      ['signer_1_name'],
    );

    const outputPath = join(templateDir, 'pruned-output.docx');
    await fillTemplate({
      templateDir,
      outputPath,
      values: {
        signer_1_name: 'Alice Johnson',
        signer_1_date: '2026-04-14',
      },
    });

    const paragraphs = extractParagraphTexts(outputPath);
    expect(paragraphs).toEqual([
      '_______',
      'Alice Johnson',
      'Date: 2026-04-14',
    ]);
    expect(paragraphs).not.toContain('Date: _______');
  });

  it.openspec('OA-FIL-024')('renders exact signer-block counts from a signers array loop', async () => {
    const templateDir = createTemplateFixture(
      [
        {
          name: 'signers',
          type: 'array',
          description: 'Signers on the document',
          items: [
            { name: 'name', type: 'string', description: 'Printed signer name' },
          ],
        },
      ],
      [
        '{FOR signer IN signers}',
        '_______',
        '{$signer.name}',
        'Date: 2026-04-14',
        '{END-FOR signer}',
      ],
      [],
    );

    for (const signerCount of [1, 3, 7]) {
      const outputPath = join(templateDir, `loop-${signerCount}.docx`);
      await fillTemplate({
        templateDir,
        outputPath,
        values: {
          signers: Array.from({ length: signerCount }, (_value, index) => ({
            name: `Signer ${index + 1}`,
          })),
        },
      });

      const paragraphs = extractParagraphTexts(outputPath);
      expect(paragraphs.filter((paragraph) => paragraph === '_______')).toHaveLength(signerCount);
      expect(paragraphs.filter((paragraph) => paragraph === 'Date: 2026-04-14')).toHaveLength(signerCount);
      expect(paragraphs).not.toContain('Date: _______');
      expect(paragraphs.join('\n')).not.toContain('{FOR');
      expect(paragraphs.join('\n')).not.toContain('{END-FOR');
      expect(paragraphs.join('\n')).not.toContain('{$signer.name}');
    }
  });
});
