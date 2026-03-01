import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { validateExternal } from '../src/core/validation/external.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Compliance & Governance');
const tempDirs: string[] = [];
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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildDocx(text: string): Buffer {
  const zip = new AdmZip();
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

function writeMetadata(dir: string, sourceSha: string): void {
  writeFileSync(
    join(dir, 'metadata.yaml'),
    [
      'name: External Fixture',
      'source_url: https://example.com/external.docx',
      'version: "1.0"',
      'license: CC-BY-ND-4.0',
      'allow_derivatives: false',
      'attribution_text: Example attribution',
      `source_sha256: ${sourceSha}`,
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company',
      'required_fields: []',
      '',
    ].join('\n'),
    'utf-8'
  );
}

function createFixture(): { dir: string; docxBuffer: Buffer; docxSha: string } {
  const dir = mkdtempSync(join(tmpdir(), 'oa-external-validate-'));
  tempDirs.push(dir);
  const docxBuffer = buildDocx('[Company Name]');
  const docxSha = createHash('sha256').update(docxBuffer).digest('hex');
  return { dir, docxBuffer, docxSha };
}

describe('validateExternal negative scenarios', () => {
  it('fails when metadata is invalid', () => {
    const { dir } = createFixture();
    writeFileSync(join(dir, 'metadata.yaml'), 'name: Bad Fixture', 'utf-8');

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('metadata:');
  });

  it('fails when template.docx is missing', () => {
    const { dir } = createFixture();
    writeMetadata(dir, 'a'.repeat(64));

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('template.docx not found');
  });

  it('reports source hash mismatches', () => {
    const { dir, docxBuffer } = createFixture();
    writeMetadata(dir, 'f'.repeat(64));
    writeFileSync(join(dir, 'template.docx'), docxBuffer);
    writeFileSync(
      join(dir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('DOCX integrity check failed');
  });

  it('fails when replacements.json is missing', () => {
    const { dir, docxBuffer, docxSha } = createFixture();
    writeMetadata(dir, docxSha);
    writeFileSync(join(dir, 'template.docx'), docxBuffer);

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('replacements.json not found (required for external templates)');
  });

  it('requires replacements.json to be a JSON object', () => {
    const { dir, docxBuffer, docxSha } = createFixture();
    writeMetadata(dir, docxSha);
    writeFileSync(join(dir, 'template.docx'), docxBuffer);
    writeFileSync(join(dir, 'replacements.json'), '1', 'utf-8');

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('replacements.json must be a JSON object');
  });

  it('validates replacement value shape, safety, and loop prevention', () => {
    const { dir, docxBuffer, docxSha } = createFixture();
    writeMetadata(dir, docxSha);
    writeFileSync(join(dir, 'template.docx'), docxBuffer);
    writeFileSync(
      join(dir, 'replacements.json'),
      JSON.stringify(
        {
          '[Not String]': 123,
          '[No Tags]': 'plain text value',
          '[Unsafe]': '{#if hacked}',
          '[Loop]': '[Loop] {company_name}',
          'Label > [Company Name]': '{company_name} [Company Name]',
          '[Unknown Field]': '{unknown_field}',
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('must be a string');
    expect(result.errors.join(' ')).toContain('must contain at least one {identifier} tag');
    expect(result.errors.join(' ')).toContain('unsafe tag');
    expect(result.errors.join(' ')).toContain('contains the key itself');
    expect(result.errors.join(' ')).toContain('contains the search text');
    expect(result.warnings.join(' ')).toContain('Replacement target {unknown_field} not found in metadata fields');
  });

  it('fails when replacements.json cannot be parsed', () => {
    const { dir, docxBuffer, docxSha } = createFixture();
    writeMetadata(dir, docxSha);
    writeFileSync(join(dir, 'template.docx'), docxBuffer);
    writeFileSync(join(dir, 'replacements.json'), '{invalid json', 'utf-8');

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('replacements.json:');
  });

  it.openspec('OA-RCP-027')('fails when clean.json has invalid schema', () => {
    const { dir, docxBuffer, docxSha } = createFixture();
    writeMetadata(dir, docxSha);
    writeFileSync(join(dir, 'template.docx'), docxBuffer);
    writeFileSync(
      join(dir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(dir, 'clean.json'),
      JSON.stringify({ removeFootnotes: 'yes' }, null, 2),
      'utf-8'
    );

    const result = validateExternal(dir, 'fixture-external');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('clean.json: invalid format');
  });
});
