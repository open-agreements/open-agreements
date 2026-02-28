import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';
import { validateOutput } from '../src/core/validation/output.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

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

const tempDirs: string[] = [];
const it = itAllure.epic('Verification & Drift');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildDocx(headingCount: number): Buffer {
  const headings = Array.from({ length: headingCount }, (_, index) =>
    `<w:p><w:pPr><w:pStyle w:val="Heading${(index % 3) + 1}"/></w:pPr><w:r><w:t>H${index + 1}</w:t></w:r></w:p>`
  ).join('');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${headings}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

function buildDocxWithoutDocumentXml(): Buffer {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  return zip.toBuffer();
}

function writeDocxPair(sourceHeadingCount: number, outputHeadingCount: number): { sourcePath: string; outputPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'oa-output-validate-'));
  tempDirs.push(dir);
  const sourcePath = join(dir, 'source.docx');
  const outputPath = join(dir, 'output.docx');
  writeFileSync(sourcePath, buildDocx(sourceHeadingCount));
  writeFileSync(outputPath, buildDocx(outputHeadingCount));
  return { sourcePath, outputPath };
}

describe('validateOutput', () => {
  it.openspec(['OA-ENG-003', 'OA-RCP-019'])('compares heading counts from extracted document XML', async () => {
    await allureParameter('source_headings', '2');
    await allureParameter('output_headings', '2');

    const { sourcePath, outputPath } = await allureStep('Build source/output fixture pair', () =>
      writeDocxPair(2, 2)
    );
    const result = await allureStep('Validate output structure', () =>
      validateOutput(sourcePath, outputPath)
    );
    await allureJsonAttachment('validate-output-result.json', result);

    await allureStep('Assert heading counts match', () => {
      expect(result.valid).toBe(true);
      expect(result.sourceHeadingCount).toBe(2);
      expect(result.outputHeadingCount).toBe(2);
    });
  });

  it.openspec('OA-RCP-020')('detects structural drift when heading counts differ', async () => {
    await allureParameter('source_headings', '3');
    await allureParameter('output_headings', '2');

    const { sourcePath, outputPath } = await allureStep('Build source/output fixture pair', () =>
      writeDocxPair(3, 2)
    );
    const result = await allureStep('Validate output structure', () =>
      validateOutput(sourcePath, outputPath)
    );
    await allureJsonAttachment('validate-output-result.json', result);

    await allureStep('Assert drift detection failure is reported', () => {
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Heading count mismatch');
    });
  });

  it('returns a read error when source/output files are not valid DOCX archives', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-output-invalid-archive-'));
    tempDirs.push(dir);
    const sourcePath = join(dir, 'source.docx');
    const outputPath = join(dir, 'output.docx');
    writeFileSync(sourcePath, Buffer.from('not-a-zip-archive'));
    writeFileSync(outputPath, Buffer.from('not-a-zip-archive'));

    const result = validateOutput(sourcePath, outputPath);

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Failed to read files');
    expect(result.sourceHeadingCount).toBe(0);
    expect(result.outputHeadingCount).toBe(0);
  });

  it('treats missing word/document.xml entries as zero headings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-output-missing-document-xml-'));
    tempDirs.push(dir);
    const sourcePath = join(dir, 'source.docx');
    const outputPath = join(dir, 'output.docx');
    writeFileSync(sourcePath, buildDocxWithoutDocumentXml());
    writeFileSync(outputPath, buildDocxWithoutDocumentXml());

    const result = validateOutput(sourcePath, outputPath);

    expect(result.valid).toBe(true);
    expect(result.sourceHeadingCount).toBe(0);
    expect(result.outputHeadingCount).toBe(0);
  });
});
