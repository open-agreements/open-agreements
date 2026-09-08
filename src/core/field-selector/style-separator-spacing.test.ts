import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { createNumberingRenderCopy } from './numbering-render-copy.js';
import { inspectStyleSeparatorSpacingSource } from './style-separator-spacing.js';
import { FieldSelectorMetadataSchema, StyleSeparatorSpacingProfileSchema } from '../metadata.js';
import { createProgram } from '../../cli/index.js';

const it = itAllure.epic('Filling & Rendering');
const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'separator-spacing-')); dirs.push(dir);
  const source = join(dir, 'source.docx'), input = join(dir, 'editable.docx'), output = join(dir, 'preview.render.docx');
  const zip = new AdmZip();
  zip.addFile('word/styles.xml', Buffer.from(`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Continuation"><w:basedOn w:val="Title"/></w:style></w:styles>`));
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}" xmlns:w14="${W14}"><w:body><w:p w14:paraId="11111111"><w:pPr><w:pStyle w:val="Title"/><w:spacing w:before="240" w:after="0"/><w:rPr><w:vanish/><w:specVanish/></w:rPr></w:pPr><w:bookmarkStart w:id="1" w:name="Heading"/><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>Short heading</w:t></w:r></w:p><w:p w14:paraId="22222222"><w:pPr><w:pStyle w:val="Continuation"/><w:keepNext w:val="0"/><w:rPr><w:specVanish/></w:rPr></w:pPr><w:r><w:t>.</w:t></w:r><w:bookmarkEnd w:id="1"/><w:r><w:t xml:space="preserve"> Body text may change.</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`));
  zip.writeZip(source); writeFileSync(input, readFileSync(source));
  const boundary = { heading_para_id: '11111111', continuation_para_id: '22222222', before_twips: 240 };
  const profile = { boundaries: [{ ...boundary, expected_layout_sha256: inspectStyleSeparatorSpacingSource(source, boundary) }] };
  const options = { sourcePath: source, sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'), profile };
  return { dir, source, input, output, options };
}
function change(path: string, from: string, to: string, part = 'word/document.xml') {
  const zip = new AdmZip(path); const xml = zip.readAsText(part);
  expect(xml).toContain(from); zip.updateFile(part, Buffer.from(xml.replace(from, to))); zip.writeZip(path);
}
const documentXml = (path: string) => new AdmZip(path).readAsText('word/document.xml');

