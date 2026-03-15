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
  it.openspec('OA-RCP-010')('replaces placeholder only in the matching table row', async () => {
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

  it.openspec('OA-RCP-035')('does not replace in non-table paragraphs when context text is absent', async () => {
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
    // Non-table paragraph should still have [Fill in] (context "Effective Date" not in that paragraph)
    const lines = text.split('\n');
    expect(lines[0]).toBe('[Fill in]');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-RCP-035')('does not replace when row label does not match', async () => {
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

describe('patchDocument paragraph context keys', () => {
  it.openspec('OA-RCP-035')('replaces first placeholder after context in a paragraph', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>not later than [10] days before</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'not later than > [10]': '{adjustment_notice_days}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('not later than {adjustment_notice_days} days before');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-RCP-035')('leaves placeholder untouched when context absent from paragraph', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>some other text [10] here</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'not later than > [10]': '{adjustment_notice_days}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('some other text [10] here');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-RCP-035')('independently replaces duplicate placeholders via different contexts', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>not later than [10] days and at least [10] days</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'not later than > [10]': '{adjustment_notice_days}',
      'at least > [10]': '{conversion_notice_days}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('not later than {adjustment_notice_days} days and at least {conversion_notice_days} days');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-RCP-035')('table-row context takes priority over paragraph context', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl>' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>Effective Date</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>[Fill in]</w:t></w:r></w:p></w:tc>' +
      '</w:tr>' +
      '</w:tbl>' +
      '<w:p><w:r><w:t>Effective Date [Fill in]</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'Effective Date > [Fill in]': '{effective_date}',
    });

    const text = extractText(outputPath);
    const lines = text.split('\n');
    // Table row replaced via row context
    expect(lines).toContain('{effective_date}');
    // Paragraph replaced via paragraph context
    expect(lines[lines.length - 1]).toBe('Effective Date {effective_date}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-RCP-035')('context keys coexist with simple keys', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>not later than [10] days</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>some other [10] here</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'not later than > [10]': '{adjustment_notice_days}',
      '[10]': '{default_days}',
    });

    const text = extractText(outputPath);
    const lines = text.split('\n');
    // Context key claims the first paragraph
    expect(lines[0]).toBe('not later than {adjustment_notice_days} days');
    // Simple key sweeps the second paragraph
    expect(lines[1]).toBe('some other {default_days} here');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('patchDocument mixed key types', () => {
  it.openspec('OA-RCP-035')('context keys process before simple keys', async () => {
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

  it.openspec('OA-RCP-036')('returns label text for a paragraph in the second cell', () => {
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

  it.openspec('OA-RCP-036')('returns null for a paragraph not in a table', () => {
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
  it.openspec('OA-RCP-037')('clears content of specified parts', async () => {
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

  it.openspec('OA-RCP-037')('removes paragraphs from start through end inclusive', async () => {
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

  it.openspec('OA-RCP-037')('removes nothing when start pattern does not match', async () => {
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

  it.openspec('OA-RCP-037')('removes from start through end of document when end pattern not found', async () => {
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

  it.openspec('OA-RCP-037')('handles multiple ranges correctly', async () => {
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

  it.openspec('OA-RCP-037')('removes repeated occurrences of the same range pattern', async () => {
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

  it.openspec('OA-RCP-038')('returns pattern-matched text when extractGuidance is true', async () => {
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

  it.openspec('OA-RCP-038')('returns range-deleted text with groupId when extractGuidance is true', async () => {
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

  it.openspec('OA-ENG-005')('returns footnote text when extractGuidance is true', async () => {
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

  it.openspec('OA-RCP-038')('returns guidance undefined when extractGuidance is not set', async () => {
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

  it.openspec('OA-RCP-038')('includes sourceHash and configHash in extractedFrom', async () => {
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
