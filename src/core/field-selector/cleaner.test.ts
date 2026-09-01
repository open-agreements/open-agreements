import { describe, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { cleanDocument } from './cleaner.js';
import type { CleanConfig } from '../metadata.js';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';

const it = itAllure.epic('Cleaning & Normalization');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function buildTestDocxRaw(bodyXml: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cleaner-test-'));
  const path = join(dir, 'input.docx');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`, 'utf-8'));
  zip.writeZip(path);
  return path;
}

function buildTestDocx(paragraphs: string[]): string {
  const bodyContent = paragraphs
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join('');
  return buildTestDocxRaw(bodyContent);
}

function extractParaTexts(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return [];
  const xml = entry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const paras = doc.getElementsByTagNameNS(W_NS, 'p');
  const texts: string[] = [];
  for (let i = 0; i < paras.length; i++) {
    const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
    const parts: string[] = [];
    for (let j = 0; j < tElements.length; j++) {
      parts.push(tElements[j].textContent ?? '');
    }
    texts.push(parts.join(''));
  }
  return texts;
}

function extractDocXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  return entry ? entry.getData().toString('utf-8') : '';
}

describe('cleanDocument removeBeforePattern', () => {
  it('removes paragraphs before the anchor pattern', async () => {
    const inputPath = buildTestDocx([
      'COVER PAGE TITLE',
      '',
      'AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF Acme Corp',
      'Article content here',
    ]);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    const config: CleanConfig = {
      removeFootnotes: false,
      removeBeforePattern: '^AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF',
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    };

    await cleanDocument(inputPath, outputPath, config);
    const texts = extractParaTexts(outputPath);

    expect(texts).toEqual([
      'AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF Acme Corp',
      'Article content here',
    ]);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('no-ops when anchor pattern is not found', async () => {
    const inputPath = buildTestDocx([
      'First paragraph',
      'Second paragraph',
    ]);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    const config: CleanConfig = {
      removeFootnotes: false,
      removeBeforePattern: '^NONEXISTENT PATTERN',
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    };

    await cleanDocument(inputPath, outputPath, config);
    const texts = extractParaTexts(outputPath);

    expect(texts).toEqual([
      'First paragraph',
      'Second paragraph',
    ]);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('extracts removed content when guidance extraction is enabled', async () => {
    const inputPath = buildTestDocx([
      'Cover Title',
      'Cover Subtitle',
      'AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF Corp',
      'Body content',
    ]);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    const config: CleanConfig = {
      removeFootnotes: false,
      removeBeforePattern: '^AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF',
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    };

    const result = await cleanDocument(inputPath, outputPath, config, {
      extractGuidance: true,
      sourceHash: 'test',
      configHash: 'test',
    });

    expect(result.guidance).toBeDefined();
    expect(result.guidance!.entries.length).toBe(2);
    expect(result.guidance!.entries[0].text).toBe('Cover Title');
    expect(result.guidance!.entries[1].text).toBe('Cover Subtitle');

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('removes cover page sectPr (no lowerRoman numbering leak)', async () => {
    // Simulate cover page: P0 (title) + P1 (empty with sectPr) + P2 (real title)
    const bodyXml = [
      '<w:p><w:r><w:t>AMENDED AND RESTATEDCERTIFICATE OF INCORPORATION</w:t></w:r></w:p>',
      '<w:p><w:pPr><w:sectPr><w:pgNumType w:fmt="lowerRoman" w:start="1"/><w:titlePg/></w:sectPr></w:pPr></w:p>',
      '<w:p><w:r><w:t>AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF Acme Corp</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Body content</w:t></w:r></w:p>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    const config: CleanConfig = {
      removeFootnotes: false,
      removeBeforePattern: '^AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF',
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    };

    await cleanDocument(inputPath, outputPath, config);
    const texts = extractParaTexts(outputPath);

    // P0 and P1 (with sectPr) removed; P2 and body remain
    expect(texts).toEqual([
      'AMENDED AND RESTATEDCERTIFICATE OF INCORPORATIONOF Acme Corp',
      'Body content',
    ]);

    // Verify the lowerRoman sectPr was removed with P1
    const xml = extractDocXml(outputPath);
    expect(xml).not.toContain('lowerRoman');
    expect(xml).not.toContain('titlePg');

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('combines removeBeforePattern with removeParagraphPatterns', async () => {
    const inputPath = buildTestDocx([
      'Cover page',
      'REAL TITLE OF THE DOCUMENT',
      'Note to Drafter: remove this',
      'Keep this content',
    ]);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    const config: CleanConfig = {
      removeFootnotes: false,
      removeBeforePattern: '^REAL TITLE',
      removeParagraphPatterns: ['^Note to Drafter:'],
      removeRanges: [],
      clearParts: [],
    };

    await cleanDocument(inputPath, outputPath, config);
    const texts = extractParaTexts(outputPath);

    expect(texts).toEqual([
      'REAL TITLE OF THE DOCUMENT',
      'Keep this content',
    ]);

    rmSync(outputDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Issue #605: image-only and empty-structural artifact hardening
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '../../..');
// Real Common Paper template with a benign ~146-byte spacer drawing in word/header1.xml
const REAL_HEADER_DRAWING_TEMPLATE = join(
  ROOT,
  'templates/common-paper-cc-by-4.0/common-paper-mutual-nda/template.docx'
);
// Real Common Paper template whose first body paragraph is textless
const REAL_EMPTY_LEADING_PARA_TEMPLATE = join(
  ROOT,
  'templates/common-paper-cc-by-4.0/common-paper-amendment/template.docx'
);

function makeConfig(overrides: Partial<CleanConfig> = {}): CleanConfig {
  return {
    removeFootnotes: false,
    removeParagraphPatterns: [],
    removeRanges: [],
    clearParts: [],
    ...overrides,
  };
}

/** Copy a real DOCX, replacing one media part's bytes with a buffer of the given size. */
function withInflatedMedia(sourcePath: string, mediaEntryName: string, size: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'cleaner-inflate-'));
  const path = join(dir, 'inflated.docx');
  const source = new AdmZip(sourcePath);
  const out = new AdmZip();
  for (const entry of source.getEntries()) {
    if (entry.isDirectory || entry.entryName.endsWith('/')) continue;
    const data = entry.entryName === mediaEntryName
      ? Buffer.alloc(size, 0xab)
      : entry.getData();
    out.addFile(entry.entryName, data);
  }
  out.writeZip(path);
  return path;
}

function partXml(docxPath: string, entryName: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry(entryName);
  return entry ? entry.getData().toString('utf-8') : '';
}

function entryNames(docxPath: string): string[] {
  return new AdmZip(docxPath).getEntries().map((e) => e.entryName);
}

describe('cleanDocument removeHeaderFooterDrawings', () => {
  it('preserves benign small spacer drawings in a real Common Paper template', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(
      REAL_HEADER_DRAWING_TEMPLATE,
      outputPath,
      makeConfig({ removeHeaderFooterDrawings: true })
    );

    // The 146-byte spacer is far below the 50 KB default threshold — untouched
    expect(partXml(outputPath, 'word/header1.xml')).toContain('<w:drawing');
    expect(entryNames(outputPath)).toContain('word/media/image1.png');
    expect(partXml(outputPath, 'word/_rels/header1.xml.rels')).toContain('media/image1.png');

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('strips oversized header drawings plus orphaned rels and media (real template, inflated media)', async () => {
    // Reproduce the legal-explainer#1800 artifact class: same real Common Paper
    // header drawing XML, media inflated to the size of the ICA instructions PNG
    const inputPath = withInflatedMedia(
      REAL_HEADER_DRAWING_TEMPLATE,
      'word/media/image1.png',
      125 * 1024
    );
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeHeaderFooterDrawings: true }));

    const headerXml = partXml(outputPath, 'word/header1.xml');
    expect(headerXml).not.toContain('<w:drawing');
    expect(headerXml).not.toContain('r:embed');
    expect(partXml(outputPath, 'word/_rels/header1.xml.rels')).not.toContain('media/image1.png');
    expect(entryNames(outputPath)).not.toContain('word/media/image1.png');

    // Body must be untouched (document.xml copied verbatim)
    const inputDocXml = partXml(inputPath, 'word/document.xml');
    expect(partXml(outputPath, 'word/document.xml')).toEqual(inputDocXml);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('honors a headerFooterDrawingMinBytes override', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(
      REAL_HEADER_DRAWING_TEMPLATE,
      outputPath,
      makeConfig({ removeHeaderFooterDrawings: true, headerFooterDrawingMinBytes: 100 })
    );

    // 146-byte spacer exceeds the 100-byte override — stripped
    expect(partXml(outputPath, 'word/header1.xml')).not.toContain('<w:drawing');
    expect(entryNames(outputPath)).not.toContain('word/media/image1.png');

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('leaves oversized drawings alone when the flag is not set', async () => {
    const inputPath = withInflatedMedia(
      REAL_HEADER_DRAWING_TEMPLATE,
      'word/media/image1.png',
      125 * 1024
    );
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeFootnotes: true }));

    expect(partXml(outputPath, 'word/header1.xml')).toContain('<w:drawing');
    expect(entryNames(outputPath)).toContain('word/media/image1.png');

    rmSync(outputDir, { recursive: true, force: true });
  });
});

describe('cleanDocument removeEmptyLeadingParagraphs', () => {
  it('drops leading empty paragraphs and transplants sectPr header/footer references', async () => {
    const bodyXml = [
      // Leading empty paragraph (formatting only)
      '<w:p><w:pPr><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p>',
      // Empty paragraph holding a section break that carries header/footer refs
      '<w:p><w:pPr><w:sectPr>',
      '<w:headerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rId7"/>',
      '<w:footerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rId8"/>',
      '<w:pgSz w:w="12240" w:h="15840"/>',
      '</w:sectPr></w:pPr></w:p>',
      '<w:p><w:r><w:t>AGREEMENT TITLE</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Body content</w:t></w:r></w:p>',
      // Body-level sectPr with no header/footer references of its own
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeEmptyLeadingParagraphs: true }));

    expect(extractParaTexts(outputPath)).toEqual(['AGREEMENT TITLE', 'Body content']);

    // The removed section break's header/footer refs moved onto the body sectPr
    const xml = extractDocXml(outputPath);
    const bodySectPr = xml.slice(xml.lastIndexOf('<w:sectPr'));
    expect(bodySectPr).toContain('rId7');
    expect(bodySectPr).toContain('rId8');

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('does not overwrite header references the destination sectPr already defines', async () => {
    const bodyXml = [
      '<w:p><w:pPr><w:sectPr>',
      '<w:headerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rId7"/>',
      '</w:sectPr></w:pPr></w:p>',
      '<w:p><w:r><w:t>Content</w:t></w:r></w:p>',
      '<w:sectPr>',
      '<w:headerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rId9"/>',
      '</w:sectPr>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeEmptyLeadingParagraphs: true }));

    const xml = extractDocXml(outputPath);
    expect(xml).toContain('rId9');
    expect(xml).not.toContain('rId7'); // destination slot already occupied — no transplant

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('stops at the first content-bearing paragraph and keeps mid-document empties', async () => {
    const bodyXml = [
      '<w:p><w:pPr/></w:p>',
      '<w:p><w:r><w:t>First real paragraph</w:t></w:r></w:p>',
      '<w:p><w:pPr/></w:p>',
      '<w:p><w:r><w:t>Second real paragraph</w:t></w:r></w:p>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeEmptyLeadingParagraphs: true }));

    expect(extractParaTexts(outputPath)).toEqual([
      'First real paragraph',
      '', // mid-document empty paragraph retained
      'Second real paragraph',
    ]);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('treats an image-bearing textless leading paragraph as content (not removed)', async () => {
    const bodyXml = [
      '<w:p><w:r><w:drawing/></w:r></w:p>',
      '<w:p><w:r><w:t>Body</w:t></w:r></w:p>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeEmptyLeadingParagraphs: true }));

    expect(extractDocXml(outputPath)).toContain('<w:drawing');
    expect(extractParaTexts(outputPath)).toEqual(['', 'Body']);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('never empties the body entirely', async () => {
    const bodyXml = [
      '<w:p><w:pPr/></w:p>',
      '<w:p><w:pPr/></w:p>',
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeEmptyLeadingParagraphs: true }));

    expect(extractParaTexts(outputPath)).toEqual(['']);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('removes the textless leading paragraph of a real Common Paper template', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(
      REAL_EMPTY_LEADING_PARA_TEMPLATE,
      outputPath,
      makeConfig({ removeEmptyLeadingParagraphs: true })
    );

    // The amendment's first body child was a textless paragraph before a table;
    // after cleaning the body must start with the table
    const xml = extractDocXml(outputPath);
    const bodyStart = xml.indexOf('<w:body>') + '<w:body>'.length;
    expect(xml.slice(bodyStart, bodyStart + 7)).toBe('<w:tbl>');

    rmSync(outputDir, { recursive: true, force: true });
  });
});
