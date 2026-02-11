import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { patchDocument, getRunText, isRunSafeToRemove } from '../src/core/recipe/patcher.js';

const it = itAllure.epic('Filling & Rendering');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '</Types>';

/**
 * Helper: build a minimal valid DOCX with custom word/document.xml content
 * and optional additional parts (headers, footers, etc.).
 */
function buildMinimalDocx(
  documentXml: string,
  additionalParts?: Record<string, string>
): string {
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  if (additionalParts) {
    for (const [name, content] of Object.entries(additionalParts)) {
      zip.addFile(name, Buffer.from(content, 'utf-8'));
    }
  }
  const tempDir = mkdtempSync(join(tmpdir(), 'patcher-test-'));
  const docxPath = join(tempDir, 'test.docx');
  zip.writeZip(docxPath);
  return docxPath;
}

/**
 * Helper: extract all text from document.xml in a DOCX by joining <w:t> per paragraph.
 */
function extractText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  const xml = entry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const paragraphs: string[] = [];
  const paras = doc.getElementsByTagNameNS(W_NS, 'p');
  for (let i = 0; i < paras.length; i++) {
    const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
    const parts: string[] = [];
    for (let j = 0; j < tElements.length; j++) {
      parts.push(tElements[j].textContent ?? '');
    }
    if (parts.length > 0) paragraphs.push(parts.join(''));
  }
  return paragraphs.join('\n');
}

describe('patchDocument', () => {
  it.openspec('OA-020')('replaces a placeholder within a single run', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>[Company Name]</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');
    expect(text).not.toContain('[Company Name]');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-021')('replaces a placeholder split across multiple runs', async () => {
    // Word commonly splits "[Company Name]" across runs like:
    // Run 1: "[Company"  Run 2: " Name]"
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[Company</w:t></w:r>' +
      '<w:r><w:t> Name]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces a placeholder split across three runs', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[Com</w:t></w:r>' +
      '<w:r><w:t>pany</w:t></w:r>' +
      '<w:r><w:t> Name]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces a placeholder nested inside <w:hyperlink>', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:hyperlink>' +
      '<w:r><w:t>[Company Name]</w:t></w:r>' +
      '</w:hyperlink>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces a placeholder split across direct and nested runs', async () => {
    // Run directly in paragraph, then run inside hyperlink
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[Company</w:t></w:r>' +
      '<w:hyperlink>' +
      '<w:r><w:t> Name]</w:t></w:r>' +
      '</w:hyperlink>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces multiple different placeholders in the same paragraph', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>Between [Party A] and [Party B]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Party A]': '{party_a}',
      '[Party B]': '{party_b}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('Between {party_a} and {party_b}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces longest match first to prevent partial matches', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[State of Delaware]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[State of Delaware]': 'State of {state_of_incorporation}',
      '[State]': '{state_of_incorporation}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('State of {state_of_incorporation}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('handles multiple occurrences of the same placeholder', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[State] is in [State]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[State]': '{state}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{state} is in {state}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('throws on infinite loop when replacement contains the key', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>hello world</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    // "hello" → "say hello" would loop because the output contains "hello" again
    await expect(
      patchDocument(inputPath, outputPath, {
        'hello': 'say hello',
      })
    ).rejects.toThrow(/exceeded.*replacements|no progress/i);

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('preserves run properties (bold, italic) during replacement', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:rPr><w:b/></w:rPr><w:t>[Company Name]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    // Check that the bold property is preserved
    const zip = new AdmZip(outputPath);
    const outputXml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
    expect(outputXml).toContain('<w:b');
    expect(extractText(outputPath)).toBe('{company_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('leaves paragraphs without matches untouched', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>No placeholders here</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('No placeholders here');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces placeholder in word/header1.xml', async () => {
    const docXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Body text</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const headerXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:hdr xmlns:w="${W_NS}">` +
      '<w:p><w:r><w:t>[Company Name]</w:t></w:r></w:p>' +
      '</w:hdr>';

    const inputPath = buildMinimalDocx(docXml, {
      'word/header1.xml': headerXml,
    });
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    // Check header was patched
    const zip = new AdmZip(outputPath);
    const headerEntry = zip.getEntry('word/header1.xml');
    expect(headerEntry).toBeDefined();
    const headerContent = headerEntry!.getData().toString('utf-8');
    expect(headerContent).toContain('{company_name}');
    expect(headerContent).not.toContain('[Company Name]');

    // Check body text is untouched
    const text = extractText(outputPath);
    expect(text).toBe('Body text');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('removes empty intermediate runs after cross-run replacement', async () => {
    // 3 runs: "[Com" + "pany" + " Name]" → after replacement, middle run should be removed
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[Com</w:t></w:r>' +
      '<w:r><w:t>pany</w:t></w:r>' +
      '<w:r><w:t> Name]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');

    // Count remaining <w:r> elements — empty runs should have been removed
    const zip = new AdmZip(outputPath);
    const outputXml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
    const doc = new DOMParser().parseFromString(outputXml, 'text/xml');
    const runs = doc.getElementsByTagNameNS(W_NS, 'r');
    expect(runs.length).toBe(1);

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('preserves runs with non-text children like <w:drawing>', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>[Company Name]</w:t></w:r>' +
      '<w:r><w:rPr><w:b/></w:rPr><w:drawing>image</w:drawing></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    // The run with <w:drawing> should survive even though its text is empty
    const zip = new AdmZip(outputPath);
    const outputXml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
    expect(outputXml).toContain('<w:drawing>');

    const doc = new DOMParser().parseFromString(outputXml, 'text/xml');
    const runs = doc.getElementsByTagNameNS(W_NS, 'r');
    expect(runs.length).toBe(2);

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('isRunSafeToRemove', () => {
  const parser = new DOMParser();

  function makeRun(innerXml: string): any {
    const xml = `<w:r xmlns:w="${W_NS}">${innerXml}</w:r>`;
    const doc = parser.parseFromString(xml, 'text/xml');
    return doc.documentElement;
  }

  it('returns true for run with only rPr and empty t', () => {
    expect(isRunSafeToRemove(makeRun('<w:rPr><w:b/></w:rPr><w:t></w:t>'))).toBe(true);
  });

  it('returns true for empty run', () => {
    expect(isRunSafeToRemove(makeRun(''))).toBe(true);
  });

  it('returns false for run with drawing', () => {
    expect(isRunSafeToRemove(makeRun('<w:drawing>img</w:drawing>'))).toBe(false);
  });

  it('returns false for run with br', () => {
    expect(isRunSafeToRemove(makeRun('<w:br/>'))).toBe(false);
  });

  it('returns false for run with tab', () => {
    expect(isRunSafeToRemove(makeRun('<w:tab/>'))).toBe(false);
  });

  it('returns false for run with footnoteReference', () => {
    expect(isRunSafeToRemove(makeRun('<w:footnoteReference w:id="1"/>'))).toBe(false);
  });
});
