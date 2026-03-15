import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { cleanDocument } from './cleaner.js';
import type { CleanConfig } from '../metadata.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function buildTestDocx(paragraphs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'cleaner-test-'));
  const path = join(dir, 'input.docx');

  const bodyContent = paragraphs
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyContent}</w:body>
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
});
