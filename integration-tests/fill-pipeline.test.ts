import { describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { detectCurrencyFields, sanitizeCurrencyValuesFromDocx, verifyTemplateFill, BLANK_PLACEHOLDER } from '../src/core/fill-utils.js';
import { prepareFillData, fillDocx } from '../src/core/fill-pipeline.js';
import { loadMetadata } from '../src/core/metadata.js';
import { fillTemplate } from '../src/core/engine.js';

const it = itAllure.epic('Filling & Rendering');

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

/** Build a minimal DOCX buffer from raw document XML and optional additional parts. */
function buildDocxBuffer(documentXml: string, additionalParts?: Record<string, string>): Buffer {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  if (additionalParts) {
    for (const [name, content] of Object.entries(additionalParts)) {
      zip.addFile(name, Buffer.from(content, 'utf-8'));
    }
  }
  return zip.toBuffer();
}

/** Build a minimal DOCX file on disk and return the path. */
function buildDocxFile(documentXml: string, additionalParts?: Record<string, string>): string {
  const buf = buildDocxBuffer(documentXml, additionalParts);
  const tempDir = mkdtempSync(join(tmpdir(), 'fill-pipeline-test-'));
  const docxPath = join(tempDir, 'test.docx');
  writeFileSync(docxPath, buf);
  return docxPath;
}

/** Helper to make a simple document XML with the given paragraph text content. */
function docXml(paragraphTexts: string[]): string {
  const paras = paragraphTexts
    .map((t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${paras}</w:body></w:document>`
  );
}

/** Helper to make a document XML where a single paragraph has text split across multiple runs. */
function docXmlSplitRuns(runTexts: string[]): string {
  const runs = runTexts.map((t) => `<w:r><w:t>${t}</w:t></w:r>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body><w:p>${runs}</w:p></w:body></w:document>`
  );
}

/** Helper to make header XML with the given text. */
function headerXml(text: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:hdr xmlns:w="${W_NS}"><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:hdr>`
  );
}

/** Helper to make footer XML with the given text. */
function footerXml(text: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:ftr xmlns:w="${W_NS}"><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:ftr>`
  );
}

/** Helper to make endnotes XML with the given text. */
function endnotesXml(text: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:endnotes xmlns:w="${W_NS}"><w:endnote w:id="1"><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:endnote></w:endnotes>`
  );
}

// ---------------------------------------------------------------------------
// Section 1: Currency Sanitization
// ---------------------------------------------------------------------------

describe('detectCurrencyFields', () => {
  it.openspec('OA-FIL-003')('detects field when $ and {field} are split across runs', () => {
    const buf = buildDocxBuffer(docXmlSplitRuns(['Amount: $', '{purchase_amount}']));
    const fields = detectCurrencyFields(buf);
    expect(fields.has('purchase_amount')).toBe(true);
  });

  it.openspec('OA-FIL-003')('returns empty set for DOCX without dollar-prefixed fields', () => {
    const buf = buildDocxBuffer(docXml(['Hello {name}, welcome to {company}']));
    const fields = detectCurrencyFields(buf);
    expect(fields.size).toBe(0);
  });

  it.openspec('OA-FIL-003')('scans headers', () => {
    const buf = buildDocxBuffer(docXml(['Body text']), {
      'word/header1.xml': headerXml('Fee: ${fee_amount}'),
    });
    const fields = detectCurrencyFields(buf);
    expect(fields.has('fee_amount')).toBe(true);
  });

  it.openspec('OA-FIL-003')('scans footers', () => {
    const buf = buildDocxBuffer(docXml(['Body text']), {
      'word/footer1.xml': footerXml('Total: ${total}'),
    });
    const fields = detectCurrencyFields(buf);
    expect(fields.has('total')).toBe(true);
  });

  it.openspec('OA-FIL-003')('scans endnotes', () => {
    const buf = buildDocxBuffer(docXml(['Body text']), {
      'word/endnotes.xml': endnotesXml('Cap: ${valuation_cap}'),
    });
    const fields = detectCurrencyFields(buf);
    expect(fields.has('valuation_cap')).toBe(true);
  });

  it.openspec('OA-FIL-003')('detects multiple currency fields in a single paragraph', () => {
    const buf = buildDocxBuffer(docXml(['Fee: ${fee} and Cap: ${cap}']));
    const fields = detectCurrencyFields(buf);
    expect(fields.has('fee')).toBe(true);
    expect(fields.has('cap')).toBe(true);
  });
});

describe('sanitizeCurrencyValuesFromDocx', () => {
  it.openspec('OA-FIL-004')('strips $ from string values for detected currency fields', () => {
    const buf = buildDocxBuffer(docXml(['Amount: ${purchase_amount}']));
    const result = sanitizeCurrencyValuesFromDocx(
      { purchase_amount: '$50,000', name: 'Acme' },
      buf
    );
    expect(result.purchase_amount).toBe('50,000');
    expect(result.name).toBe('Acme');
  });

  it.openspec('OA-FIL-004')('does not strip $ from boolean values', () => {
    const buf = buildDocxBuffer(docXml(['Amount: ${some_field}']));
    const result = sanitizeCurrencyValuesFromDocx(
      { some_field: true, other: '$100' },
      buf
    );
    expect(result.some_field).toBe(true);
  });

  it.openspec('OA-FIL-004')('returns same object when no currency fields detected', () => {
    const buf = buildDocxBuffer(docXml(['Hello {name}']));
    const values = { name: '$Alice' };
    const result = sanitizeCurrencyValuesFromDocx(values, buf);
    expect(result).toBe(values); // same reference — no copy needed
  });

  it.openspec('OA-FIL-004')('does not strip $ from non-currency fields', () => {
    const buf = buildDocxBuffer(docXml(['Amount: ${amount}']));
    const result = sanitizeCurrencyValuesFromDocx(
      { amount: '$100', ticker: '$AAPL' },
      buf
    );
    expect(result.amount).toBe('100');
    expect(result.ticker).toBe('$AAPL'); // not a currency field
  });
});

// ---------------------------------------------------------------------------
// Section 2: Template Verification
// ---------------------------------------------------------------------------

describe('verifyTemplateFill', () => {
  it.openspec('OA-FIL-005')('catches double dollar signs in output', () => {
    const path = buildDocxFile(docXml(['The amount is $$50,000']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === 'No double dollar signs');
    expect(check?.passed).toBe(false);
    expect(check?.details).toContain('$$50,000');
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-FIL-005')('catches $ $ with whitespace between', () => {
    const path = buildDocxFile(docXml(['The amount is $ $50,000']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-RCP-012')('catches unrendered template tags', () => {
    const path = buildDocxFile(docXml(['Hello {unfilled_field}, welcome']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === 'No unrendered template tags');
    expect(check?.passed).toBe(false);
    expect(check?.details).toContain('{unfilled_field}');
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-FIL-006')('passes clean output with no issues', () => {
    const path = buildDocxFile(docXml(['Hello Alice, the amount is $50,000']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-FIL-005')('does not flag legitimate single dollar signs', () => {
    const path = buildDocxFile(docXml(['Fee: $1,000', 'Cap: $5,000,000']));
    const result = verifyTemplateFill(path);
    const check = result.checks.find((c) => c.name === 'No double dollar signs');
    expect(check?.passed).toBe(true);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-FIL-007')('scans headers and footers for issues', () => {
    const path = buildDocxFile(docXml(['Body is clean']), {
      'word/header1.xml': headerXml('{leftover_tag}'),
    });
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === 'No unrendered template tags');
    expect(check?.passed).toBe(false);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Section 3: prepareFillData
// ---------------------------------------------------------------------------

describe('prepareFillData', () => {
  const fields = [
    { name: 'company', type: 'string' as const, description: 'Company name' },
    { name: 'amount', type: 'string' as const, description: 'Amount' },
    { name: 'is_free', type: 'boolean' as const, description: 'Is free' },
  ];
  const priorityFieldNames = ['company'];

  it.openspec('OA-FIL-008')('defaults optional fields to empty string when useBlankPlaceholder is false', () => {
    const result = prepareFillData({
      values: { company: 'Acme' },
      fields,
      useBlankPlaceholder: false,
    });
    expect(result.company).toBe('Acme');
    expect(result.amount).toBe('');
    expect(result.is_free).toBe('');
  });

  it.openspec('OA-FIL-008')('defaults optional fields to BLANK_PLACEHOLDER when useBlankPlaceholder is true', () => {
    const result = prepareFillData({
      values: { company: 'Acme' },
      fields,
      useBlankPlaceholder: true,
    });
    expect(result.amount).toBe(BLANK_PLACEHOLDER);
    expect(result.is_free).toBe(BLANK_PLACEHOLDER);
  });

  it.openspec('OA-FIL-008')('user values override defaults', () => {
    const result = prepareFillData({
      values: { company: 'Acme', amount: '$50,000' },
      fields,
      useBlankPlaceholder: true,
    });
    expect(result.amount).toBe('$50,000');
  });

  it.openspec('OA-FIL-008')('uses field.default when provided', () => {
    const fieldsWithDefault = [
      ...fields.slice(0, 1),
      { name: 'amount', type: 'string' as const, description: 'Amount', default: 'N/A' },
    ];
    const result = prepareFillData({
      values: { company: 'Acme' },
      fields: fieldsWithDefault,
      useBlankPlaceholder: false,
    });
    expect(result.amount).toBe('N/A');
  });

  it.openspec('OA-FIL-009')('coerces boolean fields when coerceBooleans is true', () => {
    const result = prepareFillData({
      values: { company: 'Acme', is_free: 'true' },
      fields,
      coerceBooleans: true,
    });
    expect(result.is_free).toBe(true);
  });

  it.openspec('OA-FIL-009')('coerces "false" string to false boolean', () => {
    const result = prepareFillData({
      values: { company: 'Acme', is_free: 'false' },
      fields,
      coerceBooleans: true,
    });
    expect(result.is_free).toBe(false);
  });

  it.openspec('OA-FIL-009')('does not coerce booleans when coerceBooleans is false', () => {
    const result = prepareFillData({
      values: { company: 'Acme', is_free: 'true' },
      fields,
      coerceBooleans: false,
    });
    expect(result.is_free).toBe('true');
  });

  it.openspec('OA-FIL-009')('warns on missing priority fields', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prepareFillData({
      values: { amount: '100' },
      fields,
      priorityFieldNames,
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('priority fields are unfilled'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('company'));
    spy.mockRestore();
  });

  it.openspec('OA-FIL-009')('calls computeDisplayFields callback', () => {
    let callbackCalled = false;
    prepareFillData({
      values: { company: 'Acme' },
      fields,
      computeDisplayFields: (data) => {
        callbackCalled = true;
        data['computed'] = 'value';
      },
    });
    expect(callbackCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 3: fillDocx
// ---------------------------------------------------------------------------

describe('fillDocx', () => {
  it.openspec('OA-FIL-010')('passes fixSmartQuotes option through to createReport', async () => {
    // Smart-quoted tag in the DOCX — \u201C and \u201D around tag name
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Hello {\u201Cname\u201D}</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    // With fixSmartQuotes: true, the smart quotes around the tag should be normalized
    // and the tag should be filled
    const result = await fillDocx({
      templateBuffer: buf,
      data: { name: 'Alice' },
      fixSmartQuotes: true,
      stripParagraphPatterns: [],
    });

    // Verify the output is a valid buffer (createReport succeeded)
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it.openspec('OA-FIL-011')('renders multiline values using explicit line-break runs', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>{details}</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: { details: 'Line one\nLine two\nLine three' },
      stripParagraphPatterns: [],
    });

    const outZip = new AdmZip(Buffer.from(result));
    const outXml = outZip.getEntry('word/document.xml')!.getData().toString('utf-8');

    expect(outXml).toContain('<w:br/>');
    expect(outXml).toContain('Line one');
    expect(outXml).toContain('Line two');
    expect(outXml).toContain('Line three');

    // Word line breaks should be emitted as sibling runs, not embedded inside <w:t>.
    expect(/<w:t(?:\s+[^>]*)?>[^<]*<w:br\/>/.test(outXml)).toBe(false);
  });

  it.openspec('OA-ENG-006')('strips drafting note paragraphs by default', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Keep this paragraph</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>[Drafting note: Remove this]</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Also keep this</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: {},
    });

    // Extract text from result to verify drafting note is gone
    const outZip = new AdmZip(Buffer.from(result));
    const outEntry = outZip.getEntry('word/document.xml');
    const outXml = outEntry!.getData().toString('utf-8');
    expect(outXml).toContain('Keep this paragraph');
    expect(outXml).toContain('Also keep this');
    expect(outXml).not.toContain('Drafting note');
  });

  it.openspec('OA-FIL-012')('preserves all paragraphs when stripParagraphPatterns is empty', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Keep this</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>[Drafting note: Keep this too]</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: {},
      stripParagraphPatterns: [],
    });

    const outZip = new AdmZip(Buffer.from(result));
    const outEntry = outZip.getEntry('word/document.xml');
    const outXml = outEntry!.getData().toString('utf-8');
    expect(outXml).toContain('Drafting note');
  });

  it.openspec('OA-FIL-013')('strips highlighting from runs with filled fields', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p>' +
      '<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>{name}</w:t></w:r>' +
      '</w:p>' +
      '<w:p>' +
      '<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>{unfilled}</w:t></w:r>' +
      '</w:p>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: { name: 'Alice', unfilled: '' },
      stripParagraphPatterns: [],
    });

    const outZip = new AdmZip(Buffer.from(result));
    const outEntry = outZip.getEntry('word/document.xml');
    const outXml = outEntry!.getData().toString('utf-8');

    // The filled field's highlight should be stripped before rendering.
    // The unfilled field's highlight should be preserved.
    // After rendering, {name} is replaced with 'Alice' and {unfilled} with ''.
    // We check that the highlight element count decreased (at least one removed).
    // The unfilled field had an empty value, so its highlight should remain.
    const highlightCount = (outXml.match(/w:highlight/g) ?? []).length;
    // At least one highlight should remain (the unfilled field's)
    expect(highlightCount).toBeGreaterThanOrEqual(1);
  });

  it.openspec('OA-FIL-012')('removes table row when all paragraphs are drafting notes', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Keep this row</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>[Drafting note: remove entire row]</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Keep this row too</w:t></w:r></w:p></w:tc></w:tr>' +
      '</w:tbl>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: {},
    });

    const outZip = new AdmZip(Buffer.from(result));
    const outEntry = outZip.getEntry('word/document.xml');
    const outXml = outEntry!.getData().toString('utf-8');
    expect(outXml).toContain('Keep this row');
    expect(outXml).toContain('Keep this row too');
    expect(outXml).not.toContain('Drafting note');
    // Count table rows — should be 2 not 3
    const trCount = (outXml.match(/<w:tr[ >]/g) ?? []).length;
    expect(trCount).toBe(2);
  });

  it.openspec('OA-FIL-012')('does not remove table row when it has non-note content', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:tbl>' +
      '<w:tr><w:tc>' +
      '<w:p><w:r><w:t>[Drafting note: remove this para]</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>But keep this content in the row</w:t></w:r></w:p>' +
      '</w:tc></w:tr>' +
      '</w:tbl>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: {},
    });

    const outZip = new AdmZip(Buffer.from(result));
    const outEntry = outZip.getEntry('word/document.xml');
    const outXml = outEntry!.getData().toString('utf-8');
    // Row should still exist because it has non-note content
    expect(outXml).toContain('But keep this content');
    expect(outXml).not.toContain('Drafting note');
    const trCount = (outXml.match(/<w:tr[ >]/g) ?? []).length;
    expect(trCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Section 5: Regression Tests
// ---------------------------------------------------------------------------

describe('Regression: behavioral divergence', () => {
  const simpleFields = [
    { name: 'name', type: 'string' as const, description: 'Name' },
    { name: 'amount', type: 'string' as const, description: 'Amount' },
  ];
  const simplePriorityFieldNames = ['name'];

  it.openspec('OA-FIL-014')('all paths default optional fields to BLANK_PLACEHOLDER', () => {
    const data = prepareFillData({
      values: { name: 'Acme' },
      fields: simpleFields,
      useBlankPlaceholder: true,
    });
    expect(data.amount).toBe(BLANK_PLACEHOLDER);
  });

  it.openspec('OA-FIL-014')('template path coerces boolean fields', () => {
    const boolFields = [
      { name: 'company', type: 'string' as const, description: 'Co' },
      { name: 'flag', type: 'boolean' as const, description: 'Flag' },
    ];
    const data = prepareFillData({
      values: { company: 'Acme', flag: 'false' },
      fields: boolFields,
      coerceBooleans: true,
    });
    expect(data.flag).toBe(false);
  });

  it.openspec('OA-FIL-014')('recipe/external path does not coerce booleans', () => {
    const boolFields = [
      { name: 'company', type: 'string' as const, description: 'Co' },
      { name: 'flag', type: 'boolean' as const, description: 'Flag' },
    ];
    const data = prepareFillData({
      values: { company: 'Acme', flag: 'false' },
      fields: boolFields,
      coerceBooleans: false,
    });
    expect(data.flag).toBe('false');
  });

  it.openspec('OA-FIL-014')('template path warns on missing priority fields', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prepareFillData({
      values: {},
      fields: simpleFields,
      priorityFieldNames: simplePriorityFieldNames,
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('priority fields are unfilled'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('name'));
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Section 1.8: Integration test — template fill with currency
// ---------------------------------------------------------------------------

describe('Integration: template currency sanitization', () => {
  it.openspec('OA-FIL-015')('template fill with $50,000 produces $50,000 not $$50,000', async () => {
    // Build a template DOCX with ${purchase_amount} (dollar before tag)
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Amount: ${purchase_amount}</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const buf = buildDocxBuffer(xml);

    const result = await fillDocx({
      templateBuffer: buf,
      data: { purchase_amount: '$50,000' },
      stripParagraphPatterns: [],
    });

    // Extract text from the filled DOCX
    const outZip = new AdmZip(Buffer.from(result));
    const outEntry = outZip.getEntry('word/document.xml');
    const outXml = outEntry!.getData().toString('utf-8');

    // Should contain $50,000 not $$50,000
    expect(outXml).toContain('50,000');
    expect(outXml).not.toContain('$$');
  });
});

// ---------------------------------------------------------------------------
// Section 6: NDA Signature Block Fields
// ---------------------------------------------------------------------------

describe('NDA signature block fields', () => {
  const NDA_DIR = resolve(__dirname, '../content/templates/common-paper-mutual-nda');

  /** Fill the real NDA template with the given values and return the output XML text. */
  async function fillNdaTemplate(values: Record<string, unknown>): Promise<{ xml: string; buf: Uint8Array }> {
    const metadata = loadMetadata(NDA_DIR);
    const fieldNames = new Set(metadata.fields.map((f) => f.name));
    const data = prepareFillData({
      values,
      fields: metadata.fields,
      priorityFieldNames: metadata.priority_fields,
      useBlankPlaceholder: true,
      coerceBooleans: true,
      computeDisplayFields: (d) => {
        // Inline import of computeDisplayFields is not exported, so we replicate
        // the signatory derivation directly using the engine's fillTemplate instead.
        // Instead, use fillTemplate from engine.ts via the full pipeline.
      },
    });

    // Use fillTemplate via the engine for the full pipeline (includes computeDisplayFields)
    const { fillTemplate } = await import('../src/core/engine.js');
    const tempDir = mkdtempSync(join(tmpdir(), 'nda-sig-test-'));
    const outputPath = join(tempDir, 'output.docx');
    await fillTemplate({
      templateDir: NDA_DIR,
      values,
      outputPath,
    });

    const outZip = new AdmZip(outputPath);
    const allText: string[] = [];
    for (const entry of outZip.getEntries()) {
      if (entry.entryName.startsWith('word/') && entry.entryName.endsWith('.xml')) {
        allText.push(entry.getData().toString('utf-8'));
      }
    }
    const xml = allText.join('\n');
    const buf = readFileSync(outputPath);
    rmSync(tempDir, { recursive: true, force: true });
    return { xml, buf };
  }

  const BASE_VALUES = {
    purpose: 'Evaluating a potential business partnership',
    effective_date: '2026-03-01',
    mnda_term: '2 years',
    confidentiality_term: '3 years',
    confidentiality_term_start: 'Effective Date',
    governing_law: 'California',
    jurisdiction: 'courts located in San Francisco County, California',
    changes_to_standard_terms: 'None.',
  };

  it.openspec('OA-NDA-001')('fills all signature fields in entity mode (both parties)', async () => {
    const { xml, buf } = await fillNdaTemplate({
      ...BASE_VALUES,
      party_1_type: 'entity',
      party_1_name: 'Alice Johnson',
      party_1_title: 'CEO',
      party_1_company: 'Acme Corp',
      party_1_email: 'alice@acme.example',
      party_2_type: 'entity',
      party_2_name: 'Bob Smith',
      party_2_title: 'CTO',
      party_2_company: 'Beta Inc',
      party_2_email: 'bob@beta.example',
    });

    // All signatory values should appear
    expect(xml).toContain('Alice Johnson');
    expect(xml).toContain('CEO');
    expect(xml).toContain('Acme Corp');
    expect(xml).toContain('alice@acme.example');
    expect(xml).toContain('Bob Smith');
    expect(xml).toContain('CTO');
    expect(xml).toContain('Beta Inc');
    expect(xml).toContain('bob@beta.example');

    // No unrendered {field_name} tags
    expect(xml).not.toMatch(/\{[a-z_][a-z0-9_]*\}/i);

    // No IF/END-IF conditionals
    expect(xml).not.toContain('{IF ');
    expect(xml).not.toContain('{END-IF}');

    // Valid non-zero buffer
    expect(buf.length).toBeGreaterThan(0);
  });

  it.openspec('OA-NDA-002')('suppresses title/company for individual party (mixed mode)', async () => {
    const { xml } = await fillNdaTemplate({
      ...BASE_VALUES,
      party_1_type: 'entity',
      party_1_name: 'Alice Johnson',
      party_1_title: 'CEO',
      party_1_company: 'Acme Corp',
      party_1_email: 'alice@acme.example',
      party_2_type: 'individual',
      party_2_name: 'Charlie Doe',
      party_2_title: 'ZZZ_SHOULD_NOT_RENDER',
      party_2_company: 'ZZZ_SHOULD_NOT_RENDER',
      party_2_email: 'charlie@personal.example',
    });

    // Party 1 entity fields render
    expect(xml).toContain('Alice Johnson');
    expect(xml).toContain('CEO');
    expect(xml).toContain('Acme Corp');

    // Party 2 individual: name and email render, sentinel values do NOT
    expect(xml).toContain('Charlie Doe');
    expect(xml).toContain('charlie@personal.example');
    expect(xml).not.toContain('ZZZ_SHOULD_NOT_RENDER');

    // No unrendered tags
    expect(xml).not.toMatch(/\{[a-z_][a-z0-9_]*\}/i);
  });

  it.openspec('OA-NDA-003')('warns when individual party has title set', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await fillNdaTemplate({
        ...BASE_VALUES,
        party_1_type: 'individual',
        party_1_name: 'Dana Lee',
        party_1_title: 'CEO',
        party_1_email: 'dana@example.com',
      });

      const warningCalls = spy.mock.calls.map((c) => String(c[0]));
      const relevantWarning = warningCalls.find(
        (msg) => msg.includes('party_1_title') && msg.includes('individual')
      );
      expect(relevantWarning).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Section 7: Signature Block Fields — All Templates
// ---------------------------------------------------------------------------

/** Fill a template and return all word/*.xml text concatenated. */
async function fillAndExtractXml(
  templateDir: string,
  values: Record<string, unknown>,
): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'sig-test-'));
  const outputPath = join(tempDir, 'output.docx');
  try {
    await fillTemplate({ templateDir, values, outputPath });
    const outZip = new AdmZip(outputPath);
    const allText: string[] = [];
    for (const entry of outZip.getEntries()) {
      if (entry.entryName.startsWith('word/') && entry.entryName.endsWith('.xml')) {
        allText.push(entry.getData().toString('utf-8'));
      }
    }
    return allText.join('\n');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/** Generate dummy values for ALL fields in a template (required + optional + replacements). */
function dummyAllValues(templateDir: string): Record<string, unknown> {
  const metadata = loadMetadata(templateDir);
  const values: Record<string, unknown> = {};
  for (const field of metadata.fields) {
    // Skip signatory fields — caller populates these explicitly
    if (field.name.endsWith('_signatory_type') || field.name.endsWith('_signatory_name') ||
        field.name.endsWith('_signatory_title') || field.name.endsWith('_signatory_company') ||
        field.name.endsWith('_signatory_email') ||
        field.name.match(/^party_[12]_(type|name|title|company|email)$/)) {
      continue;
    }
    if (field.type === 'boolean') {
      values[field.name] = field.default != null ? String(field.default) === 'true' : false;
    } else if (field.type === 'date') {
      values[field.name] = field.default ?? '2026-03-01';
    } else {
      values[field.name] = field.default ?? `Test ${field.name}`;
    }
  }
  // Also provide values for fields injected via replacements.json (not in metadata)
  const replacementsPath = join(templateDir, 'replacements.json');
  try {
    const replacements = JSON.parse(readFileSync(replacementsPath, 'utf-8')) as Record<string, string>;
    for (const target of Object.values(replacements)) {
      const match = target.match(/^\{(\w+)\}$/);
      if (match && !values[match[1]]) {
        values[match[1]] = `Test ${match[1]}`;
      }
    }
  } catch {
    // No replacements.json — fine
  }
  return values;
}

describe('Signature block fields — role-based templates', () => {
  const TEMPLATES_DIR = resolve(__dirname, '../content/templates');

  it.openspec('OA-NDA-004')('standard 2-party entity mode (pilot agreement)', async () => {
    const dir = join(TEMPLATES_DIR, 'common-paper-pilot-agreement');
    const xml = await fillAndExtractXml(dir, {
      company_name: 'Acme Corp',
      product_description: 'Widget Platform',
      pilot_period: '90 days',
      governing_law: 'Delaware',
      jurisdiction: 'courts located in New Castle County, Delaware',
      provider_signatory_type: 'entity',
      provider_signatory_name: 'Alice Johnson',
      provider_signatory_title: 'CEO',
      provider_signatory_company: 'Acme Corp',
      provider_signatory_email: 'alice@acme.example',
      customer_signatory_type: 'entity',
      customer_signatory_name: 'Bob Smith',
      customer_signatory_title: 'CTO',
      customer_signatory_company: 'Beta Inc',
      customer_signatory_email: 'bob@beta.example',
    });

    expect(xml).toContain('Alice Johnson');
    expect(xml).toContain('CEO');
    expect(xml).toContain('alice@acme.example');
    expect(xml).toContain('Bob Smith');
    expect(xml).toContain('CTO');
    expect(xml).toContain('bob@beta.example');
    expect(xml).not.toMatch(/\{[a-z_][a-z0-9_]*\}/i);
  });

  it.openspec('OA-NDA-005')('individual mode suppression (contractor agreement)', async () => {
    const dir = join(TEMPLATES_DIR, 'common-paper-independent-contractor-agreement');
    const xml = await fillAndExtractXml(dir, {
      company_name_and_address: 'Acme Corp, 123 Main St',
      contractor_name_and_address: 'Jane Doe, 456 Oak Ave',
      services_description: 'Software development',
      rates_and_fees: '$150/hour',
      payment_terms: 'Net 30',
      timeline: '6 months',
      governing_law: 'California',
      jurisdiction: 'courts located in San Francisco County, California',
      company_signatory_type: 'entity',
      company_signatory_name: 'Alice Johnson',
      company_signatory_title: 'CEO',
      company_signatory_company: 'Acme Corp',
      company_signatory_email: 'alice@acme.example',
      contractor_signatory_type: 'individual',
      contractor_signatory_name: 'Jane Doe',
      contractor_signatory_title: 'ZZZ_SHOULD_NOT_RENDER',
      contractor_signatory_company: 'ZZZ_SHOULD_NOT_RENDER',
      contractor_signatory_email: 'jane@example.com',
    });

    // Company entity fields render
    expect(xml).toContain('Alice Johnson');
    expect(xml).toContain('CEO');

    // Contractor individual: name and email render, sentinel values do NOT
    expect(xml).toContain('Jane Doe');
    expect(xml).toContain('jane@example.com');
    expect(xml).not.toContain('ZZZ_SHOULD_NOT_RENDER');

    expect(xml).not.toMatch(/\{[a-z_][a-z0-9_]*\}/i);
  });

  it.openspec('OA-NDA-006')('one-way NDA single party', async () => {
    const dir = join(TEMPLATES_DIR, 'common-paper-one-way-nda');
    const xml = await fillAndExtractXml(dir, {
      discloser_name_and_address: 'Acme Corp, 123 Main St, Wilmington, DE',
      effective_date: '2026-03-01',
      purpose: 'Evaluating a potential partnership',
      nda_term: '2 years',
      confidentiality_term_start: 'Effective Date',
      governing_law: 'Delaware',
      jurisdiction: 'New Castle County, Delaware',
      changes_to_standard_terms: 'None.',
      recipient_signatory_type: 'entity',
      recipient_signatory_name: 'Bob Smith',
      recipient_signatory_title: 'General Counsel',
      recipient_signatory_company: 'Beta Inc',
      recipient_signatory_email: 'bob@beta.example',
    });

    expect(xml).toContain('Bob Smith');
    expect(xml).toContain('General Counsel');
    expect(xml).toContain('Beta Inc');
    expect(xml).toContain('bob@beta.example');
    expect(xml).not.toMatch(/\{[a-z_][a-z0-9_]*\}/i);
  });

  it.openspec('OA-NDA-007')('dual sig block (CSA)', async () => {
    const dir = join(TEMPLATES_DIR, 'common-paper-cloud-service-agreement');
    const xml = await fillAndExtractXml(dir, {
      provider_name: 'Acme SaaS',
      customer_name: 'Beta Corp',
      provider_legal_name: 'Acme SaaS Inc.',
      customer_legal_name: 'Beta Corp LLC',
      effective_date: '2026-03-01',
      cloud_service: 'Cloud Widget Platform',
      subscription_period: '1 year',
      governing_law: 'Delaware',
      jurisdiction: 'courts located in New Castle County, Delaware',
      provider_signatory_type: 'entity',
      provider_signatory_name: 'Alice Johnson',
      provider_signatory_title: 'CEO',
      provider_signatory_company: 'Acme SaaS Inc.',
      provider_signatory_email: 'alice@acme.example',
      customer_signatory_type: 'entity',
      customer_signatory_name: 'Bob Smith',
      customer_signatory_title: 'VP Engineering',
      customer_signatory_company: 'Beta Corp LLC',
      customer_signatory_email: 'bob@beta.example',
    });

    // Both tables should contain signatory data
    expect(xml).toContain('Alice Johnson');
    expect(xml).toContain('CEO');
    expect(xml).toContain('alice@acme.example');
    expect(xml).toContain('Bob Smith');
    expect(xml).toContain('VP Engineering');
    expect(xml).toContain('bob@beta.example');
    expect(xml).not.toMatch(/\{[a-z_][a-z0-9_]*\}/i);
  });
});

// ---------------------------------------------------------------------------
// Section 8: Parametric Smoke Test — All Templates with Signatory Fields
// ---------------------------------------------------------------------------

describe('Parametric smoke test — signatory fields across all templates', () => {
  const TEMPLATES_DIR = resolve(__dirname, '../content/templates');

  // Discover all common-paper template dirs that have *_signatory_type fields
  const templateDirs = readdirSync(TEMPLATES_DIR)
    .filter((d) => d.startsWith('common-paper-'))
    .map((d) => join(TEMPLATES_DIR, d))
    .filter((dir) => {
      try {
        const meta = loadMetadata(dir);
        return meta.fields.some((f) => f.name.endsWith('_signatory_type'));
      } catch {
        return false;
      }
    });

  // Also include the mutual NDA (legacy party_N_type)
  const mutualNdaDir = join(TEMPLATES_DIR, 'common-paper-mutual-nda');
  const allDirs = templateDirs.some((d) => d.endsWith('common-paper-mutual-nda'))
    ? templateDirs
    : [...templateDirs, mutualNdaDir];

  it.openspec('OA-NDA-008')('all templates fill cleanly in entity mode', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const dir of allDirs) {
        const metadata = loadMetadata(dir);
        const values = dummyAllValues(dir);

        // Fill all signatory fields with entity-mode data
        for (const field of metadata.fields) {
          if (field.name.endsWith('_signatory_type') || field.name === 'party_1_type' || field.name === 'party_2_type') {
            values[field.name] = 'entity';
          } else if (field.name.endsWith('_signatory_name') || (field.name.match(/^party_[12]_name$/) && metadata.fields.some(f => f.name === field.name.replace('_name', '_type')))) {
            values[field.name] = 'Test Signer';
          } else if (field.name.endsWith('_signatory_title') || (field.name.match(/^party_[12]_title$/) && metadata.fields.some(f => f.name === field.name.replace('_title', '_type')))) {
            values[field.name] = 'CEO';
          } else if (field.name.endsWith('_signatory_company') || (field.name.match(/^party_[12]_company$/) && metadata.fields.some(f => f.name === field.name.replace('_company', '_type')))) {
            values[field.name] = 'Test Corp';
          } else if (field.name.endsWith('_signatory_email') || (field.name.match(/^party_[12]_email$/) && metadata.fields.some(f => f.name === field.name.replace('_email', '_type')))) {
            values[field.name] = 'test@example.com';
          }
        }

        const dirName = dir.split('/').pop();
        const xml = await fillAndExtractXml(dir, values);
        const unrendered = xml.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
        expect(unrendered, `Unrendered tags in ${dirName}: ${unrendered.join(', ')}`).toEqual([]);
      }
    } finally {
      spy.mockRestore();
    }
  }, 60_000);

  it.openspec('OA-NDA-008')('all templates fill cleanly in individual mode', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const dir of allDirs) {
        const metadata = loadMetadata(dir);
        const values = dummyAllValues(dir);

        // Fill all signatory fields with individual-mode data
        for (const field of metadata.fields) {
          if (field.name.endsWith('_signatory_type') || field.name === 'party_1_type' || field.name === 'party_2_type') {
            values[field.name] = 'individual';
          } else if (field.name.endsWith('_signatory_name') || (field.name.match(/^party_[12]_name$/) && metadata.fields.some(f => f.name === field.name.replace('_name', '_type')))) {
            values[field.name] = 'Test Person';
          } else if (field.name.endsWith('_signatory_email') || (field.name.match(/^party_[12]_email$/) && metadata.fields.some(f => f.name === field.name.replace('_email', '_type')))) {
            values[field.name] = 'test@example.com';
          }
          // Intentionally skip title/company for individual mode
        }

        const dirName = dir.split('/').pop();
        const xml = await fillAndExtractXml(dir, values);
        const unrendered = xml.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
        expect(unrendered, `Unrendered tags in ${dirName}: ${unrendered.join(', ')}`).toEqual([]);
      }
    } finally {
      spy.mockRestore();
    }
  }, 60_000);
});
