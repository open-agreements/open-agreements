import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { verifyOutput, normalizeText } from '../src/core/recipe/verifier.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '</Types>';

function buildDocx(documentXml: string, additionalParts?: Record<string, string>): string {
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  if (additionalParts) {
    for (const [name, content] of Object.entries(additionalParts)) {
      zip.addFile(name, Buffer.from(content, 'utf-8'));
    }
  }
  const tempDir = mkdtempSync(join(tmpdir(), 'verifier-test-'));
  const docxPath = join(tempDir, 'test.docx');
  zip.writeZip(docxPath);
  return docxPath;
}

describe('normalizeText', () => {
  it('converts non-breaking spaces to regular spaces', () => {
    expect(normalizeText('hello\u00A0world')).toBe('hello world');
    expect(normalizeText('hello\u2007world')).toBe('hello world');
    expect(normalizeText('hello\u202Fworld')).toBe('hello world');
  });

  it('normalizes smart single quotes', () => {
    expect(normalizeText('\u2018hello\u2019')).toBe("'hello'");
    expect(normalizeText('\u2039hi\u203A')).toBe("'hi'");
  });

  it('normalizes smart double quotes', () => {
    expect(normalizeText('\u201Chello\u201D')).toBe('"hello"');
    expect(normalizeText('\u00ABhi\u00BB')).toBe('"hi"');
    expect(normalizeText('\u201Ahi\u201E')).toBe('"hi"');
  });

  it('collapses horizontal whitespace to single space', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
    expect(normalizeText('hello\t\tworld')).toBe('hello world');
  });

  it('preserves newlines', () => {
    expect(normalizeText('hello\nworld')).toBe('hello\nworld');
  });

  it('trims', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });
});

describe('verifyOutput', () => {
  it('skips empty string values', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Acme Corp</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    const result = await verifyOutput(
      docxPath,
      { company: 'Acme Corp', empty: '' },
      {}
    );

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    expect(valuesCheck?.passed).toBe(true);

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('skips whitespace-only values', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Acme Corp</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    const result = await verifyOutput(
      docxPath,
      { company: 'Acme Corp', space: '   ' },
      {}
    );

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    expect(valuesCheck?.passed).toBe(true);

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('matches with smart quotes normalized to straight', async () => {
    // Document contains smart quotes
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>\u201CHello World\u201D</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    // Input value uses straight quotes
    const result = await verifyOutput(
      docxPath,
      { greeting: '"Hello World"' },
      {}
    );

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    expect(valuesCheck?.passed).toBe(true);

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('matches with collapsed whitespace', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Hello   World</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    const result = await verifyOutput(
      docxPath,
      { greeting: 'Hello World' },
      {}
    );

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    expect(valuesCheck?.passed).toBe(true);

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('matches with non-breaking space', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Hello\u00A0World</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    const result = await verifyOutput(
      docxPath,
      { greeting: 'Hello World' },
      {}
    );

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    expect(valuesCheck?.passed).toBe(true);

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('finds values present only in header text', async () => {
    const docXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Body content</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const headerXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:hdr xmlns:w="${W_NS}">` +
      '<w:p><w:r><w:t>Acme Corp</w:t></w:r></w:p>' +
      '</w:hdr>';

    const docxPath = buildDocx(docXml, {
      'word/header1.xml': headerXml,
    });

    const result = await verifyOutput(
      docxPath,
      { company: 'Acme Corp' },
      {}
    );

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    expect(valuesCheck?.passed).toBe(true);

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});
