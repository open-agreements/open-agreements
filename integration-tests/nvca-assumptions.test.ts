import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanDocument } from '../src/core/recipe/cleaner.js';
import { normalizeBracketArtifacts } from '../src/core/recipe/bracket-normalizer.js';
import type { CleanConfig } from '../src/core/metadata.js';
import type { DeclarativeNormalizeConfig } from '../src/core/recipe/bracket-normalizer.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildDocx(paragraphs: string[]): Buffer {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const wordRels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

function readParagraphs(path: string): string[] {
  const zip = new AdmZip(path);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const out: string[] = [];
  for (const m of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const text = [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((entry) => entry[1])
      .join('')
      .trim();
    if (text) out.push(text);
  }
  return out;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

describe('NVCA assumptions regression', () => {
  it('clean step preserves bracket-prefixed headings while removing bracketed alternatives', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-nvca-assump-clean-'));
    tempDirs.push(dir);

    const input = join(dir, 'input.docx');
    const cleaned = join(dir, 'cleaned.docx');

    writeFileSync(
      input,
      buildDocx([
        '[Small Business Concern',
        '. The Company together with its affiliates is a [“small business concern”][“smaller business”] within the Small Business Act.]',
        '[Alternative 1: This drafting option should be removed]',
        '[Alternative 2: This drafting option should be removed]',
      ])
    );

    const cleanConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'content/recipes/nvca-stock-purchase-agreement/clean.json'), 'utf-8')
    ) as CleanConfig;

    await cleanDocument(input, cleaned, cleanConfig);
    const paragraphs = readParagraphs(cleaned);
    const joined = paragraphs.join('\n');

    expect(joined).toContain('[Small Business Concern');
    expect(joined).toContain('small business concern');
    expect(joined).not.toContain('Alternative 1');
    expect(joined).not.toContain('Alternative 2');
  });

  it('declarative normalize strips heading-leading brackets and trims unmatched trailing brackets', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-nvca-assump-normalize-'));
    tempDirs.push(dir);

    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    writeFileSync(
      input,
      buildDocx([
        '[Small Business Concern',
        '. The Company together with its affiliates is a [“small business concern”][“smaller business”] within the Small Business Act.]',
      ])
    );

    const normalizeConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'content/recipes/nvca-stock-purchase-agreement/normalize.json'), 'utf-8')
    ) as DeclarativeNormalizeConfig;

    await normalizeBracketArtifacts(input, output, {
      rules: normalizeConfig.paragraph_rules,
      fieldValues: {},
    });

    const paragraphs = readParagraphs(output);
    const heading = paragraphs.find((p) => p.includes('Small Business Concern')) ?? '';
    const clause = paragraphs.find((p) => p.includes('small business concern')) ?? '';

    expect(heading).toBe('Small Business Concern');
    expect(clause).toContain('[“small business concern”][“smaller business”]');
    expect(clause.endsWith(']')).toBe(false);
  });
});
