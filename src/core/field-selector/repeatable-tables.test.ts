import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { applyRepeatableTables, RepeatableTablesConfigSchema, validateRepeatableTableFields } from './repeatable-tables.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const roots: string[] = [];
const it = itAllure.epic('Filling & Rendering');

function fixtureDocx(duplicate = false, postHeader: 'none' | 'blank' | 'nonblank' = 'none'): Buffer {
  const zip = new AdmZip();
  const header = `<w:tbl>` +
    `<w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:tcPr><w:tcW w:w="3000"/><w:shd w:fill="AAAAAA"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>Name</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="1500"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>Shares</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="1500"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>Price ($)</w:t></w:r></w:p></w:tc></w:tr>`;
  const blankRow = `<w:tr><w:trPr><w:cantSplit/></w:trPr>` +
    `<w:tc><w:tcPr><w:tcW w:w="3000"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr></w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="1500"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="1500"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p></w:tc>` +
    `</w:tr>`;
  const staleRow = blankRow.replace('</w:p></w:tc>', '<w:r><w:t>Stale purchaser</w:t></w:r></w:p></w:tc>');
  const table = header + (postHeader === 'blank' ? blankRow : postHeader === 'nonblank' ? staleRow : '') + `</w:tbl>`;
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W}"><w:body>${table}${duplicate ? table : ''}</w:body></w:document>`,
  ));
  return zip.toBuffer();
}

function prototypeOnlyFixture(rowCount = 3, inconsistent = false, duplicate = false): Buffer {
  const zip = new AdmZip();
  const row = (index: number) => `<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="6000"/><w:tcBorders><w:bottom w:val="single"/></w:tcBorders></w:tcPr>` +
    `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${inconsistent && index === 1 ? 'Unexpected Name' : 'Investor Name'}</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Address</w:t></w:r></w:p><w:p><w:r><w:t>Phone Number</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Email</w:t></w:r></w:p><w:p><w:r><w:t>[Counsel cc, if any]</w:t></w:r></w:p><w:p/></w:tc></w:tr>`;
  const table = `<w:tbl>${Array.from({ length: rowCount }, (_, index) => row(index)).join('')}</w:tbl>`;
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W}"><w:body>${table}${duplicate ? table : ''}</w:body></w:document>`,
  ));
  return zip.toBuffer();
}

function prepopulatedHeaderFixture(): Buffer {
  const zip = new AdmZip();
  const row = (index: number) => `<w:tr><w:trPr><w:cantSplit/><w:tblCellSpacing w:w="${index + 1}" w:type="dxa"/></w:trPr>` +
    `<w:tc><w:tcPr><w:tcW w:w="3000"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>Old holder ${index + 1}</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="3000"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>Old amount ${index + 1}</w:t></w:r></w:p></w:tc></w:tr>`;
  const header = `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
    `<w:tc><w:p><w:r><w:t>Holder</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p><w:r><w:t>Amount</w:t></w:r></w:p></w:tc></w:tr>`;
  zip.addFile('[Content_Types].xml', Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>',
  ));
  zip.addFile('_rels/.rels', Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>',
  ));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
  ));
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W}"><w:body><w:tbl>${header}${Array.from({ length: 7 }, (_, index) => row(index)).join('')}</w:tbl></w:body></w:document>`,
  ));
  return zip.toBuffer();
}

const config = RepeatableTablesConfigSchema.parse({
  schema_version: 1,
  tables: [{
    id: 'purchasers',
    rows_field: 'purchasers',
    header_cells: ['Name', 'Shares', 'Price ($)'],
    columns: [
      { field: 'name' },
      { field: 'shares', format: 'integer' },
      { field: 'price', format: 'currency' },
    ],
  }],
});

