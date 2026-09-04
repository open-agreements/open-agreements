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
});
