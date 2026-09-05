import AdmZip from 'adm-zip';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { normalizeEmptyFillWhitespaceInDocx } from './unified-pipeline.js';

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