function render(
  rows: unknown[],
  duplicate = false,
  postHeader: 'none' | 'blank' | 'nonblank' = 'none',
  binding = config,
): string {
  const root = mkdtempSync(join(tmpdir(), 'repeatable-tables-'));
  roots.push(root);
  const input = join(root, 'in.docx');
  const output = join(root, 'out.docx');
  new AdmZip(fixtureDocx(duplicate, postHeader)).writeZip(input);
  applyRepeatableTables(input, output, binding, { purchasers: rows });
  const zip = new AdmZip(readFileSync(output));
  return zip.readAsText('word/document.xml');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('repeatable DOCX table bindings', () => {
  it('leaves a genuine header-only table at one row when data is empty', () => {
    const xml = render([]);
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(1);
  });

  it('removes blank post-header scaffolding deterministically', () => {
    const xml = render([], false, 'blank');
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(1);
    expect(xml).not.toContain('<w:cantSplit/>');
  });

  it('supports an explicitly selected prototype row', () => {
    const explicit = RepeatableTablesConfigSchema.parse({
      ...config,
      tables: [{ ...config.tables[0], prototype_row_index: 1 }],
    });
    const xml = render([{ name: 'Alpha Fund', shares: 10, price: 20 }], false, 'blank', explicit);
    expect(xml).toContain('Alpha Fund');
    expect(xml).toContain('<w:cantSplit/>');
  });

  it('replaces an asserted set of heterogeneous prepopulated rows', () => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-prepopulated-'));
    roots.push(root);
    const input = join(root, 'in.docx');
    const output = join(root, 'out.docx');
    new AdmZip(prepopulatedHeaderFixture()).writeZip(input);
    const binding = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'existing-holders',
        rows_field: 'holders',
        header_cells: ['Holder', 'Amount'],
        existing_data_row_count: 7,
        prototype_row_index: 4,
        columns: [{ field: 'name' }, { field: 'amount', format: 'integer' }],
      }],
    });

    applyRepeatableTables(input, output, binding, {holders: [
      {name: 'Alpha Fund', amount: 1200},
      {name: 'Beta Fund', amount: 3400},
    ]});

    const outputZip = new AdmZip(readFileSync(output));
    expect(outputZip.getEntry('[Content_Types].xml')).not.toBeNull();
    expect(outputZip.getEntry('_rels/.rels')).not.toBeNull();
    const xml = outputZip.readAsText('word/document.xml');
    const parsed = new DOMParser().parseFromString(xml, 'text/xml');
    expect(parsed.documentElement.localName).toBe('document');
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(3);
    expect(xml).toContain('Alpha Fund');
    expect(xml).toContain('1,200');
    expect(xml).toContain('Beta Fund');
    expect(xml).toContain('3,400');
    expect(xml.indexOf('Alpha Fund')).toBeLessThan(xml.indexOf('Beta Fund'));
    expect(xml).not.toContain('Old holder');
    expect(xml).not.toContain('Old amount');
    expect((xml.match(/<w:tblHeader\/>/g) ?? [])).toHaveLength(1);
    expect((xml.match(/w:tblCellSpacing w:w="4"/g) ?? [])).toHaveLength(2);
  });

  it('fails closed when the asserted prepopulated row count drifts', () => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-prepopulated-'));
    roots.push(root);
    const input = join(root, 'in.docx');
    new AdmZip(prepopulatedHeaderFixture()).writeZip(input);
    const binding = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'existing-holders', rows_field: 'holders',
        header_cells: ['Holder', 'Amount'], existing_data_row_count: 6,
        columns: [{field: 'name'}, {field: 'amount'}],
      }],
    });
    expect(() => applyRepeatableTables(input, join(root, 'out.docx'), binding, {holders: []}))
      .toThrow(/has 7 post-header rows; expected exactly 6/);
  });

  it('fills one row and preserves prototype formatting', () => {
    const xml = render([{ name: 'Alpha Fund', shares: 1250000, price: 2500000 }]);
    expect(xml).toContain('Alpha Fund');
    expect(xml).toContain('1,250,000');
    expect(xml).toContain('2,500,000.00');
    expect((xml.match(/<w:tblHeader\/>/g) ?? [])).toHaveLength(1);
    expect((xml.match(/<w:shd/g) ?? [])).toHaveLength(1);
    expect(xml).toContain('w:w="3000"');
    expect(xml).toContain('w:val="right"');
  });

  it('clones deterministic rows for multiple purchasers', () => {
    const xml = render([
      { name: 'Alpha Fund', shares: 100, price: 125 },
      { name: 'Beta Fund', shares: 200, price: 250 },
    ]);
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(3);
    expect(xml.indexOf('Alpha Fund')).toBeLessThan(xml.indexOf('Beta Fund'));
    expect(xml).toContain('125.00');
    expect(xml).toContain('250.00');
  });

  it('fails closed when the configured header is absent or ambiguous', () => {
    expect(() => render([{ name: 'Alpha Fund' }], true)).toThrow(/matched 2 tables/);
    const bad = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{ id: 'missing', rows_field: 'rows', header_cells: ['Unknown'], columns: [{ field: 'name' }] }],
    });
    const root = mkdtempSync(join(tmpdir(), 'repeatable-tables-'));
    roots.push(root);
    const input = join(root, 'in.docx');
    new AdmZip(fixtureDocx()).writeZip(input);
    expect(() => applyRepeatableTables(input, join(root, 'out.docx'), bad, { rows: [] })).toThrow(/matched 0 tables/);
  });

  it('fails closed on nonblank post-header data in synthesis mode', () => {
    expect(() => render([{ name: 'New purchaser' }], false, 'nonblank')).toThrow(/nonblank post-header row/);
  });

  it('rejects malformed contracts before touching a document', () => {
    expect(() => RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{ id: 'bad', rows_field: 'rows', header_cells: ['A', 'B'], columns: [{ field: 'only_one' }] }],
    })).toThrow(/same length/);
    expect(() => RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'bad-index', rows_field: 'rows', header_cells: ['A'], columns: [{field: 'value'}],
        existing_data_row_count: 2, prototype_row_index: 3,
      }],
    })).toThrow(/prototype_row_index must identify one of the existing data rows/);
  });

  it('requires the rows field and every column to be declared in metadata', () => {
    expect(() => validateRepeatableTableFields(config, [])).toThrow(/must reference an array field/);
    expect(() => validateRepeatableTableFields(config, [{
      name: 'purchasers',
      type: 'array',
      description: 'Purchaser rows',
      items: [{ name: 'name', type: 'string', description: 'Name' }],
    }])).toThrow(/column field "shares" is not declared/);
  });

  it.each([0, 1, 2, 4])('fills %i rows in a prototype-only signature table and removes unused rows', (count) => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-prototype-'));
    roots.push(root);
    const input = join(root, 'in.docx');
    const output = join(root, 'out.docx');
    new AdmZip(prototypeOnlyFixture()).writeZip(input);
    const binding = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'investor-signatures',
        rows_field: 'investors',
        prototype_cells: ['Investor NameAddressPhone NumberEmail[Counsel cc, if any]'],
        columns: [{ paragraphs: [
          { field: 'name' }, { field: 'address' }, { field: 'phone' }, { field: 'email' }, { field: 'counsel_cc' },
        ] }],
      }],
    });
    const investors = Array.from({ length: count }, (_, index) => ({
      name: `Investor ${index + 1}`,
      address: `${index + 1} Main Street`,
      phone: `555-000${index}`,
      email: `investor${index + 1}@example.com`,
      counsel_cc: index === 0 ? 'Counsel One' : '',
    }));
    applyRepeatableTables(input, output, binding, { investors });
    const xml = new AdmZip(readFileSync(output)).readAsText('word/document.xml');
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(count);
    expect(xml).not.toContain('Investor Name');
    expect(xml).not.toContain('[Counsel cc, if any]');
    if (count > 0) {
      expect(xml).toContain('Investor 1');
      expect(xml).toContain('1 Main Street');
      expect(xml).toContain('<w:cantSplit/>');
      expect(xml).toContain('w:w="6000"');
      expect(xml).toContain('<w:b/>');
      expect(xml).toContain('<w:bottom w:val="single"/>');
    }
  });

  it('fails closed when a prototype-only source table contains a divergent row', () => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-prototype-'));
    roots.push(root);
    const input = join(root, 'in.docx');
    new AdmZip(prototypeOnlyFixture(3, true)).writeZip(input);
    const binding = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'investor-signatures', rows_field: 'investors',
        prototype_cells: ['Investor NameAddressPhone NumberEmail[Counsel cc, if any]'],
        columns: [{ paragraphs: [{ field: 'name' }] }],
      }],
    });
    expect(() => applyRepeatableTables(input, join(root, 'out.docx'), binding, { investors: [] }))
      .toThrow(/does not match prototype_cells/);
  });

  it('fails closed when a prototype-only selector is ambiguous', () => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-prototype-'));
    roots.push(root);
    const input = join(root, 'in.docx');
    new AdmZip(prototypeOnlyFixture(3, false, true)).writeZip(input);
    const binding = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'investor-signatures', rows_field: 'investors',
        prototype_cells: ['Investor NameAddressPhone NumberEmail[Counsel cc, if any]'],
        columns: [{ paragraphs: [{ field: 'name' }] }],
      }],
    });
    expect(() => applyRepeatableTables(input, join(root, 'out.docx'), binding, { investors: [] }))
      .toThrow(/matched 2 tables/);
  });

  it('validates every paragraph mapping against array item metadata', () => {
    const binding = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'investor-signatures', rows_field: 'investors',
        prototype_cells: ['Investor NameAddress'],
        columns: [{ paragraphs: [{ field: 'name' }, { field: 'address' }] }],
      }],
    });
    expect(() => validateRepeatableTableFields(binding, [{
      name: 'investors', type: 'array', description: 'Investor rows',
      items: [{ name: 'name', type: 'string', description: 'Investor name' }],
    }])).toThrow(/column field "address" is not declared/);
  });
});
