import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import AdmZip from 'adm-zip';
import {afterEach, describe, expect, it} from 'vitest';
import {applyRepeatableTables, RepeatableTablesConfigSchema} from '../src/core/field-selector/repeatable-tables.js';
import {runFillPipeline} from '../src/core/unified-pipeline.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const roots: string[] = [];

function sourceDocx(): Buffer {
  const zip = new AdmZip();
  const row = `<w:tr><w:tc><w:p><w:r><w:t>Investor Name</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Address</w:t></w:r></w:p></w:tc></w:tr>`;
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
    `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Lead: Investor Name</w:t></w:r></w:p>` +
    `<w:tbl>${row}${row}${row}</w:tbl></w:body></w:document>`,
  ));
  return zip.toBuffer();
}

function prepopulatedSourceDocx(): Buffer {
  const zip = new AdmZip(sourceDocx());
  const header = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
    '<w:tc><w:p><w:r><w:t>Investor</w:t></w:r></w:p></w:tc>' +
    '<w:tc><w:p><w:r><w:t>Commitment</w:t></w:r></w:p></w:tc></w:tr>';
  const rows = Array.from({length: 7}, (_, index) =>
    `<w:tr><w:trPr><w:cantSplit/><w:tblCellSpacing w:w="${index + 1}" w:type="dxa"/></w:trPr>` +
    `<w:tc><w:p><w:r><w:t>Legacy Investor ${index + 1}</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p><w:r><w:t>Legacy Amount ${index + 1}</w:t></w:r></w:p></w:tc></w:tr>`,
  ).join('');
  zip.updateFile('word/document.xml', Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Lead: Legacy Investor 1</w:t></w:r></w:p>` +
    `<w:tbl>${header}${rows}</w:tbl></w:body></w:document>`,
  ));
  return zip.toBuffer();
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
});

describe('repeatable-table full pipeline ordering', () => {
  it('matches source prototypes before scalar replacement and preserves generated party values', async () => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-pipeline-'));
    roots.push(root);
    const inputPath = join(root, 'source.docx');
    const outputPath = join(root, 'filled.docx');
    new AdmZip(sourceDocx()).writeZip(inputPath);
    const config = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'investor-signatures',
        rows_field: 'investors',
        prototype_cells: ['Investor NameAddress'],
        columns: [{paragraphs: [{field: 'name'}, {field: 'address'}]}],
      }],
    });
    const values = {
      investor_name: 'Lead Fund, L.P.',
      investors: [
        {name: 'Alpha Ventures, L.P.', address: '1 Alpha Way'},
        {name: 'Beta Capital, LLC', address: '2 Beta Road'},
      ],
    };

    await runFillPipeline({
      inputPath,
      outputPath,
      values,
      fields: [
        {name: 'investor_name', type: 'string', description: 'Lead investor'},
        {name: 'investors', type: 'array', description: 'Investor rows', items: [
          {name: 'name', type: 'string', description: 'Name'},
          {name: 'address', type: 'string', description: 'Address'},
        ]},
      ],
      cleanPatch: {
        cleanConfig: {removeParagraphPatterns: [], removeRanges: []},
        replacements: {'Investor Name': '{investor_name}'},
      },
      prePatchProcess: (source, destination) => applyRepeatableTables(source, destination, config, values),
      verify: () => ({passed: true, checks: []}),
    });

    const xml = new AdmZip(readFileSync(outputPath)).readAsText('word/document.xml');
    expect(xml).toContain('Lead: ');
    expect(xml).toContain('Lead Fund, L.P.');
    expect(xml).toContain('Alpha Ventures, L.P.');
    expect(xml).toContain('Beta Capital, LLC');
    expect(xml).toContain('1 Alpha Way');
    expect(xml).toContain('2 Beta Road');
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(2);
    expect(xml).not.toContain('Investor Name');
    expect(xml.match(/Lead Fund, L.P./g)).toHaveLength(1);
  });

  it('replaces seven distinct source rows before overlapping scalar fill', async () => {
    const root = mkdtempSync(join(tmpdir(), 'repeatable-pipeline-prepopulated-'));
    roots.push(root);
    const inputPath = join(root, 'source.docx');
    const outputPath = join(root, 'filled.docx');
    new AdmZip(prepopulatedSourceDocx()).writeZip(inputPath);
    const config = RepeatableTablesConfigSchema.parse({
      schema_version: 1,
      tables: [{
        id: 'investor-commitments',
        rows_field: 'investors',
        header_cells: ['Investor', 'Commitment'],
        existing_data_row_count: 7,
        prototype_row_index: 3,
        columns: [{field: 'name'}, {field: 'commitment', format: 'currency'}],
      }],
    });
    const values = {
      lead_investor: 'Lead Fund, L.P.',
      investors: [
        {name: 'Alpha Ventures, L.P.', commitment: 1000000},
        {name: 'Beta Capital, LLC', commitment: 2500000},
      ],
    };

    await runFillPipeline({
      inputPath,
      outputPath,
      values,
      fields: [
        {name: 'lead_investor', type: 'string', description: 'Lead investor'},
        {name: 'investors', type: 'array', description: 'Investor rows', items: [
          {name: 'name', type: 'string', description: 'Name'},
          {name: 'commitment', type: 'number', description: 'Commitment'},
        ]},
      ],
      cleanPatch: {
        cleanConfig: {removeParagraphPatterns: [], removeRanges: []},
        replacements: {'Legacy Investor 1': '{lead_investor}'},
      },
      prePatchProcess: (source, destination) => applyRepeatableTables(source, destination, config, values),
      verify: () => ({passed: true, checks: []}),
    });

    const outputZip = new AdmZip(readFileSync(outputPath));
    expect(outputZip.getEntry('[Content_Types].xml')).not.toBeNull();
    const xml = outputZip.readAsText('word/document.xml');
    expect(xml).toContain('Lead: ');
    expect(xml.match(/Lead Fund, L.P./g)).toHaveLength(1);
    expect(xml).toContain('Alpha Ventures, L.P.');
    expect(xml).toContain('1,000,000.00');
    expect(xml).toContain('Beta Capital, LLC');
    expect(xml).toContain('2,500,000.00');
    expect((xml.match(/<w:tr[ >]/g) ?? [])).toHaveLength(3);
    expect(xml).not.toContain('Legacy Investor');
    expect(xml).not.toContain('Legacy Amount');
    expect((xml.match(/w:tblCellSpacing w:w="3"/g) ?? [])).toHaveLength(2);
  });
});
