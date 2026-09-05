/**
 * NVCA family: calendar-date rendering (#617) and round-wide
 * series_designation / par_value coverage (#618).
 *
 * #617 — six bound calendar-date fields across the family were typed `string`,
 * so the ISO→display formatter added in #612 (`prepareFillData`, `type: date`
 * fields only) never fired and ISO input leaked verbatim into documents. These
 * tests pin the retype (metadata level) and the rendered behavior (fill level).
 *
 * #618 — the four ancillary NVCA agreements left series-designation and
 * par-value blanks unfilled even though the charter/SPA already collect those
 * deal-wide facts. These tests pin that one set of values fills consistently
 * across each template's local blank shapes (including the ROFR NBSP variant).
 *
 * Fixtures are synthetic DOCX files built from the short anchor phrases that
 * already appear in each template's replacements.json — the NVCA source
 * documents are not redistributable and are never embedded here.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { load } from 'js-yaml';
import { afterEach, describe, expect } from 'vitest';
import { runFieldSelector } from '../src/core/field-selector/index.js';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Verification & Drift');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NBSP = ' ';
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

interface MetadataField {
  name: string;
  type: string;
  default?: string;
}

function loadFields(fieldSelectorId: string): MetadataField[] {
  const metadata = load(
    readFileSync(join(resolveFieldSelectorDir(fieldSelectorId), 'metadata.yaml'), 'utf-8'),
  ) as { fields?: MetadataField[] };
  return metadata.fields ?? [];
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function buildDocx(paragraphs: string[]): Buffer {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  const wordRels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

function readText(path: string): string {
  const zip = new AdmZip(path);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const out: string[] = [];
  for (const m of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const text = [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((entry) => entry[1]).join('');
    if (text) out.push(text);
  }
  return out
    .join('\n')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"');
}

async function fillFixture(
  fieldSelectorId: string,
  paragraphs: string[],
  values: Record<string, unknown>,
): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'nvca-round-'));
  tempDirs.push(tempDir);
  const inputPath = join(tempDir, 'source.docx');
  const outputPath = join(tempDir, 'filled.docx');
  writeFileSync(inputPath, buildDocx(paragraphs));
  // These deliberately tiny anchor fixtures test scalar date/round filling,
  // not whole-source structural contracts. Give them a purpose-built recipe
  // copy without full-source-only REF actions; faking all of the pinned NVCA
  // bookmark targets here would make this test assert on invented structure.
  const sourceRecipe = resolveFieldSelectorDir(fieldSelectorId);
  const fixtureRoot = join(tempDir, 'fixture-content');
  const fixtureRecipe = join(fixtureRoot, 'templates', 'test-fixtures', fieldSelectorId);
  mkdirSync(fixtureRecipe, { recursive: true });
  cpSync(sourceRecipe, fixtureRecipe, {
    recursive: true,
    filter: (source) => !source.endsWith('/reference-fields.json'),
  });
  // The canonical recipes now declare fail-closed, whole-document structural
  // operations (story cleaning, repeatable tables, and bounded selections).
  // A deliberately tiny scalar-binding fixture cannot truthfully reproduce
  // those structures. Keep this harness scoped to the published replacement
  // bindings it exists to exercise instead of fabricating source tables,
  // headers, bookmarks, and selection boundaries.
  for (const fullSourceOnlyConfig of [
    'anchored-paragraph-bindings.json',
    'clean.json',
    'repeatable-tables.json',
    'selections.json',
  ]) {
    rmSync(join(fixtureRecipe, fullSourceOnlyConfig), { force: true });
  }
  const previousRoots = process.env.OPEN_AGREEMENTS_CONTENT_ROOTS;
  process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = fixtureRoot;
  const requiredCollectionValues: Record<string, unknown> =
    fieldSelectorId === 'nvca-stock-purchase-agreement'
      ? { purchasers: [{ name_and_address: 'Synthetic Purchaser' }] }
      : fieldSelectorId === 'nvca-investors-rights-agreement'
        ? {
            investors: [{ name: 'Synthetic Investor' }],
            key_holders: [{ name: 'Synthetic Key Holder' }],
            annex_2_policies: [{ policy: 'Synthetic Policy', deadline: 'At closing' }],
          }
        : fieldSelectorId === 'nvca-rofr-co-sale-agreement' || fieldSelectorId === 'nvca-voting-agreement'
          ? {
              investors: [{ name: 'Synthetic Investor' }],
              key_holders: [{ name: 'Synthetic Key Holder' }],
            }
          : {};
  try {
    await runFieldSelector({
      fieldSelectorId,
      inputPath,
      outputPath,
      values: { ...requiredCollectionValues, ...values },
    });
  } finally {
    if (previousRoots === undefined) delete process.env.OPEN_AGREEMENTS_CONTENT_ROOTS;
    else process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = previousRoots;
  }
  return readText(outputPath);
}

/** (template, field) pairs retyped (or pinned) to `type: date` by #617. */
const DATE_FIELD_MATRIX: Array<{ template: string; field: string }> = [
  { template: 'nvca-investors-rights-agreement', field: 'effective_date' },
  { template: 'nvca-investors-rights-agreement', field: 'checklist_delivery_date' },
  { template: 'nvca-rofr-co-sale-agreement', field: 'effective_date' },
  { template: 'nvca-voting-agreement', field: 'effective_date' },
  { template: 'nvca-stock-purchase-agreement', field: 'balance_sheet_date' },
  { template: 'nvca-certificate-of-incorporation', field: 'redemption_start_date' },
  // Unbound today (companion no-op-fields issue) but retyped so a future
  // binding formats ISO input from day one.
  { template: 'nvca-indemnification-agreement', field: 'agreement_effective_date' },
];

