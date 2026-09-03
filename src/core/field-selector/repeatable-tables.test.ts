import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { applyRepeatableTables, RepeatableTablesConfigSchema, validateRepeatableTableFields } from './repeatable-tables.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const roots: string[] = [];

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
});
