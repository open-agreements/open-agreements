import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { runScan } from '../src/commands/scan.js';

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
const it = itAllure.epic('Discovery & Metadata');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

function writeDocxWithText(text: string): string {
  const zip = new AdmZip();
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;

  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));

  const dir = mkdtempSync(join(tmpdir(), 'oa-scan-'));
  tempDirs.push(dir);
  const path = join(dir, 'input.docx');
  writeFileSync(path, zip.toBuffer());
  return path;
}

describe('runScan', () => {
  it.openspec(['OA-ENG-004', 'OA-CLI-001'])('discovers bracketed placeholders in DOCX', () => {
    const input = writeDocxWithText('Party: [Company Name] and Date: [Effective Date]');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    runScan({ input });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('[Company Name]');
    expect(output).toContain('[Effective Date]');
  });

  it.openspec('OA-CLI-002')('writes draft replacements JSON', () => {
    const input = writeDocxWithText('Party: [Company Name] and Date: [Effective Date]');
    const outDir = mkdtempSync(join(tmpdir(), 'oa-scan-replacements-'));
    tempDirs.push(outDir);
    const outputReplacements = join(outDir, 'replacements.json');

    runScan({ input, outputReplacements });

    const replacements = JSON.parse(readFileSync(outputReplacements, 'utf-8'));
    expect(replacements['[Company Name]']).toBe('{company_name}');
    expect(replacements['[Effective Date]']).toBe('{effective_date}');
  });
});