describe('NVCA calendar-date fields render ISO input as document dates (#617)', () => {
  it('declares type: date for every calendar-date field in the family', () => {
    for (const { template, field } of DATE_FIELD_MATRIX) {
      const def = loadFields(template).find((f) => f.name === field);
      expect(def, `${template}.${field} should exist`).toBeDefined();
      expect(def?.type, `${template}.${field} should be type date`).toBe('date');
    }
  });

  it('keeps the SPA split agreement-date pair OUT of the date retype (excluded by #617)', () => {
    // The intentionally split month-day/two-digit-year pair has its own issue;
    // it must not be silently converted to a single `date` field here. If the
    // pair is removed entirely (superseded by agreement_date), that is fine.
    for (const def of loadFields('nvca-stock-purchase-agreement')) {
      if (def.name === 'agreement_date_month_day' || def.name === 'agreement_year_two_digits') {
        expect(def.type).toBe('string');
      }
    }
  });

  it('renders IRA effective_date and checklist_delivery_date from ISO input', async () => {
    const text = await fillFixture(
      'nvca-investors-rights-agreement',
      [
        'This Agreement is made as of [________], 20[__], by the parties hereto.',
        'IN WITNESS WHEREOF, the Company has provided this Checklist on [Date checklist is being delivered].',
      ],
      { effective_date: '2026-03-15', checklist_delivery_date: '2026-03-16' },
    );
    expect(text).toContain('made as of March 15, 2026');
    expect(text).toContain('Checklist on March 16, 2026');
    expect(text).not.toContain('2026-03-15');
    expect(text).not.toContain('2026-03-16');
  });

  it('passes display-ready date strings through unchanged (backward compatibility)', async () => {
    const text = await fillFixture(
      'nvca-investors-rights-agreement',
      ['This Agreement is made as of [________], 20[__], by the parties hereto.'],
      { effective_date: 'March 20, 2026' },
    );
    expect(text).toContain('made as of March 20, 2026');
  });

  it('renders ROFR and Voting effective_date from ISO input', async () => {
    for (const template of ['nvca-rofr-co-sale-agreement', 'nvca-voting-agreement']) {
      const text = await fillFixture(
        template,
        ['This Agreement is made as of [________], 20[__], by the parties hereto.'],
        { effective_date: '2026-03-15' },
      );
      expect(text, template).toContain('made as of March 15, 2026');
      expect(text, template).not.toContain('2026-03-15');
    }
  });

  it('renders the charter redemption_start_date from ISO input at its "on or after" slot', async () => {
    const text = await fillFixture(
      'nvca-certificate-of-incorporation',
      [
        'commencing not more than 60 days after receipt by the Corporation at any time on or after [_____________] from the Requisite Holders of written notice requesting redemption.',
      ],
      { redemption_start_date: '2031-03-15' },
    );
    expect(text).toContain('on or after March 15, 2031');
    expect(text).not.toContain('2031-03-15');
  });
});

