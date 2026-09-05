import AdmZip from 'adm-zip';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { normalizeEmptyFillWhitespaceInDocx, runFillPipeline } from './unified-pipeline.js';

const it = itAllure.epic('Filling & Rendering');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

describe('empty-fill whitespace normalization', () => {
  it('closes punctuation seams but leaves complex Word fields untouched', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-empty-fill-whitespace-'));
    const path = join(dir, 'fixture.docx');
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
    zip.addFile('word/document.xml', Buffer.from(
      `<w:document xmlns:w="${W}"><w:body>` +
      '<w:p><w:r><w:t>United States </w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Directors </w:t></w:r><w:r><w:t>;</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">Section </w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF _Ref1 </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2.1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t xml:space="preserve"> , next</w:t></w:r></w:p>' +
      '</w:body></w:document>',
    ));
    zip.writeZip(path);

    await normalizeEmptyFillWhitespaceInDocx(path);

    const xml = new AdmZip(path).readAsText('word/document.xml');
    expect(xml).toContain('United States</w:t>');
    expect(xml).toContain('Directors</w:t>');
    expect(xml).toContain('REF _Ref1');
    expect(xml).toContain('xml:space="preserve"> , next');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('fatal delivery verification', () => {
  it('does not overwrite the requested output when a fatal check fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-fatal-delivery-'));
    const inputPath = join(dir, 'input.docx');
    const outputPath = join(dir, 'output.docx');
    const sentinel = Buffer.from('pre-existing output');
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.from(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
    ));
    zip.addFile('_rels/.rels', Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
    ));
    zip.addFile('word/_rels/document.xml.rels', Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    ));
    zip.addFile('word/document.xml', Buffer.from(
      `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Ordinary text</w:t></w:r></w:p></w:body></w:document>`,
    ));
    zip.writeZip(inputPath);
    writeFileSync(outputPath, sentinel);

    await expect(runFillPipeline({
      inputPath,
      outputPath,
      values: {},
      fields: [],
      verify: () => ({
        passed: false,
        checks: [{
          name: 'Word REF fields resolve',
          passed: false,
          fatal: true,
          details: 'word/document.xml: REF target "Missing" has no matching bookmark',
        }],
      }),
    })).rejects.toThrow(/Delivery blocked.*Missing/);

    expect(readFileSync(outputPath)).toEqual(sentinel);
    rmSync(dir, { recursive: true, force: true });
  });
});
