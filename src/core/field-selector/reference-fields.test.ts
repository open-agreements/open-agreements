import AdmZip from 'adm-zip';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const groupedAction = {
  target: '_Ref137784392',
  strategy: 'literalize' as const,
  expected_matches: 3,
  expected_target_count: 0,
  groups: [
    { expected_cached_result: '2.3.2(b)', literal: '2.3.2(b)', expected_matches: 1 },
    { expected_cached_result: '(b)', literal: '(b)', expected_matches: 2 },
  ],
};

const simpleField = (target: string, result: string, style = '') =>
  `<w:fldSimple w:instr=" REF ${target} \\h "><w:r>${style}<w:t>${result}</w:t></w:r></w:fldSimple>`;

const complexField = (target: string, resultRuns: string, splitInstruction = false) =>
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
  (splitInstruction
    ? `<w:r><w:instrText> RE</w:instrText></w:r><w:r><w:instrText>F ${target} \\h </w:instrText></w:r>`
    : `<w:r><w:instrText> REF ${target} \\h </w:instrText></w:r>`) +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' + resultRuns +
  '<w:r><w:fldChar w:fldCharType="end"/></w:r>';

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

  it('literalizes one target transactionally by cached-result groups across atomic, complex, and split fields', () => {
    const input = fixture(
      `<w:p>${simpleField('_Ref137784392', '2.3.2(b)', '<w:rPr><w:b/></w:rPr>')}</w:p>` +
      `<w:p>${complexField('_Ref137784392', '<w:r><w:rPr><w:i/></w:rPr><w:t>(b)</w:t></w:r>')}</w:p>` +
      `<w:p>${complexField('_Ref137784392', '<w:r><w:t>(</w:t></w:r><w:r><w:t>b)</w:t></w:r>', true)}</w:p>` +
      `<w:p>${simpleField('_Keep', '9.9')}</w:p>`,
    );
    const output = join(input, '..', 'output.docx');
    applyReferenceFieldActions(input, output, { version: 1, actions: [groupedAction] });
    const xml = new AdmZip(output).readAsText('word/document.xml');
    expect(xml).not.toContain('_Ref137784392');
    expect(xml.match(/>2\.3\.2\(b\)<\/w:t>/g)).toHaveLength(1);
    expect(xml.match(/>\(b\)<\/w:t>/g)).toHaveLength(2);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('REF _Keep');
    expect(xml).toContain('>9.9</w:t>');
  });

  it.each([
    [
      'undeclared cached result',
      `<w:p>${simpleField('_Ref137784392', '2.3.2(b)')}</w:p>` +
        `<w:p>${simpleField('_Ref137784392', '(b)')}</w:p>` +
        `<w:p>${simpleField('_Ref137784392', '(c)')}</w:p>`,
      /undeclared cached result "\(c\)"/,
    ],
    [
      'mismatched group count',
      `<w:p>${simpleField('_Ref137784392', '2.3.2(b)')}</w:p>` +
        `<w:p>${simpleField('_Ref137784392', '2.3.2(b)')}</w:p>` +
        `<w:p>${simpleField('_Ref137784392', '(b)')}</w:p>`,
      /cached-result group "2\.3\.2\(b\)" expected 1 REF field match\(es\), found 2/,
    ],
  ])('fails closed for grouped action with %s', (_name, body, error) => {
    const input = fixture(body);
    const output = join(input, '..', 'output.docx');
    expect(() => applyReferenceFieldActions(input, output, { version: 1, actions: [groupedAction] })).toThrow(error);
    expect(() => new AdmZip(output)).toThrow();
  });

  it('validates every action before mutation and preserves a pre-existing output on rollback', () => {
    const input = fixture(
      `<w:p>${simpleField('_DV_M84', '2.1')}</w:p>` +
      `<w:p>${simpleField('_Ref137784392', '2.3.2(b)')}</w:p>` +
      `<w:p>${simpleField('_Ref137784392', '(b)')}</w:p>` +
      `<w:p>${simpleField('_Ref137784392', '(c)')}</w:p>`,
    );
    const output = join(input, '..', 'output.docx');
    const sentinel = Buffer.from('pre-existing-output');
    writeFileSync(output, sentinel);
    expect(() => applyReferenceFieldActions(input, output, { version: 1, actions: [action, groupedAction] }))
      .toThrow(/undeclared cached result "\(c\)"/);
    expect(readFileSync(output)).toEqual(sentinel);
    expect(new AdmZip(input).readAsText('word/document.xml')).toContain('_DV_M84');
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

  it('rejects duplicate groups and partial group partitions in the schema', () => {
    expect(() => ReferenceFieldsConfigSchema.parse({
      version: 1,
      actions: [{ ...groupedAction, groups: [...groupedAction.groups, groupedAction.groups[0]] }],
    })).toThrow(/duplicate cached-result group/);
    expect(() => ReferenceFieldsConfigSchema.parse({
      version: 1,
      actions: [{ ...groupedAction, groups: [groupedAction.groups[0]] }],
    })).toThrow(/group expected_matches sum 1 does not equal action expected_matches 3/);
  });
});