describe('SPA balance_sheet_date fills the definition slot and its references (#617)', () => {
  const FISCAL_YEAR_RENDERING = 'fiscal year ended _______';
  const spaParagraphs = [
    // Current source shape: the interim statement language is one bracketed
    // carrier, distinct from the audited fiscal-year-end slot.
    'financial statements as of and for the fiscal year ended [_______ __], 20[_] [and its unaudited financial statements (including balance sheet, income statement and statement of cash flows) as of [_______ __], 20[_] (the “Balance Sheet Date”) and for the [_____]-month period ended on the Balance Sheet Date].',
    'liabilities incurred in the ordinary course of business subsequent to [the Balance Sheet Date]; and other obligations.',
    'Since the [Balance Sheet Date], there has not been:',
  ];

  it('fills the definition blank with the formatted date and renders references as the defined term', async () => {
    const text = await fillFixture('nvca-stock-purchase-agreement', spaParagraphs, {
      balance_sheet_date: '2025-12-31',
      interim_financial_statement_months: '11',
      interim_current_period_end: 'November 30, 2025',
      interim_comparative_period_end: 'November 30, 2024',
    });
    // Definition slot carries the actual date...
    expect(text).toContain('as of December 31, 2025 (the “Balance Sheet Date”)');
    // ...and the bracketed references use the defined term (defaulted
    // balance_sheet_date_defined_term), not a repeated literal date.
    expect(text).toContain('subsequent to the Balance Sheet Date');
    expect(text).toContain('Since the Balance Sheet Date, there has not been');
    expect(text).not.toContain('Since the December 31, 2025');
    expect(text).not.toContain('2025-12-31');
    expect(text).not.toContain('[the Balance Sheet Date]');
    expect(text).not.toContain('[Balance Sheet Date]');
  });

  it('leaves the audited fiscal-year-end blank for counsel (documented non-fill)', async () => {
    const text = await fillFixture('nvca-stock-purchase-agreement', spaParagraphs, {
      balance_sheet_date: '2025-12-31',
      interim_financial_statement_months: '11',
      interim_current_period_end: 'November 30, 2025',
      interim_comparative_period_end: 'November 30, 2024',
    });
    expect(text).toContain(FISCAL_YEAR_RENDERING);
  });
});

/**
 * #618 fixtures: each paragraph reproduces the local blank shape the template's
 * replacements.json anchors to (mixed `[_]`/`[__]`/`[___]` series shapes; par
 * value shapes `$[0.___]`, `$[___]`, `[$0.___]`, bare `$__`/`$___`, and the
 * dollar-less `[__] par value`).
 */
const ROUND_VALUES = { series_designation: 'A', par_value: '0.0001' };

