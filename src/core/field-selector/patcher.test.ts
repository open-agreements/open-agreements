import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
import { patchDocument, isRunSafeToRemove } from './patcher.js';

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
  it('reports a qualified key as zero-match when its context follows the search text', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Sections 3.1 shall terminate and be of no further force or effect.</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');
    const key = 'shall terminate and be of no further force or effect > Sections 3.1';

    const result = await patchDocument(inputPath, outputPath, { [key]: 'Sections {section}' });

    expect(result.zeroMatchKeys).toContain(key);
    expect(extractText(outputPath)).toContain('Sections 3.1 shall terminate');
    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('does not report a qualified key when its directional context match succeeds', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>shall terminate under Sections 3.1.</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');
    const key = 'shall terminate under > Sections 3.1';

    const result = await patchDocument(inputPath, outputPath, { [key]: 'Sections {section}' });

    expect(result.zeroMatchKeys).not.toContain(key);
    expect(extractText(outputPath)).toContain('Sections {section}');
    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('keeps xml:space namespaced and singular when rewriting a preserved text run', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t xml:space="preserve"> [Company Name] </w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, { '[Company Name]': '{company_name}' });

    const outputXml = new AdmZip(outputPath).readAsText('word/document.xml');
    const textTags = outputXml.match(/<w:t\b[^>]*>/g) ?? [];
    expect(textTags.length).toBeGreaterThan(0);
    expect(textTags.every((tag) => (tag.match(/xml:space=/g) ?? []).length <= 1)).toBe(true);
    const parseErrors: string[] = [];
    new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') parseErrors.push(message);
      },
    }).parseFromString(outputXml, 'text/xml');
    expect(parseErrors).toEqual([]);
    expect(extractText(outputPath)).toBe(' {company_name} ');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replaces a placeholder within a single run', async () => {
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

  it('replaces a placeholder split across multiple runs', async () => {
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

describe('patchDocument — formatting preservation (docx-core)', () => {
  /**
   * Helper: extract raw run XML from the first <w:p> in a DOCX.
   * Returns an array of { text, hasBold } per run.
   */
  function extractRunInfo(docxPath: string): Array<{ text: string; bold: boolean }> {
    const zip = new AdmZip(docxPath);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) return [];
    const xml = entry.getData().toString('utf-8');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const runs = doc.getElementsByTagNameNS(W_NS, 'r');
    const result: Array<{ text: string; bold: boolean }> = [];
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const tElements = run.getElementsByTagNameNS(W_NS, 't');
      let text = '';
      for (let j = 0; j < tElements.length; j++) {
        text += tElements[j].textContent ?? '';
      }
      if (!text) continue;
      const rPr = run.getElementsByTagNameNS(W_NS, 'rPr');
      let bold = false;
      if (rPr.length > 0) {
        bold = rPr[0].getElementsByTagNameNS(W_NS, 'b').length > 0;
      }
      result.push({ text, bold });
    }
    return result;
  }

  it('no mid-word formatting split on cross-run replacement with common prefix', async () => {
    // Regression: surgical optimization caused "clause" (bold) + "(s)" (plain) split
    // when replacing "clause[(s)]" → "clause(s)" across formatting boundaries.
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:rPr><w:b/></w:rPr><w:t>The clause</w:t></w:r>' +
      '<w:r><w:t>[(s)] of the agreement</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      'clause[(s)]': 'clause(s)',
    });

    const text = extractText(outputPath);
    expect(text).toBe('The clause(s) of the agreement');

    // The key assertion: "clause(s)" must NOT be split across runs with different formatting.
    // docx-core places the full replacement in a single new run, preventing mid-word splits.
    const runInfo = extractRunInfo(outputPath);
    // Find which run(s) contain "clause(s)"
    const clauseRuns = runInfo.filter(r => r.text.includes('clause(s)') || r.text.includes('clause'));
    // "clause(s)" should be fully within a single run or contiguous runs with the same formatting
    const fullClauseText = clauseRuns.map(r => r.text).join('');
    expect(fullClauseText).toContain('clause(s)');
    // Verify no single-char split like "p" + "rovided" or "clause" + "(s)" with different formatting
    for (const r of runInfo) {
      if (r.text === '(s)' || r.text === '(s' || r.text === 's)') {
        // If "(s)" is in its own run, it must have same formatting as "clause" run
        const clauseRun = runInfo.find(cr => cr.text.includes('clause'));
        if (clauseRun) {
          expect(r.bold).toBe(clauseRun.bold);
        }
      }
    }

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('container-boundary replacement uses fallback without throwing', async () => {
    // Replacement spans from direct paragraph run into <w:hyperlink> child run.
    // docx-core throws UNSAFE_CONTAINER_BOUNDARY; patcher falls back to legacy charMap.
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

    // Should NOT throw — falls back to legacy
    await patchDocument(inputPath, outputPath, {
      '[Company Name]': '{company_name}',
    });

    const text = extractText(outputPath);
    expect(text).toBe('{company_name}');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('tab before match does not shift replacement offset', async () => {
    // Paragraph with <w:tab/> before the match; docx-core counts tabs as visible chars
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:t>Item</w:t><w:tab/><w:t>[Amount]</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Amount]': '{amount}',
    });

    // Verify the replacement happened correctly
    const zip = new AdmZip(outputPath);
    const outputXml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
    expect(outputXml).toContain('{amount}');
    expect(outputXml).not.toContain('[Amount]');
    // Tab element should be preserved
    expect(outputXml).toContain('<w:tab');

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('replacementColor applied via addRunProps.color', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>[Company Name]</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Company Name]': 'Acme Corp',
    }, { replacementColor: '000000' });

    const zip = new AdmZip(outputPath);
    const outputXml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
    expect(outputXml).toContain('Acme Corp');
    // Color should be set on the replacement run
    expect(outputXml).toContain('000000');
    // Verify it's in a <w:color> element
    const doc = new DOMParser().parseFromString(outputXml, 'text/xml');
    const colorEls = doc.getElementsByTagNameNS(W_NS, 'color');
    expect(colorEls.length).toBeGreaterThan(0);

    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('patchDocument — atomic complex-field range deletion', () => {
  function field(bookmark: string, result: string): string {
    return (
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      `<w:r><w:instrText xml:space="preserve"> REF ${bookmark} \\h </w:instrText></w:r>` +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      `<w:r><w:t>${result}</w:t></w:r>` +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    );
  }

  function outputXml(path: string): string {
    return new AdmZip(path).getEntry('word/document.xml')!.getData().toString('utf-8');
  }

  it('removes every node of multiple REF fields intersected by a cross-run deletion', async () => {
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t xml:space="preserve">Base sentence. [Optional sentence refers to Section </w:t></w:r>' +
      field('kept_target', '2.1') +
      '<w:r><w:t xml:space="preserve"> and Section </w:t></w:r>' +
      field('removed_target', '3.2') +
      '<w:r><w:t xml:space="preserve">.] Tail sentence.</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, {
      '[Optional sentence refers to Section 2.1 and Section 3.2.]': '',
    });

    const out = outputXml(outputPath);
    expect(extractText(outputPath)).toBe('Base sentence.  Tail sentence.');
    expect(out).not.toContain('fldChar');
    expect(out).not.toContain('instrText');
    expect(out).not.toContain('kept_target');
    expect(out).not.toContain('removed_target');
    expect(new DOMParser().parseFromString(out, 'text/xml').getElementsByTagName('parsererror').length).toBe(0);
    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('expands through nested fields but preserves a wholly outside REF field', async () => {
    const nested =
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText> IF </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      field('nested_target', '4.1') +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' + field('outside_target', '1.1') +
      '<w:r><w:t xml:space="preserve"> Keep. [Drop </w:t></w:r>' + nested +
      '<w:r><w:t xml:space="preserve"> now.] Tail.</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, { '[Drop 4.1 now.]': '' });

    const out = outputXml(outputPath);
    expect(extractText(outputPath)).toBe('1.1 Keep.  Tail.');
    expect(out).toContain('outside_target');
    expect(out).not.toContain('nested_target');
    expect((out.match(/fldCharType="begin"/g) ?? [])).toHaveLength(1);
    expect((out.match(/fldCharType="end"/g) ?? [])).toHaveLength(1);
    expect((out.match(/instrText/g) ?? [])).toHaveLength(2); // opening + closing XML tag
    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('atomically removes a field when the matched text is only its cached result', async () => {
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W_NS}"><w:body><w:p>` +
      '<w:r><w:t>Before </w:t></w:r>' + field('deleted_bookmark', 'BROKEN') +
      '<w:r><w:t> after.</w:t></w:r></w:p></w:body></w:document>';
    const inputPath = buildMinimalDocx(xml);
    const outputPath = inputPath.replace('test.docx', 'output.docx');

    await patchDocument(inputPath, outputPath, { BROKEN: '' });

    const out = outputXml(outputPath);
    expect(extractText(outputPath)).toBe('Before  after.');
    expect(out).not.toContain('fldChar');
    expect(out).not.toContain('instrText');
    expect(out).not.toContain('deleted_bookmark');
    rmSync(inputPath.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

describe('isRunSafeToRemove', () => {
  const parser = new DOMParser();

  function makeRun(innerXml: string): Element {
    const xml = `<w:r xmlns:w="${W_NS}">${innerXml}</w:r>`;
    const doc = parser.parseFromString(xml, 'text/xml');
    return doc.documentElement as Element;
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
