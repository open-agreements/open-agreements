import { describe, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { verifyOutput, normalizeText, findLeftoverPlaceholders } from './verifier.js';
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

describe('verifyOutput', () => {
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

  it('reports a simple key that survives anywhere in the document', async () => {
    const docxPath = buildTextDocx(['Header', 'Leftover [Company Name] remains here.']);

    const leftovers = findLeftoverPlaceholders(docxPath, { '[Company Name]': '{company_name}' });

    await allureStep('Assert simple key leftover is reported', () => {
      expect(leftovers).toContain('[Company Name]');
    });

    cleanupDocx(docxPath);
  });
});
