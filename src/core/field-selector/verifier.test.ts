import { describe, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import {
  verifyOutput,
  normalizeText,
  findLeftoverPlaceholders,
  findRenderedTextArtifacts,
  validateWordFields,
} from './verifier.js';
import { patchDocument } from './patcher.js';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Verification & Drift');

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '</Types>';

function buildDocx(documentXml: string, additionalParts?: Record<string, string>): string {
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  if (additionalParts) {
    for (const [name, content] of Object.entries(additionalParts)) {
      zip.addFile(name, Buffer.from(content, 'utf-8'));
    }
  }
  const tempDir = mkdtempSync(join(tmpdir(), 'verifier-test-'));
  const docxPath = join(tempDir, 'test.docx');
  zip.writeZip(docxPath);
  return docxPath;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build a DOCX whose body is one plain-text paragraph per supplied string. */
function buildTextDocx(paragraphs: string[]): string {
  const body = paragraphs
    .map((t) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r></w:p>`)
    .join('');
  return buildDocx(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`
  );
}

/**
 * Build a DOCX with `count` formatting anomalies: each is a single-character
 * underlined run immediately followed by a non-underlined run (the pattern
 * countFormattingAnomalies() flags).
 */
function buildAnomalyDocx(count: number): string {
  const paras: string[] = [];
  for (let i = 0; i < count; i++) {
    paras.push(
      '<w:p>' +
        '<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>A</w:t></w:r>' +
        '<w:r><w:t>bc</w:t></w:r>' +
        '</w:p>'
    );
  }
  return buildDocx(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>${paras.join('')}</w:body></w:document>`
  );
}

function cleanupDocx(...docxPaths: string[]): void {
  for (const p of docxPaths) {
    rmSync(p.replace('/test.docx', ''), { recursive: true, force: true });
  }
}

async function runVerificationWithTrace(
  docxPath: string,
  values: Record<string, string>,
  replacements: Record<string, string>
) {
  await allureJsonAttachment('verify-input-values.json', values);
  await allureJsonAttachment('verify-input-replacements.json', replacements);
  const result = await allureStep('Run verifyOutput', () => verifyOutput(docxPath, values, replacements));
  await allureJsonAttachment('verify-output-result.json', result);
  return result;
}

describe('normalizeText', () => {
  it('converts non-breaking spaces to regular spaces', () => {
    expect(normalizeText('hello\u00A0world')).toBe('hello world');
    expect(normalizeText('hello\u2007world')).toBe('hello world');
    expect(normalizeText('hello\u202Fworld')).toBe('hello world');
  });

  it('normalizes smart single quotes', () => {
    expect(normalizeText('\u2018hello\u2019')).toBe("'hello'");
    expect(normalizeText('\u2039hi\u203A')).toBe("'hi'");
  });

  it('normalizes smart double quotes', () => {
    expect(normalizeText('\u201Chello\u201D')).toBe('"hello"');
    expect(normalizeText('\u00ABhi\u00BB')).toBe('"hi"');
    expect(normalizeText('\u201Ahi\u201E')).toBe('"hi"');
  });

  it('collapses horizontal whitespace to single space', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
    expect(normalizeText('hello\t\tworld')).toBe('hello world');
  });

  it('preserves newlines', () => {
    expect(normalizeText('hello\nworld')).toBe('hello\nworld');
  });

  it('trims', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });
});

describe('verifyOutput note-reference cleanup', () => {
  it('fails removeFootnotes verification for either inline reference type', async () => {
    const config = {
      removeFootnotes: true,
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    };

    for (const reference of ['footnoteReference', 'endnoteReference']) {
      const docxPath = buildDocx(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r>` +
          `<w:${reference} w:id="1"/>` +
          '</w:r></w:p></w:body></w:document>'
      );
      const result = await verifyOutput(docxPath, {}, {}, config);
      const check = result.checks.find((item) => item.name === 'Footnotes removed');
      expect(check?.passed, reference).toBe(false);
      cleanupDocx(docxPath);
    }
  });
});

