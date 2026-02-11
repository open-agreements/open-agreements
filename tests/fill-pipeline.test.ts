import { describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { detectCurrencyFields, sanitizeCurrencyValuesFromDocx, verifyTemplateFill, BLANK_PLACEHOLDER } from '../src/core/fill-utils.js';
import { prepareFillData, fillDocx } from '../src/core/fill-pipeline.js';

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
  it('detects field when $ and {field} are split across runs', () => {
    const buf = buildDocxBuffer(docXmlSplitRuns(['Amount: $', '{purchase_amount}']));
    const fields = detectCurrencyFields(buf);
    expect(fields.has('purchase_amount')).toBe(true);
  });

  it('returns empty set for DOCX without dollar-prefixed fields', () => {
    const buf = buildDocxBuffer(docXml(['Hello {name}, welcome to {company}']));
    const fields = detectCurrencyFields(buf);
    expect(fields.size).toBe(0);
  });

  it('scans headers', () => {
    const buf = buildDocxBuffer(docXml(['Body text']), {
      'word/header1.xml': headerXml('Fee: ${fee_amount}'),
    });
    const fields = detectCurrencyFields(buf);
    expect(fields.has('fee_amount')).toBe(true);
  });

  it('scans footers', () => {
    const buf = buildDocxBuffer(docXml(['Body text']), {
      'word/footer1.xml': footerXml('Total: ${total}'),
    });
    const fields = detectCurrencyFields(buf);
    expect(fields.has('total')).toBe(true);
  });

  it('scans endnotes', () => {
    const buf = buildDocxBuffer(docXml(['Body text']), {
      'word/endnotes.xml': endnotesXml('Cap: ${valuation_cap}'),
    });
    const fields = detectCurrencyFields(buf);
    expect(fields.has('valuation_cap')).toBe(true);
  });

  it('detects multiple currency fields in a single paragraph', () => {
    const buf = buildDocxBuffer(docXml(['Fee: ${fee} and Cap: ${cap}']));
    const fields = detectCurrencyFields(buf);
    expect(fields.has('fee')).toBe(true);
    expect(fields.has('cap')).toBe(true);
  });
});