describe('source-declared render-only style separator spacing', () => {
  it('transfers only declared spacing, preserving text, run formatting, bookmarks, mark flags and editable bytes', () => {
    const f = fixture(), original = readFileSync(f.input), before = documentXml(f.input);
    const result = createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: f.options });
    expect(readFileSync(f.input)).toEqual(original); expect(readFileSync(f.source)).toEqual(original);
    expect(result.styleSeparatorSpacing).toEqual({ sourceSha256: f.options.sourceSha256, profileSha256: expect.stringMatching(/^[a-f0-9]{64}$/), replacements: 1, headingParaIds: ['11111111'] });
    expect(documentXml(f.output)).toBe(before.replace('w:before="240"', 'w:before="0"').replace('<w:keepNext w:val="0"/><w:rPr>', '<w:keepNext w:val="0"/><w:spacing w:before="240"/><w:rPr>'));
  });

  it('is opt-in and permits dynamic body prose without weakening the heading/leading-period fingerprint', () => {
    const f = fixture(); change(f.input, 'Body text may change.', 'Different filled body prose.');
    const baseline = join(f.dir, 'unchanged.render.docx');
    expect(createNumberingRenderCopy(f.input, baseline).styleSeparatorSpacing).toBeUndefined();
    expect(documentXml(baseline)).toBe(documentXml(f.input));
    createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: f.options });
    expect(documentXml(f.output)).toContain('Different filled body prose.');
  });

  it('inserts spacing after numbering and before indentation and alignment properties', () => {
    const f = fixture();
    for (const path of [f.source, f.input]) change(path, '<w:keepNext w:val="0"/>', '<w:keepNext w:val="0"/><w:numPr><w:numId w:val="0"/></w:numPr><w:ind w:left="0"/><w:jc w:val="left"/>');
    f.options.sourceSha256 = createHash('sha256').update(readFileSync(f.source)).digest('hex');
    f.options.profile.boundaries[0].expected_layout_sha256 = inspectStyleSeparatorSpacingSource(f.source, f.options.profile.boundaries[0]);
    createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: f.options });
    expect(documentXml(f.output)).toContain('<w:numPr><w:numId w:val="0"/></w:numPr><w:spacing w:before="240"/><w:ind w:left="0"/><w:jc w:val="left"/>');
  });

  it('supports pinned character-style metrics and a period sharing a mutable prose run', () => {
    const f = fixture();
    for (const path of [f.source, f.input]) {
      change(path, '</w:styles>', '<w:style w:type="character" w:styleId="TitleChar"><w:rPr><w:sz w:val="22"/></w:rPr></w:style></w:styles>', 'word/styles.xml');
      change(path, '<w:u w:val="single"/>', '<w:rStyle w:val="TitleChar"/><w:u w:val="single"/>');
      change(path, '<w:t>.</w:t>', '<w:t>. Original mutable prose.</w:t>');
    }
    f.options.sourceSha256 = createHash('sha256').update(readFileSync(f.source)).digest('hex');
    f.options.profile.boundaries[0].expected_layout_sha256 = inspectStyleSeparatorSpacingSource(f.source, f.options.profile.boundaries[0]);
    change(f.input, 'Original mutable prose.', 'Different filled prose.');
    change(f.input, '<w:t>Short heading</w:t>', '<w:t xml:space="preserve">Short heading</w:t>');
    createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: f.options });
    expect(documentXml(f.output)).toContain('Different filled prose.');
    expect(documentXml(f.output)).toContain('<w:rStyle w:val="TitleChar"/>');
    change(f.input, 'w:styleId="TitleChar"><w:rPr>', 'w:styleId="TitleChar"><w:rPr><w:vanish/>', 'word/styles.xml');
    const rejected = join(f.dir, 'hidden.render.docx');
    expect(() => createNumberingRenderCopy(f.input, rejected, { styleSeparatorSpacing: f.options })).toThrow(/character style/);
    expect(existsSync(rejected)).toBe(false);
  });

  it('does not discard meaningful edge-whitespace preservation or accept source-style drift', () => {
    const f = fixture();
    for (const path of [f.source, f.input]) change(path, '<w:t>Short heading</w:t>', '<w:t xml:space="preserve"> Short heading</w:t>');
    f.options.sourceSha256 = createHash('sha256').update(readFileSync(f.source)).digest('hex');
    f.options.profile.boundaries[0].expected_layout_sha256 = inspectStyleSeparatorSpacingSource(f.source, f.options.profile.boundaries[0]);
    change(f.input, '<w:t xml:space="preserve"> Short heading</w:t>', '<w:t> Short heading</w:t>');
    expect(() => createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: f.options })).toThrow(/input layout/);
    expect(existsSync(f.output)).toBe(false);
  });

  for (const [name, from, to, part] of [
    ['stale ID', '11111111', '33333333'],
    ['changed heading / potential wrapping', 'Short heading', 'Much longer altered heading which may wrap'],
    ['extra hyperlink heading text', '<w:bookmarkStart', '<w:hyperlink><w:r><w:t>Extra heading text</w:t></w:r></w:hyperlink><w:bookmarkStart'],
    ['extra structured heading text', '<w:bookmarkStart', '<w:sdt><w:sdtContent><w:r><w:t>Extra heading text</w:t></w:r></w:sdtContent></w:sdt><w:bookmarkStart'],
    ['extra hyperlink continuation prefix', '<w:r><w:t>.</w:t>', '<w:hyperlink><w:r><w:t>Extra prefix</w:t></w:r></w:hyperlink><w:r><w:t>.</w:t>'],
    ['extra structured continuation prefix', '<w:r><w:t>.</w:t>', '<w:sdt><w:sdtContent><w:r><w:t>Extra prefix</w:t></w:r></w:sdtContent></w:sdt><w:r><w:t>.</w:t>'],
    ['changed page geometry', 'w:w="12240"', 'w:w="6500"'],
    ['changed run metrics', '<w:u w:val="single"/>', '<w:u w:val="single"/><w:sz w:val="30"/>'],
    ['explicit heading break', '<w:t>Short heading</w:t>', '<w:t>Short</w:t><w:br/><w:t>heading</w:t>'],
    ['paragraph revision', '<w:vanish/>', '<w:del w:id="9"/><w:vanish/>'],
    ['frame boundary', '<w:spacing w:before="240"', '<w:framePr/><w:spacing w:before="240"'],
    ['page break property', '<w:spacing w:before="240"', '<w:pageBreakBefore/><w:spacing w:before="240"'],
    ['automatic spacing', 'w:before="240"', 'w:before="240" w:beforeAutospacing="0"'],
    ['line-unit spacing', 'w:before="240"', 'w:before="240" w:beforeLines="100"'],
    ['hidden continuation', '<w:keepNext w:val="0"/><w:rPr>', '<w:keepNext w:val="0"/><w:rPr><w:vanish/>'],
    ['missing style family', '<w:basedOn w:val="Title"/>', '', 'word/styles.xml'],
    ['changed inherited font', 'w:ascii="Times New Roman"', 'w:ascii="Arial"', 'word/styles.xml'],
  ]) {
    it(`rejects ${name} before writing output`, () => {
      const f = fixture(); change(f.input, from, to, part); const bytes = readFileSync(f.input);
      expect(() => createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: f.options })).toThrow(/spacing:/);
      expect(existsSync(f.output)).toBe(false); expect(readFileSync(f.input)).toEqual(bytes);
    });
  }

  it('rejects wrong source hash, stale declared fingerprint, duplicate IDs and missing declared pairs', () => {
    const f = fixture();
    expect(() => createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: { ...f.options, sourceSha256: '0'.repeat(64) } })).toThrow(/source SHA/);
    const bad = structuredClone(f.options); bad.profile.boundaries[0].expected_layout_sha256 = '0'.repeat(64);
    expect(() => createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: bad })).toThrow(/source layout fingerprint/);
    expect(() => StyleSeparatorSpacingProfileSchema.parse({ boundaries: [...f.options.profile.boundaries, ...f.options.profile.boundaries] })).toThrow(/unique/);
    bad.profile.boundaries.push({ ...f.options.profile.boundaries[0], heading_para_id: '33333333', continuation_para_id: '44444444' });
    bad.profile.boundaries[0].expected_layout_sha256 = f.options.profile.boundaries[0].expected_layout_sha256;
    expect(() => createNumberingRenderCopy(f.input, f.output, { styleSeparatorSpacing: bad })).toThrow(/missing/);
    expect(existsSync(f.output)).toBe(false);
  });

  it('parses canonical metadata, requires source pin and exercises paired CLI options and receipt', async () => {
    const f = fixture(); const metadata = { name: 'Synthetic source', source_url: 'https://example.com/source.docx', source_version: '1', license_note: 'Synthetic test', source_sha256: f.options.sourceSha256, rendering: { style_separator_spacing: f.options.profile } };
    expect(FieldSelectorMetadataSchema.parse(metadata).rendering).toEqual(metadata.rendering);
    expect(() => FieldSelectorMetadataSchema.parse({ ...metadata, source_sha256: undefined })).toThrow(/source SHA/);
    const path = join(f.dir, 'metadata.yaml'); writeFileSync(path, JSON.stringify(metadata));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(createProgram().parseAsync(['field-selector', 'render-copy', f.input, '-o', f.output, '--style-separator-metadata', path], { from: 'user' })).rejects.toThrow(/Both/);
    await createProgram().parseAsync(['field-selector', 'render-copy', f.input, '-o', f.output, '--style-separator-metadata', path, '--style-separator-source', f.source], { from: 'user' });
    expect(JSON.parse(log.mock.calls.at(-1)![0]).styleSeparatorSpacing.replacements).toBe(1);
  });
});