const SERIES_PAR_FIXTURES: Array<{
  template: string;
  paragraphs: string[];
  values: Record<string, unknown>;
  expected: string[];
}> = [
  {
    template: 'nvca-investors-rights-agreement',
    paragraphs: [
      'certain of the Investors hold shares of [Series [_]] Preferred Stock and possess registration rights.',
      'parties to that certain Series [_] Preferred Stock Purchase Agreement of even date herewith.',
      '“Series [___] Preferred Stock” means shares of the Company’s Series [___] Preferred Stock, par value $[0.___] per share.',
      '“Common Stock” means shares of the Company’s common stock, par value $[0.___] per share.',
    ],
    values: ROUND_VALUES,
    expected: [
      '[Series A] Preferred Stock',
      'Series A Preferred Stock Purchase Agreement',
      '“Series A Preferred Stock” means shares of the Company’s Series A Preferred Stock, par value $0.0001 per share.',
      'common stock, par value $0.0001 per share.',
    ],
  },
  {
    template: 'nvca-rofr-co-sale-agreement',
    paragraphs: [
      // First WHEREAS uses an NBSP between "Series" and the blank in the source.
      `in connection with the purchase of shares of Series${NBSP}[__] Preferred Stock of the Company, par value $__ per share (“Series [__] Preferred Stock”); and`,
      'par value $___ per share (“Series [___] Preferred Stock”), pursuant to that certain Series [__] Preferred Stock Purchase Agreement dated as of the date hereof.',
      'collectively, all shares of Series A Preferred Stock [and Series [_] Preferred Stock].',
      '“Common Stock” means shares of Common Stock of the Company, [__] par value per share.',
    ],
    values: { ...ROUND_VALUES, additional_series_designation: 'A' },
    expected: [
      `shares of Series${NBSP}A Preferred Stock of the Company, par value $0.0001 per share`,
      'par value $0.0001 per share (“Series A Preferred Stock”), pursuant to that certain Series A Preferred Stock Purchase Agreement',
      'Series A Preferred Stock [and Series A Preferred Stock]',
      'Common Stock of the Company, $0.0001 par value per share.',
    ],
  },
  {
    template: 'nvca-voting-agreement',
    paragraphs: [
      'certain of the Investors hold shares of [Series [_]] Preferred Stock and/or shares of Common Stock.',
      'parties to that certain Series [_] Preferred Stock Purchase Agreement of even date herewith.',
      'the holders of record of the shares of [Series [___]] Preferred Stock, $[___] par value per share, of the Company, and the holders of record of the shares of common stock, $[___] par value per share, of the Company.',
      '“Series [___] Preferred Stock” means shares of the Company’s Series [___] Preferred Stock, par value [$0.___] per share.',
    ],
    values: ROUND_VALUES,
    expected: [
      '[Series A] Preferred Stock',
      'Series A Preferred Stock Purchase Agreement',
      'Series A Preferred Stock, $0.0001 par value per share, of the Company',
      'common stock, $0.0001 par value per share, of the Company',
      'Series A Preferred Stock, par value $0.0001 per share.',
    ],
  },
  {
    template: 'nvca-management-rights-letter',
    paragraphs: [
      'pursuant to and effective as of your purchase of [________] shares of Series [_] Preferred Stock of the Company.',
    ],
    values: { series_designation: 'A', purchased_shares: '1,000,000' },
    expected: ['purchase of 1,000,000 shares of Series A Preferred Stock'],
  },
];

/** Leftover shapes that must NOT survive a round-consistent fill. */
const LEFTOVER_PATTERNS: RegExp[] = [
  /Series[\s ]*\[_+\]/, // any series blank, incl. NBSP-joined
  /\$_+\s+per\s+share/, // bare $__ / $___ par blanks
  /\$\[_+\]/, // $[___]
  /\[\$0\._+\]/, // [$0.___]
  /\$\[0\._+\]/, // $[0.___]
  /\[_+\][\s ]+par[\s ]+value/, // dollar-less [__] par value
];

describe('Ancillary NVCA agreements fill series_designation/par_value round-wide (#618)', () => {
  it('publishes series_designation on all four ancillaries and par_value where a blank exists', () => {
    for (const template of [
      'nvca-investors-rights-agreement',
      'nvca-rofr-co-sale-agreement',
      'nvca-voting-agreement',
      'nvca-management-rights-letter',
    ]) {
      const fields = loadFields(template);
      expect(
        fields.some((f) => f.name === 'series_designation'),
        `${template} should publish series_designation`,
      ).toBe(true);
    }
    for (const template of [
      'nvca-investors-rights-agreement',
      'nvca-rofr-co-sale-agreement',
      'nvca-voting-agreement',
    ]) {
      expect(
        loadFields(template).some((f) => f.name === 'par_value'),
        `${template} should publish par_value`,
      ).toBe(true);
    }
  });

  for (const fixture of SERIES_PAR_FIXTURES) {
    it(`fills every series/par blank shape in ${fixture.template} with one set of round values`, async () => {
      const text = await fillFixture(fixture.template, fixture.paragraphs, fixture.values);
      for (const expected of fixture.expected) {
        expect(text).toContain(expected);
      }
      for (const pattern of LEFTOVER_PATTERNS) {
        expect(text, `leftover blank matching ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