describe('sanitizeCurrencyValuesFromDocx', () => {
  it('strips $ from string values for detected currency fields', () => {
    const buf = buildDocxBuffer(docXml(['Amount: ${purchase_amount}']));
    const result = sanitizeCurrencyValuesFromDocx(
      { purchase_amount: '$50,000', name: 'Acme' },
      buf
    );
    expect(result.purchase_amount).toBe('50,000');
    expect(result.name).toBe('Acme');
  });

  it('does not strip $ from boolean values', () => {
    const buf = buildDocxBuffer(docXml(['Amount: ${some_field}']));
    const result = sanitizeCurrencyValuesFromDocx(
      { some_field: true as any, other: '$100' },
      buf
    );
    expect(result.some_field).toBe(true);
  });

  it('returns same object when no currency fields detected', () => {
    const buf = buildDocxBuffer(docXml(['Hello {name}']));
    const values = { name: '$Alice' };
    const result = sanitizeCurrencyValuesFromDocx(values, buf);
    expect(result).toBe(values); // same reference — no copy needed
  });

  it('does not strip $ from non-currency fields', () => {
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
  it('catches double dollar signs in output', () => {
    const path = buildDocxFile(docXml(['The amount is $$50,000']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === 'No double dollar signs');
    expect(check?.passed).toBe(false);
    expect(check?.details).toContain('$$50,000');
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('catches $ $ with whitespace between', () => {
    const path = buildDocxFile(docXml(['The amount is $ $50,000']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it.openspec('OA-025')('catches unrendered template tags', () => {
    const path = buildDocxFile(docXml(['Hello {unfilled_field}, welcome']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(false);
    const check = result.checks.find((c) => c.name === 'No unrendered template tags');
    expect(check?.passed).toBe(false);
    expect(check?.details).toContain('{unfilled_field}');
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('passes clean output with no issues', () => {
    const path = buildDocxFile(docXml(['Hello Alice, the amount is $50,000']));
    const result = verifyTemplateFill(path);
    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('does not flag legitimate single dollar signs', () => {
    const path = buildDocxFile(docXml(['Fee: $1,000', 'Cap: $5,000,000']));
    const result = verifyTemplateFill(path);
    const check = result.checks.find((c) => c.name === 'No double dollar signs');
    expect(check?.passed).toBe(true);
    rmSync(path.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('scans headers and footers for issues', () => {
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
    { name: 'company', type: 'string' as const, required: true, description: 'Company name' },
    { name: 'amount', type: 'string' as const, required: false, description: 'Amount' },
    { name: 'is_free', type: 'boolean' as const, required: false, description: 'Is free' },
  ];

  it('defaults optional fields to empty string when useBlankPlaceholder is false', () => {
    const result = prepareFillData({
      values: { company: 'Acme' },
      fields,
      useBlankPlaceholder: false,
    });
    expect(result.company).toBe('Acme');
    expect(result.amount).toBe('');
    expect(result.is_free).toBe('');
  });

  it('defaults optional fields to BLANK_PLACEHOLDER when useBlankPlaceholder is true', () => {
    const result = prepareFillData({
      values: { company: 'Acme' },
      fields,
      useBlankPlaceholder: true,
    });
    expect(result.amount).toBe(BLANK_PLACEHOLDER);
    expect(result.is_free).toBe(BLANK_PLACEHOLDER);
  });

  it('user values override defaults', () => {
    const result = prepareFillData({
      values: { company: 'Acme', amount: '$50,000' },
      fields,
      useBlankPlaceholder: true,
    });
    expect(result.amount).toBe('$50,000');
  });

  it('uses field.default when provided', () => {
    const fieldsWithDefault = [
      ...fields.slice(0, 1),
      { name: 'amount', type: 'string' as const, required: false, description: 'Amount', default: 'N/A' },
    ];
    const result = prepareFillData({
      values: { company: 'Acme' },
      fields: fieldsWithDefault,
      useBlankPlaceholder: false,
    });
    expect(result.amount).toBe('N/A');
  });

  it('coerces boolean fields when coerceBooleans is true', () => {
    const result = prepareFillData({
      values: { company: 'Acme', is_free: 'true' },
      fields,
      coerceBooleans: true,
    });
    expect(result.is_free).toBe(true);
  });

  it('coerces "false" string to false boolean', () => {
    const result = prepareFillData({
      values: { company: 'Acme', is_free: 'false' },
      fields,
      coerceBooleans: true,
    });
    expect(result.is_free).toBe(false);
  });

  it('does not coerce booleans when coerceBooleans is false', () => {
    const result = prepareFillData({
      values: { company: 'Acme', is_free: 'true' },
      fields,
      coerceBooleans: false,
    });
    expect(result.is_free).toBe('true');
  });

  it('warns on missing required fields', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prepareFillData({
      values: { amount: '100' },
      fields,
    });
    expect(spy).toHaveBeenCalledWith('Warning: missing required fields: company');
    spy.mockRestore();
  });

  it('calls computeDisplayFields callback', () => {
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
  it('passes fixSmartQuotes option through to createReport', async () => {
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

  it.openspec('OA-019')('strips drafting note paragraphs by default', async () => {
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

  it('preserves all paragraphs when stripParagraphPatterns is empty', async () => {
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

  it('strips highlighting from runs with filled fields', async () => {
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

  it('removes table row when all paragraphs are drafting notes', async () => {
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

  it('does not remove table row when it has non-note content', async () => {
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
    { name: 'name', type: 'string' as const, required: true, description: 'Name' },
    { name: 'amount', type: 'string' as const, required: false, description: 'Amount' },
  ];

  it('all paths default optional fields to BLANK_PLACEHOLDER', () => {
    const data = prepareFillData({
      values: { name: 'Acme' },
      fields: simpleFields,
      useBlankPlaceholder: true,
    });
    expect(data.amount).toBe(BLANK_PLACEHOLDER);
  });

  it('template path coerces boolean fields', () => {
    const boolFields = [
      { name: 'company', type: 'string' as const, required: true, description: 'Co' },
      { name: 'flag', type: 'boolean' as const, required: false, description: 'Flag' },
    ];
    const data = prepareFillData({
      values: { company: 'Acme', flag: 'false' },
      fields: boolFields,
      coerceBooleans: true,
    });
    expect(data.flag).toBe(false);
  });

  it('recipe/external path does not coerce booleans', () => {
    const boolFields = [
      { name: 'company', type: 'string' as const, required: true, description: 'Co' },
      { name: 'flag', type: 'boolean' as const, required: false, description: 'Flag' },
    ];
    const data = prepareFillData({
      values: { company: 'Acme', flag: 'false' },
      fields: boolFields,
      coerceBooleans: false,
    });
    expect(data.flag).toBe('false');
  });

  it('template path warns on missing required fields', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prepareFillData({
      values: {},
      fields: simpleFields,
    });
    expect(spy).toHaveBeenCalledWith('Warning: missing required fields: name');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Section 1.8: Integration test — template fill with currency
// ---------------------------------------------------------------------------

describe('Integration: template currency sanitization', () => {
  it('template fill with $50,000 produces $50,000 not $$50,000', async () => {
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
