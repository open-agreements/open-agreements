import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
import { patchDocument, getTableRowContext } from './patcher.js';
import { cleanDocument } from './cleaner.js';

const it = itAllure.epic('Filling & Rendering');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '</Types>';

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
  const tempDir = mkdtempSync(join(tmpdir(), 'patcher-ext-test-'));
  const docxPath = join(tempDir, 'test.docx');
  zip.writeZip(docxPath);
  return docxPath;
}

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

function extractPartText(docxPath: string, partName: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry(partName);
  if (!entry) return '';
  const xml = entry.getData().toString('utf-8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tElements = doc.getElementsByTagNameNS(W_NS, 't');
  const parts: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    parts.push(tElements[i].textContent ?? '');
  }
  return parts.join('');
}

describe('patchDocument context keys', () => {
  it.openspec('OA-023')('replaces placeholder only in the matching table row', async () => {
    // Table with three rows, each having [Fill in] but different labels
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Effective Date</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Governing Law</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Courts</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '</w:tbl>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Effective Date > [Fill in]': '{effective_date}',
      'Governing Law > [Fill in]': '{governing_law}',
      'Courts > [Fill in]': '{courts}',
    });

    const text = extractText(outputPath);
    expect(text).toContain('Effective Date');
    expect(text).toContain('{effective_date}');
    expect(text).toContain('{governing_law}');
    expect(text).toContain('{courts}');
    expect(text).not.toContain('[Fill in]');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-183')('does not replace in non-table paragraphs', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p>' +
      '<w:tbl>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Effective Date</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '</w:tbl>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Effective Date > [Fill in]': '{effective_date}',
    });

    const text = extractText(outputPath);
    // Table row should be replaced
    expect(text).toContain('{effective_date}');
    // Non-table paragraph should still have [Fill in]
    const lines = text.split('\n');
    expect(lines[0]).toBe('[Fill in]');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-183')('does not replace when row label does not match', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Other Label</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '</w:tbl>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Effective Date > [Fill in]': '{effective_date}',
    });

    const text = extractText(outputPath);
    expect(text).toContain('[Fill in]');
    expect(text).not.toContain('{effective_date}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('patchDocument nth occurrence keys', () => {
  it.openspec('OA-183')('replaces only the Nth occurrence of a text', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Party Name:#1': 'Party Name: {party_1}',
      'Party Name:#2': 'Party Name: {party_2}',
    });

    const text = extractText(outputPath);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Party Name: {party_1}');
    expect(lines[1]).toBe('Party Name: {party_2}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-183')('does not infinite loop when value contains searchText', async () => {
    // "Party Name:" → "Party Name: {tag}" — value contains key
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    // Should not throw — nth keys use single-shot replacement
    await patchDocument(inputPath, outputPath, {
      'Party Name:#1': 'Party Name: {party_1_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('Party Name: {party_1_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-183')('counts occurrences by original position, not re-scanning modified text', async () => {
    // Regression: if nth keys are processed in separate passes, #1 replaces
    // "Party Name:" → "Party Name: {party_1}" in paragraph 1. Then when #2
    // iterates from the top, paragraph 1 still contains "Party Name:" (as a
    // prefix of the new value), so a naive re-scan would count it as
    // occurrence 1 again, making paragraph 2 appear as occurrence 2.
    // The correct behavior requires a single grouped pass so #2 sees
    // paragraph 2 as the second original occurrence.
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Party Name:#1': 'Party Name: {party_1}',
      'Party Name:#2': 'Party Name: {party_2}',
    });

    const text = extractText(outputPath);
    const lines = text.split('\n');
    // #1 must modify paragraph 1, #2 must modify paragraph 2
    expect(lines[0]).toBe('Party Name: {party_1}');
    expect(lines[1]).toBe('Party Name: {party_2}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-183')('leaves unmatched occurrences untouched when no simple fallback', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Party Name:</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Party Name:#1': 'Party Name: {party_1}',
      'Party Name:#2': 'Party Name: {party_2}',
    });

    const text = extractText(outputPath);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Party Name: {party_1}');
    expect(lines[1]).toBe('Party Name: {party_2}');
    // Third occurrence untouched
    expect(lines[2]).toBe('Party Name:');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('patchDocument mixed key types', () => {
  it.openspec('OA-183')('context keys process before simple keys', async () => {
    // Context key should match first, then simple key handles the rest
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Effective Date</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Other</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '</w:tbl>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Effective Date > [Fill in]': '{effective_date}',
      '[Fill in]': '{unknown}',
    });

    const text = extractText(outputPath);
    expect(text).toContain('{effective_date}');
    expect(text).toContain('{unknown}');
    expect(text).not.toContain('[Fill in]');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('getTableRowContext', () => {
  const parser = new DOMParser();

  it.openspec('OA-184')('returns label text for a paragraph in the second cell', () => {
    const xml =
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl><w:tr>' +
      '<w:tc><w:p><w:r><w:t>Label</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc>' +
      '</w:tr></w:tbl>' +
      '</w:body></w:document>';
    const doc = parser.parseFromString(xml, 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    // Second paragraph is in the second cell
    const context = getTableRowContext(paras[1] as Element);
    expect(context).toBe('Label');
  });

  it.openspec('OA-184')('returns null for a paragraph not in a table', () => {
    const xml =
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Not in table</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const doc = parser.parseFromString(xml, 'text/xml');
    const para = doc.getElementsByTagNameNS(W_NS, 'p')[0] as Element;
    expect(getTableRowContext(para)).toBeNull();
  });
});

describe('cleanDocument clearParts', () => {
  it.openspec('OA-185')('clears content of specified parts', async () => {
    const docXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Body text</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const headerXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:hdr xmlns:w="${W_NS}">` +
      '<w:p><w:r><w:t>Header content to clear</w:t></w:r></w:p>' +
      '</w:hdr>';

    const inputPath = buildMinimalDocx(docXml, {
      'word/header2.xml': headerXml,
    });
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: ['header2.xml'],
    });

    // Body should be intact
    const bodyText = extractText(outputPath);
    expect(bodyText).toBe('Body text');

    // Header should be cleared
    const headerText = extractPartText(outputPath, 'word/header2.xml');
    expect(headerText).toBe('');

    // But the part should still exist
    const zip = new AdmZip(outputPath);
    expect(zip.getEntry('word/header2.xml')).toBeDefined();

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('cleanDocument removeRanges', () => {
  function makeParagraph(text: string): string {
    return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  }

  function makeDocXml(paragraphs: string[]): string {
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      paragraphs.map(makeParagraph).join('') +
      '</w:body></w:document>'
    );
  }

  it.openspec('OA-185')('removes paragraphs from start through end inclusive', async () => {
    const xml = makeDocXml(['Alpha', 'Beta start', 'Charlie', 'Delta end', 'Echo']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [{ start: '^Beta', end: '^Delta' }],
      clearParts: [],
    });

    const text = extractText(outputPath);
    expect(text).toBe('Alpha\nEcho');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-185')('removes nothing when start pattern does not match', async () => {
    const xml = makeDocXml(['Alpha', 'Beta', 'Charlie']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [{ start: '^NoMatch', end: '^Charlie' }],
      clearParts: [],
    });

    const text = extractText(outputPath);
    expect(text).toBe('Alpha\nBeta\nCharlie');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-185')('removes from start through end of document when end pattern not found', async () => {
    const xml = makeDocXml(['Alpha', 'Beta start', 'Charlie', 'Delta']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [{ start: '^Beta', end: '^NoMatch' }],
      clearParts: [],
    });

    const text = extractText(outputPath);
    expect(text).toBe('Alpha');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-185')('handles multiple ranges correctly', async () => {
    const xml = makeDocXml([
      'Keep1', 'Remove1Start', 'Remove1Mid', 'Remove1End',
      'Keep2', 'Remove2Start', 'Remove2End', 'Keep3',
    ]);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [
        { start: '^Remove1Start', end: '^Remove1End' },
        { start: '^Remove2Start', end: '^Remove2End' },
      ],
      clearParts: [],
    });

    const text = extractText(outputPath);
    expect(text).toBe('Keep1\nKeep2\nKeep3');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-185')('removes repeated occurrences of the same range pattern', async () => {
    const xml = makeDocXml([
      'Keep1',
      '[Comment: first block start',
      'first block middle',
      'first block end.]',
      'Keep2',
      '[Comment: second block.]',
      'Keep3',
    ]);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [{ start: '^\\[Comment:', end: '\\]\\s*$' }],
      clearParts: [],
    });

    const text = extractText(outputPath);
    expect(text).toBe('Keep1\nKeep2\nKeep3');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('cleanDocument guidance extraction', () => {
  function makeParagraph(text: string): string {
    return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  }

  function makeDocXml(paragraphs: string[]): string {
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      paragraphs.map(makeParagraph).join('') +
      '</w:body></w:document>'
    );
  }

  it.openspec('OA-186')('returns pattern-matched text when extractGuidance is true', async () => {
    const xml = makeDocXml(['Keep', 'NOTE: Remove this', 'Also keep']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    const result = await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: ['^NOTE:'],
      removeRanges: [],
      clearParts: [],
    }, { extractGuidance: true });

    expect(result.guidance).toBeDefined();
    expect(result.guidance!.entries).toHaveLength(1);
    expect(result.guidance!.entries[0].source).toBe('pattern');
    expect(result.guidance!.entries[0].text).toBe('NOTE: Remove this');
    expect(result.guidance!.entries[0].part).toBe('word/document.xml');

    // Document should still be cleaned
    const text = extractText(outputPath);
    expect(text).toBe('Keep\nAlso keep');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-186')('returns range-deleted text with groupId when extractGuidance is true', async () => {
    const xml = makeDocXml(['Keep1', '[Comment: Start', 'Middle text', 'End.]', 'Keep2']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    const result = await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [{ start: '^\\[Comment:', end: '\\]\\s*$' }],
      clearParts: [],
    }, { extractGuidance: true });

    expect(result.guidance).toBeDefined();
    const rangeEntries = result.guidance!.entries.filter(e => e.source === 'range');
    expect(rangeEntries).toHaveLength(3);
    expect(rangeEntries[0].text).toBe('[Comment: Start');
    expect(rangeEntries[1].text).toBe('Middle text');
    expect(rangeEntries[2].text).toBe('End.]');
    // All share the same groupId
    const groupId = rangeEntries[0].groupId;
    expect(groupId).toBeDefined();
    expect(rangeEntries.every(e => e.groupId === groupId)).toBe(true);

    const text = extractText(outputPath);
    expect(text).toBe('Keep1\nKeep2');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-018')('returns footnote text when extractGuidance is true', async () => {
    const docXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Body text</w:t></w:r>' +
      '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="1"/></w:r></w:p>' +
      '</w:body></w:document>';

    const footnotesXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:footnotes xmlns:w="${W_NS}">` +
      '<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>' +
      '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>' +
      '<w:footnote w:id="1"><w:p><w:r><w:t>This is footnote content.</w:t></w:r></w:p></w:footnote>' +
      '</w:footnotes>';

    const inputPath = buildMinimalDocx(docXml, { 'word/footnotes.xml': footnotesXml });
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    const result = await cleanDocument(inputPath, outputPath, {
      removeFootnotes: true,
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    }, { extractGuidance: true });

    expect(result.guidance).toBeDefined();
    const fnEntries = result.guidance!.entries.filter(e => e.source === 'footnote');
    expect(fnEntries).toHaveLength(1);
    expect(fnEntries[0].text).toBe('This is footnote content.');
    expect(fnEntries[0].part).toBe('word/footnotes.xml');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-186')('returns guidance undefined when extractGuidance is not set', async () => {
    const xml = makeDocXml(['Keep', 'NOTE: Remove', 'Also keep']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    const result = await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: ['^NOTE:'],
      removeRanges: [],
      clearParts: [],
    });

    expect(result.guidance).toBeUndefined();

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-186')('includes sourceHash and configHash in extractedFrom', async () => {
    const xml = makeDocXml(['Keep', 'NOTE: Remove']);
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    const result = await cleanDocument(inputPath, outputPath, {
      removeFootnotes: false,
      removeParagraphPatterns: ['^NOTE:'],
      removeRanges: [],
      clearParts: [],
    }, { extractGuidance: true, sourceHash: 'src123', configHash: 'cfg456' });

    expect(result.guidance!.extractedFrom.sourceHash).toBe('src123');
    expect(result.guidance!.extractedFrom.configHash).toBe('cfg456');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});
