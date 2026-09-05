import AdmZip from 'adm-zip';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { applyReferenceFieldActions, ReferenceFieldsConfigSchema } from './reference-fields.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const dirs: string[] = [];
const it = itAllure.epic('FieldSelectors');

function fixture(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-reference-fields-'));
  dirs.push(dir);
  const path = join(dir, 'input.docx');
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`));
  zip.writeZip(path);
  return path;
}

const action = {
  target: '_DV_M84',
  strategy: 'literalize' as const,
  literal: '2.1',
  expected_cached_result: '2.1',
  expected_matches: 1,
  expected_target_count: 0,
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('declarative REF-field actions', () => {
  it('literalizes a split complex REF atomically and preserves result formatting and unrelated fields', () => {
    const input = fixture(
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText> RE</w:instrText></w:r><w:r><w:instrText>F _DV_M84 \\h </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:rPr><w:b/></w:rPr><w:t>2.</w:t></w:r><w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
      '<w:p><w:bookmarkStart w:id="7" w:name="_Keep"/><w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText> REF _Keep \\h </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>9.9</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
    );
    const output = join(input, '..', 'output.docx');
    applyReferenceFieldActions(input, output, { version: 1, actions: [action] });
    const xml = new AdmZip(output).readAsText('word/document.xml');
    expect(xml).not.toContain('_DV_M84');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('>2.1</w:t>');
    expect(xml).toContain('REF _Keep');
    expect(xml).toContain('w:name="_Keep"');
  });

  it('literalizes an atomic fldSimple REF and preserves its result style', () => {
    const input = fixture('<w:p><w:fldSimple w:instr=" REF _DV_M84 \\h "><w:r><w:rPr><w:i/></w:rPr><w:t>2.1</w:t></w:r></w:fldSimple></w:p>');
    const output = join(input, '..', 'output.docx');
    applyReferenceFieldActions(input, output, { version: 1, actions: [action] });
    const xml = new AdmZip(output).readAsText('word/document.xml');
    expect(xml).not.toContain('fldSimple');
    expect(xml).not.toContain('_DV_M84');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('>2.1</w:t>');
  });

  it.each([
    ['absent REF', '<w:p><w:r><w:t>ordinary</w:t></w:r></w:p>', /expected 1 REF field match\(es\), found 0/],
    ['ambiguous REF', '<w:p><w:fldSimple w:instr=" REF _DV_M84 "><w:r><w:t>2.1</w:t></w:r></w:fldSimple><w:fldSimple w:instr=" REF _DV_M84 "><w:r><w:t>2.1</w:t></w:r></w:fldSimple></w:p>', /expected 1 REF field match\(es\), found 2/],
    ['stale cache', '<w:p><w:fldSimple w:instr=" REF _DV_M84 "><w:r><w:t>2.2</w:t></w:r></w:fldSimple></w:p>', /expected cached result "2.1", found "2.2"/],
    ['unexpected live target', '<w:p><w:bookmarkStart w:id="1" w:name="_DV_M84"/><w:fldSimple w:instr=" REF _DV_M84 "><w:r><w:t>2.1</w:t></w:r></w:fldSimple></w:p>', /expected 0 bookmark target\(s\), found 1/],
  ])('fails closed without writing output for %s', (_name, body, error) => {
    const input = fixture(body);
    const output = join(input, '..', 'output.docx');
    expect(() => applyReferenceFieldActions(input, output, { version: 1, actions: [action] })).toThrow(error);
    expect(() => new AdmZip(output)).toThrow();
  });

  it('rejects duplicate targets and incomplete declarations', () => {
    expect(() => ReferenceFieldsConfigSchema.parse({ version: 1, actions: [action, action] })).toThrow(/duplicate target/);
    expect(() => ReferenceFieldsConfigSchema.parse({ version: 1, actions: [{ target: '_DV_M84' }] })).toThrow();
  });
});
