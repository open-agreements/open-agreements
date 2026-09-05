import { describe, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { cleanDocument } from './cleaner.js';
import { normalizeBracketArtifacts } from './bracket-normalizer.js';
import { scanDocxBrackets } from '../../commands/scan.js';
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

function addNotesPart(docxPath: string, kind: 'footnote' | 'endnote', ids: number[]): void {
  const zip = new AdmZip(docxPath);
  const plural = `${kind}s`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:${plural} xmlns:w="${W_NS}">${ids.map((id) =>
    `<w:${kind} w:id="${id}"><w:p><w:r><w:t>Note ${id}</w:t></w:r></w:p></w:${kind}>`,
  ).join('')}</w:${plural}>`;
  zip.addFile(`word/${plural}.xml`, Buffer.from(xml, 'utf-8'));
  zip.writeZip(docxPath);
}

describe('cleanDocument removeFootnotes inline references', () => {
  it('removes footnote and endnote reference-only runs and leaves scan/render views consistent', async () => {
    const inputPath = buildTestDocxRaw([
      '<w:p><w:r><w:t>Before</w:t></w:r>',
      '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="1"/></w:r>',
      '<w:r><w:t> and after</w:t></w:r>',
      '<w:r><w:rPr><w:rStyle w:val="EndnoteReference"/></w:rPr><w:endnoteReference w:id="2"/></w:r></w:p>',
    ].join(''));
    const outputPath = inputPath.replace('input.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeFootnotes: true }));

    const xml = extractDocXml(outputPath);
    expect(xml).not.toContain('footnoteReference');
    expect(xml).not.toContain('endnoteReference');
    expect(xml).not.toContain('FootnoteReference');
    expect(xml).not.toContain('EndnoteReference');
    expect(extractParaTexts(outputPath)).toEqual(['Before and after']);
    expect(scanDocxBrackets(outputPath).footnoteCount).toBe(0);

    rmSync(inputPath.replace('/input.docx', ''), { recursive: true, force: true });
  });

  it('preserves text, formatting, and non-reference content in mixed-content runs', async () => {
    const inputPath = buildTestDocxRaw([
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Kept</w:t>',
      '<w:footnoteReference w:id="1"/><w:tab/><w:endnoteReference w:id="2"/>',
      '<w:t> text</w:t></w:r></w:p>',
    ].join(''));
    const outputPath = inputPath.replace('input.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeFootnotes: true }));

    const xml = extractDocXml(outputPath);
    expect(xml).not.toMatch(/(?:footnote|endnote)Reference/);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:tab/>');
    expect(extractParaTexts(outputPath)).toEqual(['Kept text']);

    rmSync(inputPath.replace('/input.docx', ''), { recursive: true, force: true });
  });

  it('removes a legacy bookmark-backed superscript note marker before paragraph normalization (#765)', async () => {
    const inputPath = buildTestDocxRaw([
      '<w:p><w:pPr><w:jc w:val="both"/></w:pPr>',
      '<w:r><w:rPr><w:b/></w:rPr><w:t>[such time after consummation of an IPO as Rule 144 permits sale without registration;]</w:t></w:r>',
      '<w:r><w:t xml:space="preserve"> [and]</w:t></w:r>',
      '<w:bookmarkStart w:id="246" w:name="_Ref42252623"/>',
      '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>36</w:t></w:r>',
      '<w:bookmarkEnd w:id="246"/></w:p>',
    ].join(''));
    addNotesPart(inputPath, 'footnote', [36]);
    const outputPath = inputPath.replace('input.docx', 'output.docx');
    const normalizedPath = inputPath.replace('input.docx', 'normalized.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeFootnotes: true }));
    await normalizeBracketArtifacts(outputPath, normalizedPath, {
      rules: [{
        id: 'unwrap-registration-termination-rule-144',
        section_heading: '',
        ignore_heading: true,
        paragraph_contains: 'such time after consummation of an IPO',
        replacements: { '[': '', ']': '' },
        expected_min_matches: 1,
      }],
    });

    const xml = extractDocXml(normalizedPath);
    expect(xml).not.toMatch(/<w:t[^>]*>36<\/w:t>/);
    expect(xml).toContain('<w:jc w:val="both"/>');
    expect(xml).toContain('<w:b/>');
    expect(extractParaTexts(normalizedPath)).toEqual([
      'such time after consummation of an IPO as Rule 144 permits sale without registration; and',
    ]);
    rmSync(inputPath.replace('/input.docx', ''), { recursive: true, force: true });
  });

  it('preserves superscript numbers without a matching note identity or reference bookmark', async () => {
    const inputPath = buildTestDocxRaw([
      '<w:p><w:bookmarkStart w:id="8" w:name="_RefExponent"/>',
      '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r>',
      '<w:bookmarkEnd w:id="8"/>',
      '<w:r><w:t xml:space="preserve"> plus </w:t></w:r>',
      '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>36</w:t></w:r></w:p>',
    ].join(''));
    addNotesPart(inputPath, 'footnote', [36]);
    const outputPath = inputPath.replace('input.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeFootnotes: true }));

    expect(extractParaTexts(outputPath)).toEqual(['2 plus 36']);
    rmSync(inputPath.replace('/input.docx', ''), { recursive: true, force: true });
  });

  it('preserves mixed-content superscript runs and field results', async () => {
    const inputPath = buildTestDocxRaw([
      '<w:p><w:bookmarkStart w:id="9" w:name="_RefMixed"/>',
      '<w:r><w:rPr><w:i/><w:vertAlign w:val="superscript"/></w:rPr><w:t>note 36</w:t></w:r>',
      '<w:bookmarkEnd w:id="9"/>',
      '<w:bookmarkStart w:id="10" w:name="_RefField"/>',
      '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>',
      '<w:r><w:instrText> REF _Ref36 </w:instrText></w:r>',
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
      '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>36</w:t></w:r>',
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
      '<w:bookmarkEnd w:id="10"/></w:p>',
    ].join(''));
    addNotesPart(inputPath, 'endnote', [36]);
    const outputPath = inputPath.replace('input.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeFootnotes: true }));

    const xml = extractDocXml(outputPath);
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('note 36');
    expect(xml).toContain('fldChar');
    expect(xml).toContain('instrText');
    expect(xml).toMatch(/<w:t>36<\/w:t>/);
    rmSync(inputPath.replace('/input.docx', ''), { recursive: true, force: true });
  });
});

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

/** Direct-child local names of the LAST <w:sectPr> in word/document.xml (the body-level one). */
function sectPrChildSequence(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const sectPrs = doc.getElementsByTagNameNS(W_NS, 'sectPr');
  const sectPr = sectPrs[sectPrs.length - 1];
  const names: string[] = [];
  for (let node = sectPr.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1) names.push((node as unknown as { localName: string }).localName);
  }
  return names;
}

/** Copy a real DOCX, transforming selected entries' bytes. */
function copyDocxWith(
  sourcePath: string,
  transform: (entryName: string, data: Buffer) => Buffer
): string {
  const dir = mkdtempSync(join(tmpdir(), 'cleaner-copy-'));
  const path = join(dir, 'modified.docx');
  const source = new AdmZip(sourcePath);
  const out = new AdmZip();
  for (const entry of source.getEntries()) {
    if (entry.isDirectory || entry.entryName.endsWith('/')) continue;
    out.addFile(entry.entryName, transform(entry.entryName, entry.getData()));
  }
  out.writeZip(path);
  return path;
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

    // Intentional: the [Content_Types].xml Default extension entry is retained
    // even when the last media part of that extension is removed — OPC packages
    // may keep extension defaults with no current part using them.
    expect(partXml(outputPath, '[Content_Types].xml')).toContain('png');

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('keeps a media part that another package relationship still targets', async () => {
    // Real template, media inflated past the threshold AND additionally
    // referenced from document.xml.rels — the header drawing must go, but the
    // shared media part must survive the orphan sweep.
    const inputPath = copyDocxWith(REAL_HEADER_DRAWING_TEMPLATE, (name, data) => {
      if (name === 'word/media/image1.png') return Buffer.alloc(125 * 1024, 0xab);
      if (name === 'word/_rels/document.xml.rels') {
        return Buffer.from(
          data
            .toString('utf-8')
            .replace(
              '</Relationships>',
              '<Relationship Id="rIdShared605" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>'
            ),
          'utf-8'
        );
      }
      return data;
    });
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeHeaderFooterDrawings: true }));

    expect(partXml(outputPath, 'word/header1.xml')).not.toContain('<w:drawing');
    expect(partXml(outputPath, 'word/_rels/header1.xml.rels')).not.toContain('media/image1.png');
    // Still referenced by document.xml.rels — must NOT be deleted
    expect(entryNames(outputPath)).toContain('word/media/image1.png');
    expect(partXml(outputPath, 'word/_rels/document.xml.rels')).toContain('rIdShared605');

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

    // CT_SectPr sequence: headerReference* then footerReference* then the rest
    expect(sectPrChildSequence(outputPath)).toEqual(['headerReference', 'footerReference', 'pgSz']);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it('re-inserts existing and transplanted references in CT_SectPr schema order', async () => {
    const bodyXml = [
      '<w:p><w:pPr><w:sectPr>',
      '<w:headerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rIdH"/>',
      '<w:footerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="first" r:id="rIdFF"/>',
      '</w:sectPr></w:pPr></w:p>',
      '<w:p><w:r><w:t>Content</w:t></w:r></w:p>',
      // Destination sectPr: has its own default footer, first child is w:type (not pgSz)
      '<w:sectPr>',
      '<w:footerReference xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" w:type="default" r:id="rIdF"/>',
      '<w:type w:val="continuous"/>',
      '<w:pgSz w:w="12240" w:h="15840"/>',
      '</w:sectPr>',
    ].join('');

    const inputPath = buildTestDocxRaw(bodyXml);
    const outputDir = mkdtempSync(join(tmpdir(), 'cleaner-out-'));
    const outputPath = join(outputDir, 'output.docx');

    await cleanDocument(inputPath, outputPath, makeConfig({ removeEmptyLeadingParagraphs: true }));

    // Transplanted: header(default) + footer(first); existing footer(default) kept.
    // Schema order: all headerReference children, then all footerReference
    // children, then the remaining section properties.
    expect(sectPrChildSequence(outputPath)).toEqual([
      'headerReference',
      'footerReference',
      'footerReference',
      'type',
      'pgSz',
    ]);
    const xml = extractDocXml(outputPath);
    expect(xml).toContain('rIdH');
    expect(xml).toContain('rIdFF');
    expect(xml).toContain('rIdF');

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