describe('verifyOutput', () => {
  it('fails a REF whose target bookmark is absent with an actionable diagnostic', async () => {
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body><w:p>` +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> REF MissingSection \\h </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>Section 6.1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
      '</w:p></w:body></w:document>',
    );

    const result = await verifyOutput(docxPath, {}, {});
    const check = result.checks.find((c) => c.name === 'Word REF fields resolve');
    expect(check).toMatchObject({ passed: false, fatal: true });
    expect(check?.details).toContain('word/document.xml');
    expect(check?.details).toContain('MissingSection');
    expect(check?.details).toContain('REF MissingSection');
    cleanupDocx(docxPath);
  });

  it('accepts a valid REF and its cached visible result', async () => {
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:bookmarkStart w:id="0" w:name="Section_6_1"/><w:r><w:t>6.1</w:t></w:r><w:bookmarkEnd w:id="0"/></w:p>' +
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> REF Section_6_1 \\h </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>Section 6.1 (cached)</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
      '</w:body></w:document>',
    );

    expect(validateWordFields(docxPath)).toEqual([]);
    const result = await verifyOutput(docxPath, {}, {});
    expect(result.checks.find((c) => c.name === 'Word REF fields resolve')?.passed).toBe(true);
    cleanupDocx(docxPath);
  });

  it('recognizes a REF instruction split across runs', async () => {
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:bookmarkStart w:id="0" w:name="SplitTarget"/><w:r><w:t>Target</w:t></w:r><w:bookmarkEnd w:id="0"/></w:p>' +
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText> RE</w:instrText></w:r><w:r><w:instrText>F Split</w:instrText></w:r>' +
      '<w:r><w:instrText>Target \\h </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Target</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
      '</w:body></w:document>',
    );

    expect(validateWordFields(docxPath)).toEqual([]);
    cleanupDocx(docxPath);
  });

  it('reports an invalid REF field triplet', async () => {
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body><w:p>` +
      '<w:bookmarkStart w:id="0" w:name="PresentTarget"/><w:bookmarkEnd w:id="0"/>' +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText> REF PresentTarget </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
      '</w:p></w:body></w:document>',
    );

    const diagnostics = validateWordFields(docxPath);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain('PresentTarget');
    expect(diagnostics[0]).toContain('missing separate marker');
    cleanupDocx(docxPath);
  });

  it('validates atomic fldSimple REF fields', async () => {
    const validPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body><w:p>` +
      '<w:bookmarkStart w:id="0" w:name="AtomicTarget"/><w:bookmarkEnd w:id="0"/>' +
      '<w:fldSimple w:instr=" REF AtomicTarget \\h "><w:r><w:t>cached</w:t></w:r></w:fldSimple>' +
      '</w:p></w:body></w:document>',
    );
    expect(validateWordFields(validPath)).toEqual([]);
    cleanupDocx(validPath);
  });

  it('skips empty string values', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Acme Corp</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    await allureParameter('case', 'skips-empty-string-values');
    const result = await runVerificationWithTrace(docxPath, { company: 'Acme Corp', empty: '' }, {});

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    await allureStep('Assert values check passes with empty value ignored', () => {
      expect(valuesCheck?.passed).toBe(true);
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('skips whitespace-only values', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Acme Corp</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    await allureParameter('case', 'skips-whitespace-values');
    const result = await runVerificationWithTrace(docxPath, { company: 'Acme Corp', space: '   ' }, {});

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    await allureStep('Assert values check passes with whitespace-only value ignored', () => {
      expect(valuesCheck?.passed).toBe(true);
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('matches with smart quotes normalized to straight', async () => {
    // Document contains smart quotes
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>\u201CHello World\u201D</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    // Input value uses straight quotes
    await allureParameter('case', 'matches-smart-quotes');
    const result = await runVerificationWithTrace(docxPath, { greeting: '"Hello World"' }, {});

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    await allureStep('Assert smart quotes normalize to input value', () => {
      expect(valuesCheck?.passed).toBe(true);
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('matches with collapsed whitespace', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Hello   World</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    await allureParameter('case', 'matches-collapsed-whitespace');
    const result = await runVerificationWithTrace(docxPath, { greeting: 'Hello World' }, {});

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    await allureStep('Assert whitespace normalization passes', () => {
      expect(valuesCheck?.passed).toBe(true);
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('matches with non-breaking space', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Hello\u00A0World</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    await allureParameter('case', 'matches-non-breaking-space');
    const result = await runVerificationWithTrace(docxPath, { greeting: 'Hello World' }, {});

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    await allureStep('Assert non-breaking spaces normalize to regular spaces', () => {
      expect(valuesCheck?.passed).toBe(true);
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('finds values present only in header text', async () => {
    const docXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>Body content</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const headerXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:hdr xmlns:w="${W_NS}">` +
      '<w:p><w:r><w:t>Acme Corp</w:t></w:r></w:p>' +
      '</w:hdr>';

    const docxPath = buildDocx(docXml, {
      'word/header1.xml': headerXml,
    });

    await allureParameter('case', 'finds-header-values');
    const result = await runVerificationWithTrace(docxPath, { company: 'Acme Corp' }, {});

    const valuesCheck = result.checks.find((c) => c.name === 'Context values present');
    await allureStep('Assert header text is included in verification search', () => {
      expect(valuesCheck?.passed).toBe(true);
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('detects leftover bracketed placeholders from replacement keys', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:r><w:t>[Company Name]</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const docxPath = buildDocx(xml);

    await allureParameter('case', 'detects-leftover-placeholders');
    const result = await runVerificationWithTrace(
      docxPath,
      { company_name: 'Acme Corp' },
      { '[Company Name]': '{company_name}' }
    );

    const placeholdersCheck = result.checks.find((c) => c.name === 'Leftover source placeholders');
    await allureStep('Assert leftover placeholder is reported', () => {
      expect(placeholdersCheck?.passed).toBe(false);
      expect(placeholdersCheck?.details).toContain('[Company Name]');
    });

    rmSync(docxPath.replace('/test.docx', ''), { recursive: true, force: true });
  });

  it('flags a %% artifact left by a sign-carrying percentage value (issue #719)', async () => {
    // The trailing-sigil twin of the double-dollar check: the certificate of
    // incorporation leaves the source % in place after {specify_percentage},
    // so a value of "60%" doubles the sign.
    const docxPath = buildTextDocx(['Holders of at least 60%% of the outstanding shares.']);

    await allureParameter('case', 'double-percent');
    const result = await verifyOutput(docxPath, {}, {});

    const check = result.checks.find((c) => c.name === 'No double percent signs');
    await allureStep('Assert the double-percent artifact is reported', () => {
      expect(check?.passed).toBe(false);
      expect(check?.details).toContain('60%%');
      expect(result.passed).toBe(false);
    });

    cleanupDocx(docxPath);
  });

  it('flags a whitespace-separated % % artifact', async () => {
    const docxPath = buildTextDocx(['Holders of at least 60% % of the outstanding shares.']);
    const result = await verifyOutput(docxPath, {}, {});
    const check = result.checks.find((c) => c.name === 'No double percent signs');
    expect(check?.passed).toBe(false);
    cleanupDocx(docxPath);
  });

  it('flags a %% artifact inside a footnote (issue #719)', async () => {
    // extractAllText() skips word/footnotes.xml, so the sigil checks read it
    // separately: a corrupt footnote must not verify clean.
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>Body is clean.</w:t></w:r></w:p></w:body></w:document>`,
      {
        'word/footnotes.xml':
          '<?xml version="1.0" encoding="UTF-8"?>' +
          `<w:footnotes xmlns:w="${W_NS}"><w:footnote w:id="1"><w:p><w:r><w:t xml:space="preserve">Rate 8%% per annum</w:t></w:r></w:p></w:footnote></w:footnotes>`,
      }
    );

    const result = await verifyOutput(docxPath, {}, {});
    const check = result.checks.find((c) => c.name === 'No double percent signs');
    expect(check?.passed).toBe(false);
    expect(check?.details).toContain('8%%');
    cleanupDocx(docxPath);
  });

  it('does not flag two separate legitimate percentages', async () => {
    const docxPath = buildTextDocx(['A rate of 8% rising to 10% per annum.']);
    const result = await verifyOutput(docxPath, {}, {});
    const check = result.checks.find((c) => c.name === 'No double percent signs');
    expect(check?.passed).toBe(true);
    cleanupDocx(docxPath);
  });
  it('reports zero new formatting anomalies when source and output have the same count', async () => {
    // Issue #609: runFieldSelector previously verified without the cleaned source,
    // so pre-existing source anomalies were all reported as fill-introduced.
    const sourcePath = buildAnomalyDocx(3);
    const outputPath = buildAnomalyDocx(3);

    await allureParameter('case', 'formatting-anomaly-baseline');
    const result = await verifyOutput(outputPath, {}, {}, undefined, sourcePath);

    const anomalyCheck = result.checks.find((c) => c.name === 'No formatting anomalies');
    await allureStep('Assert equal anomaly counts report zero new', () => {
      expect(anomalyCheck?.passed).toBe(true);
    });

    cleanupDocx(sourcePath, outputPath);
  });

  it('still reports anomalies the fill introduced above the source baseline', async () => {
    const sourcePath = buildAnomalyDocx(1);
    const outputPath = buildAnomalyDocx(3);

    await allureParameter('case', 'formatting-anomaly-introduced');
    const result = await verifyOutput(outputPath, {}, {}, undefined, sourcePath);

    const anomalyCheck = result.checks.find((c) => c.name === 'No formatting anomalies');
    await allureStep('Assert fill-introduced anomalies are still reported', () => {
      expect(anomalyCheck?.passed).toBe(false);
      expect(anomalyCheck?.details).toContain('2 new');
    });

    cleanupDocx(sourcePath, outputPath);
  });
});

describe('findLeftoverPlaceholders', () => {
  it('passes a mapped "Closing > [s]" fill even when an unrelated "Management Rights Letter[s]" remains', async () => {
    // Issue #609 case 1: the [s] in an unrelated source option must not be read
    // as a failed "Closing > [s]" replacement.
    const docxPath = buildTextDocx([
      'Closings; Delivery.',
      'Management Rights Letter[s] shall be delivered to each Investor.',
    ]);

    await allureParameter('case', 'unrelated-token-same-as-mapped');
    const leftovers = findLeftoverPlaceholders(docxPath, { 'Closing > [s]': '{optional_plural_suffix}' });
    await allureJsonAttachment('leftovers.json', leftovers);

    await allureStep('Assert no leftover reported', () => {
      expect(leftovers).toEqual([]);
    });

    cleanupDocx(docxPath);
  });

  it('does not fail the mapped-key check for a placeholder in a different paragraph/context', async () => {
    // Issue #609 case 2: a [___] with no "Series" context of its own is not a
    // failed "Series > [___]" replacement.
    const docxPath = buildTextDocx([
      'Series A Preferred Stock is issued under this Agreement.',
      'The counsel-expense cap is [___].',
    ]);

    await allureParameter('case', 'different-context-placeholder');
    const leftovers = findLeftoverPlaceholders(docxPath, { 'Series > [___]': '{series_designation}' });

    await allureStep('Assert no leftover reported', () => {
      expect(leftovers).toEqual([]);
    });

    cleanupDocx(docxPath);
  });

  it('still reports a genuinely unfilled placeholder at the mapped location', async () => {
    // Landmine: true-positive detection must survive — a real leftover at the
    // qualified location is still caught.
    const docxPath = buildTextDocx(['THIS SERIES [___] PREFERRED STOCK']);

    await allureParameter('case', 'true-positive-at-mapped-location');
    const leftovers = findLeftoverPlaceholders(docxPath, { 'SERIES > [___]': '{series_designation}' });

    await allureStep('Assert unfilled placeholder is reported', () => {
      expect(leftovers).toContain('SERIES > [___]');
    });

    cleanupDocx(docxPath);
  });

  it('reports a context key the fill never touched (source count == output count)', async () => {
    // #607-shaped true positive: the caption placeholder is unchanged from the
    // cleaned source, so the mapping was entirely unhandled. The count baseline
    // catches it even when the context is unmatchable via paragraph text.
    const sourcePath = buildTextDocx(['CERTIFICATE OF INCORPORATION OF [_________]']);
    const outputPath = buildTextDocx(['CERTIFICATE OF INCORPORATION OF [_________]']);

    await allureParameter('case', 'baseline-total-miss');
    const leftovers = findLeftoverPlaceholders(
      outputPath,
      { 'INCORPORATIONOF > [_________]': '{company_name}' },
      sourcePath
    );

    await allureStep('Assert unhandled mapping is reported', () => {
      expect(leftovers).toContain('INCORPORATIONOF > [_________]');
    });

    cleanupDocx(sourcePath, outputPath);
  });

  it('does not report deliberately-retained occurrences once some were filled (count dropped)', async () => {
    // Issue #609: series_designation fills its declared occurrences and retains
    // two by design. With the source baseline, a partial reduction is treated as
    // intentional retention, not a failed replacement.
    const sourcePath = buildTextDocx([
      'that number of shares of Series [___] Preferred',
      '(the "Series [___] Preferred Stock")',
      'designated Series [___] Preferred Stock (retained)',
    ]);
    const outputPath = buildTextDocx([
      'that number of shares of Series A Preferred',
      '(the "Series A Preferred Stock")',
      'designated Series [___] Preferred Stock (retained)',
    ]);

    await allureParameter('case', 'baseline-retained-occurrence');
    const leftovers = findLeftoverPlaceholders(
      outputPath,
      { 'Series > [___]': '{series_designation}' },
      sourcePath
    );

    await allureStep('Assert retained occurrence is not reported', () => {
      expect(leftovers).toEqual([]);
    });

    cleanupDocx(sourcePath, outputPath);
  });

  it('accepts a context-qualified atomic REF replacement whose filled text equals its source result', async () => {
    const prefix = 'rights under this Agreement are not assigned pursuant to ';
    const sourcePath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        `<w:document xmlns:w="${W_NS}"><w:body><w:p>` +
        `<w:r><w:t xml:space="preserve">${prefix}</w:t></w:r>` +
        '<w:r><w:t xml:space="preserve">Section </w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
        '<w:r><w:instrText xml:space="preserve"> REF _RefSuccessors \\h </w:instrText></w:r>' +
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
        '<w:r><w:t>6.1</w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
        '</w:p></w:body></w:document>'
    );
    const outputPath = sourcePath.replace('test.docx', 'output.docx');
    const key = `${prefix.trim()} > Section 6.1`;

    await patchDocument(sourcePath, outputPath, { [key]: 'Section 6.1' });

    await allureParameter('case', 'qualified-ref-same-visible-result');
    const leftovers = findLeftoverPlaceholders(
      outputPath,
      { [key]: 'Section {successors_assigns_section}' },
      sourcePath
    );

    await allureStep('Assert the staticized REF is not a false leftover', () => {
      expect(leftovers).toEqual([]);
      const xml = new AdmZip(outputPath).readAsText('word/document.xml');
      expect(xml).not.toContain('fldChar');
    });

    cleanupDocx(sourcePath, outputPath);
  });

  it('still reports a context-qualified REF when the live source field survives unchanged', async () => {
    const prefix = 'rights under this Agreement are not assigned pursuant to ';
    const fieldDocx = () => buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        `<w:document xmlns:w="${W_NS}"><w:body><w:p>` +
        `<w:r><w:t xml:space="preserve">${prefix}</w:t></w:r>` +
        '<w:r><w:t xml:space="preserve">Section </w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
        '<w:r><w:instrText xml:space="preserve"> REF _RefSuccessors \\h </w:instrText></w:r>' +
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
        '<w:r><w:t>6.1</w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
        '</w:p></w:body></w:document>'
    );
    const sourcePath = fieldDocx();
    const outputPath = fieldDocx();
    const key = `${prefix.trim()} > Section 6.1`;

    const leftovers = findLeftoverPlaceholders(
      outputPath,
      { [key]: 'Section {successors_assigns_section}' },
      sourcePath
    );

    await allureStep('Assert the unmodified live REF remains a true positive', () => {
      expect(leftovers).toContain(key);
    });

    cleanupDocx(sourcePath, outputPath);
  });

  it('reports a simple key that survives anywhere in the document', async () => {
    const docxPath = buildTextDocx(['Header', 'Leftover [Company Name] remains here.']);

    const leftovers = findLeftoverPlaceholders(docxPath, { '[Company Name]': '{company_name}' });

    await allureStep('Assert simple key leftover is reported', () => {
      expect(leftovers).toContain('[Company Name]');
    });

    cleanupDocx(docxPath);
  });

  it('distinguishes ordinary section prose from a genuine unresolved source placeholder', async () => {
    // Issue #772 red/green control: both keys survive, but only the bracketed
    // drafting placeholder is signer-facing residue. The ordinary cross-reference
    // may render to the same visible text after parameterization.
    const sourcePath = buildTextDocx([
      'A claim under this Section 2.8 survives termination.',
      'Company: [Company Name]',
    ]);
    const outputPath = buildTextDocx([
      'A claim under this Section 2.8 survives termination.',
      'Company: [Company Name]',
    ]);

    const leftovers = findLeftoverPlaceholders(
      outputPath,
      {
        'this Section 2.8': 'this Section {indemnification_section}',
        '[Company Name]': '{company_name}',
      },
      sourcePath,
    );

    expect(leftovers).toEqual(['[Company Name]']);
    cleanupDocx(sourcePath, outputPath);
  });
});

describe('verifyOutput first-body-paragraph guard (issue #605)', () => {
  const rangeCleanConfig = {
    removeFootnotes: false,
    removeParagraphPatterns: [],
    removeRanges: [{ start: '^Interpreting help text$', end: '^Send to your counterparty' }],
    clearParts: [],
  };

  function buildLeadingEmptyDocx(): string {
    // An empty structural paragraph (holding a section break) stranded before content
    return buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        `<w:document xmlns:w="${W_NS}"><w:body>` +
        '<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:pPr></w:p>' +
        '<w:p><w:r><w:t>Agreement content</w:t></w:r></w:p>' +
        '</w:body></w:document>'
    );
  }

  it('warns when content-removing cleaning leaves a textless first body paragraph', async () => {
    const docxPath = buildLeadingEmptyDocx();

    const result = await verifyOutput(docxPath, {}, {}, rangeCleanConfig);
    const check = result.checks.find((c) => c.name === 'First body paragraph has content');

    expect(check).toBeDefined();
    expect(check?.passed).toBe(false);
    expect(check?.details).toContain('removeEmptyLeadingParagraphs');
    expect(result.passed).toBe(false);

    cleanupDocx(docxPath);
  });

  it('passes when the first body paragraph has text', async () => {
    const docxPath = buildTextDocx(['Agreement Title', 'Body content']);

    const result = await verifyOutput(docxPath, {}, {}, rangeCleanConfig);
    const check = result.checks.find((c) => c.name === 'First body paragraph has content');

    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);

    cleanupDocx(docxPath);
  });

  it('accepts a textless leading structural paragraph without page-advancing evidence', async () => {
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body>` +
      '<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:pPr></w:p>' +
      '<w:p><w:r><w:t>INDEMNIFICATION AGREEMENT</w:t></w:r></w:p>' +
      '</w:body></w:document>'
    );
    const result = await verifyOutput(docxPath, {}, {}, rangeCleanConfig);
    expect(result.checks.find((c) => c.name === 'First body paragraph has content')?.passed).toBe(true);
    cleanupDocx(docxPath);
  });

  it('does not run the check when the clean config removes no body content', async () => {
    const docxPath = buildLeadingEmptyDocx();

    // removeFootnotes only removes footnote-reference runs and footnote
    // bodies, not body paragraphs — deliberately excluded from the gate
    const result = await verifyOutput(docxPath, {}, {}, {
      removeFootnotes: true,
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
    });

    expect(result.checks.find((c) => c.name === 'First body paragraph has content')).toBeUndefined();

    cleanupDocx(docxPath);
  });

  it('runs the check when removeParagraphPatterns is configured', async () => {
    const docxPath = buildLeadingEmptyDocx();

    const result = await verifyOutput(docxPath, {}, {}, {
      removeFootnotes: false,
      removeParagraphPatterns: ['^Note to Drafter:'],
      removeRanges: [],
      clearParts: [],
    });

    const check = result.checks.find((c) => c.name === 'First body paragraph has content');
    expect(check).toBeDefined();
    expect(check?.passed).toBe(false);

    cleanupDocx(docxPath);
  });

  it('runs the check when removeEmptyLeadingParagraphs is enabled', async () => {
    const docxPath = buildTextDocx(['Agreement Title']);

    const result = await verifyOutput(docxPath, {}, {}, {
      removeFootnotes: false,
      removeParagraphPatterns: [],
      removeRanges: [],
      clearParts: [],
      removeEmptyLeadingParagraphs: true,
    });

    const check = result.checks.find((c) => c.name === 'First body paragraph has content');
    expect(check?.passed).toBe(true);

    cleanupDocx(docxPath);
  });
});

describe('rendered text artifact verification (issue #759)', () => {
  it.each([
    ['orphan bracket and slash carrier', 'Election remains ]/; after fill.', 'orphan closing bracket'],
    ['duplicate heading', 'Form S-1 Form S-1', 'duplicated phrase'],
    ['duplicate word', 'the Company Company shall deliver', 'duplicated word'],
    ['spaced punctuation', 'the Company , shall deliver', 'whitespace before punctuation'],
    ['duplicated punctuation', 'the Company, , shall deliver', 'duplicated punctuation'],
    ['missing reference target', 'subject to Section .', 'reference without a target'],
    ['missing percent sign', 'holders of at least 60 of the shares', 'percentage threshold without percent sign'],
  ])('rejects %s with a localized diagnostic', (_label, paragraph, expected) => {
    const docxPath = buildTextDocx([paragraph]);
    const findings = findRenderedTextArtifacts(docxPath);
    expect(findings.some((finding) => finding.includes('word/document.xml:paragraph 1') && finding.includes(expected))).toBe(true);
    cleanupDocx(docxPath);
  });

  it('inspects comments and footnotes as read-only stories', () => {
    const docxPath = buildDocx(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>Clean body.</w:t></w:r></w:p></w:body></w:document>`,
      {
        'word/comments.xml': `<w:comments xmlns:w="${W_NS}"><w:comment><w:p><w:r><w:t>Company , Inc.</w:t></w:r></w:p></w:comment></w:comments>`,
        'word/footnotes.xml': `<w:footnotes xmlns:w="${W_NS}"><w:footnote w:id="1"><w:p><w:r><w:t>See Section .</w:t></w:r></w:p></w:footnote></w:footnotes>`,
      }
    );
    const findings = findRenderedTextArtifacts(docxPath);
    expect(findings.some((finding) => finding.includes('word/comments.xml'))).toBe(true);
    expect(findings.some((finding) => finding.includes('word/footnotes.xml'))).toBe(true);
    cleanupDocx(docxPath);
  });

  it('baselines pre-existing source artifacts but rejects a newly introduced one', async () => {
    const sourcePath = buildTextDocx(['Legacy Company Company wording.']);
    const unchangedPath = buildTextDocx(['Legacy Company Company wording.']);
    const changedPath = buildTextDocx(['Legacy Company Company wording.', 'Form S-1 Form S-1']);
    const unchanged = await verifyOutput(unchangedPath, {}, {}, undefined, sourcePath);
    const changed = await verifyOutput(changedPath, {}, {}, undefined, sourcePath);
    expect(unchanged.checks.find((c) => c.name === 'No rendered text artifacts')?.passed).toBe(true);
    expect(changed.checks.find((c) => c.name === 'No rendered text artifacts')?.passed).toBe(false);
    cleanupDocx(sourcePath, unchangedPath, changedPath);
  });

  it.each([
    'that that result was intended',
    'a rate of 60% of outstanding shares',
    'See Sections 2.1 and 2.2.',
    'the options [A]/[B] remain intentionally bracketed',
    'Smith, Jones & Company, L.P.',
  ])('accepts intentional construct: %s', (paragraph) => {
    const docxPath = buildTextDocx([paragraph]);
    expect(findRenderedTextArtifacts(docxPath)).toEqual([]);
    cleanupDocx(docxPath);
  });
});
