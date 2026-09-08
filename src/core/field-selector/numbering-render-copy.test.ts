import AdmZip from 'adm-zip';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { createNumberingRenderCopy } from './numbering-render-copy.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Filling & Rendering');
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(numbering = true) {
  const dir = mkdtempSync(join(tmpdir(), 'render-copy-')); dirs.push(dir);
  const input = join(dir, 'editable.docx'); const output = join(dir, 'preview.render.docx');
  const zip = new AdmZip();
  const p = (level: number, text: string, hidden = false) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr>${hidden ? '<w:rPr><w:vanish/><w:specVanish/></w:rPr>' : ''}</w:pPr>${text === 'Child one' ? '<w:bookmarkStart w:id="1" w:name="Target"/>' : ''}<w:r><w:t>${text}</w:t></w:r>${text === 'Child one' ? '<w:bookmarkEnd w:id="1"/>' : ''}</w:p>`;
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}"><w:body>${p(0, 'Article')}${p(1, 'Alpha', true)}${p(2, 'Child one')}${p(2, 'Child two')}${p(1, 'Beta')}${p(2, 'Child three')}<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF Target \\w </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1.1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:body></w:document>`));
  if (numbering) zip.addFile('word/numbering.xml', Buffer.from(`<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:nsid w:val="12345678"/>${[0, 1, 2].map((i) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${i === 2 ? 'lowerLetter' : 'decimal'}"/><w:pStyle w:val="Heading${i + 1}"/><w:lvlText w:val="${i === 2 ? '(%3)' : i === 1 ? '%1.%2' : '%1.'}"/></w:lvl>`).join('')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`));
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.writeZip(input);
  return { input, output, dir };
}

describe('disposable numbering render copies', () => {
  it('preserves editable bytes, text, fields, bookmarks and hierarchy while snapshotting counters', () => {
    const f = fixture(); const original = readFileSync(f.input);
    const result = createNumberingRenderCopy(f.input, f.output);
    expect(result.renderOnly).toBe(true); expect(result.paragraphs).toBe(6);
    expect(readFileSync(f.input)).toEqual(original);
    expect(result.inputSha256).toBe(createHash('sha256').update(original).digest('hex'));
    expect(result.outputSha256).toBe(createHash('sha256').update(readFileSync(f.output)).digest('hex'));
    const parser = new DOMParser(); const before = parser.parseFromString(new AdmZip(original).readAsText('word/document.xml'), 'text/xml');
    const zip = new AdmZip(f.output); const after = parser.parseFromString(zip.readAsText('word/document.xml'), 'text/xml');
    for (const local of ['bookmarkStart', 'bookmarkEnd', 'specVanish']) {
      expect(Array.from(after.getElementsByTagNameNS(W, local)).map((n) => n.toString()))
        .toEqual(Array.from(before.getElementsByTagNameNS(W, local)).map((n) => n.toString()));
    }
    expect(result.references).toBe(1);
    expect(after.getElementsByTagNameNS(W, 'instrText').length).toBe(0);
    expect(after.getElementsByTagNameNS(W, 'fldChar').length).toBe(0);
    const beforeText = Array.from(before.getElementsByTagNameNS(W, 't')).map((n) => n.textContent);
    const afterText = Array.from(after.getElementsByTagNameNS(W, 't')).map((n) => n.textContent);
    expect(afterText.slice(0, -1)).toEqual(beforeText.slice(0, -1));
    expect(afterText.at(-1)).toBe('1.1(a)');
    const numbering = parser.parseFromString(zip.readAsText('word/numbering.xml'), 'text/xml');
    const abstracts = Array.from(numbering.getElementsByTagNameNS(W, 'abstractNum')).slice(1);
    expect(abstracts.map((a) => Array.from(a.getElementsByTagNameNS(W, 'start')).map((s) => Number(s.getAttributeNS(W, 'val')))))
      .toEqual([[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 2], [1, 2, 1], [1, 2, 1]]);
    expect(abstracts.every((a) => a.getElementsByTagNameNS(W, 'pStyle').length === 0)).toBe(true);
    expect(new Set(abstracts.map((a) => a.getElementsByTagNameNS(W, 'nsid')[0].getAttributeNS(W, 'val'))).size).toBe(6);
    const children = Array.from(numbering.documentElement!.childNodes).filter((n) => n.nodeType === 1);
    const names = children.map((n) => n.nodeName);
    expect(names).toEqual([...Array(7).fill('w:abstractNum'), ...Array(7).fill('w:num')]);
  });

  it('never overwrites input, an existing copy, or a symlink alias', () => {
    const f = fixture(); const bytes = readFileSync(f.input);
    expect(() => createNumberingRenderCopy(f.input, f.input)).toThrow(/distinct/);
    expect(() => createNumberingRenderCopy(f.input, join(f.dir, 'deliverable.docx'))).toThrow(/render.docx/);
    symlinkSync(f.input, f.output);
    expect(() => createNumberingRenderCopy(f.input, f.output)).toThrow(/EEXIST/);
    expect(readFileSync(f.input)).toEqual(bytes);
  });

  it('adds renderer identities when absent and preserves the numbering cleanup tail order', () => {
    const f = fixture();
    const zip = new AdmZip(f.input);
    zip.updateFile('word/numbering.xml', Buffer.from(zip.readAsText('word/numbering.xml')
      .replace('<w:nsid w:val="12345678"/>', '')
      .replace('</w:numbering>', '<w:numIdMacAtCleanup w:val="1"/></w:numbering>')));
    zip.writeZip(f.input);
    createNumberingRenderCopy(f.input, f.output);
    const document = new DOMParser().parseFromString(new AdmZip(f.output).readAsText('word/numbering.xml'), 'text/xml');
    const names = Array.from(document.documentElement!.childNodes).filter((n) => n.nodeType === 1).map((n) => n.nodeName);
    expect(names).toEqual([...Array(7).fill('w:abstractNum'), ...Array(7).fill('w:num'), 'w:numIdMacAtCleanup']);
    const identities = Array.from(document.getElementsByTagNameNS(W, 'nsid')).map((n) => n.getAttributeNS(W, 'val'));
    expect(new Set(identities).size).toBe(6);
    expect(identities.every((value) => /^[0-9A-F]{8}$/.test(value ?? ''))).toBe(true);
  });

  it('refuses to chain render-only copies into a supposed editable source', () => {
    const f = fixture(); createNumberingRenderCopy(f.input, f.output);
    expect(() => createNumberingRenderCopy(f.output, join(f.dir, 'second.render.docx'))).toThrow(/original DOCX/);
  });

  it('materializes a default level before an existing numId', () => {
    const f = fixture(); const zip = new AdmZip(f.input);
    zip.updateFile('word/document.xml', Buffer.from(zip.readAsText('word/document.xml').replace('<w:ilvl w:val="0"/>', '')));
    zip.writeZip(f.input);
    createNumberingRenderCopy(f.input, f.output);
    const document = new DOMParser().parseFromString(new AdmZip(f.output).readAsText('word/document.xml'), 'text/xml');
    const numPr = document.getElementsByTagNameNS(W, 'numPr')[0];
    expect(Array.from(numPr.childNodes).filter((n) => n.nodeType === 1).map((n) => n.nodeName)).toEqual(['w:ilvl', 'w:numId']);
  });

  it('copies an unnumbered document without claiming rewritten paragraphs', () => {
    const f = fixture(false);
    const zip = new AdmZip(f.input);
    zip.updateFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Plain unnumbered text.</w:t></w:r></w:p></w:body></w:document>`));
    zip.writeZip(f.input);
    expect(createNumberingRenderCopy(f.input, f.output).paragraphs).toBe(0);
    expect(new AdmZip(f.output).readAsText('word/document.xml')).toBe(new AdmZip(f.input).readAsText('word/document.xml'));
  });

  it('rejects used numbering references when the numbering part is missing', () => {
    const f = fixture(false);
    expect(() => createNumberingRenderCopy(f.input, f.output)).toThrow(/unresolved numbering instance/);
    expect(existsSync(f.output)).toBe(false);
  });

  it.each(['hdr', 'ftr', 'footnotes', 'endnotes'])('rejects numbered %s stories before writing output', (root) => {
    const f = fixture(); const zip = new AdmZip(f.input);
    zip.addFile('word/custom-story.xml', Buffer.from(`<w:${root} xmlns:w="${W}"><w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Other story</w:t></w:r></w:p></w:${root}>`));
    zip.writeZip(f.input); const original = readFileSync(f.input);
    expect(() => createNumberingRenderCopy(f.input, f.output)).toThrow(/stories are unsupported|custom-story.xml.*unsupported/);
    expect(existsSync(f.output)).toBe(false);
    expect(readFileSync(f.input)).toEqual(original);
  });

  it('rejects numbered textboxes instead of advancing main-story counters', () => {
    const f = fixture(); const zip = new AdmZip(f.input);
    zip.updateFile('word/document.xml', Buffer.from(zip.readAsText('word/document.xml').replace('<w:body>', '<w:body><w:txbxContent>').replace('</w:body>', '</w:txbxContent></w:body>')));
    zip.writeZip(f.input);
    expect(() => createNumberingRenderCopy(f.input, f.output)).toThrow(/numbered textbox/);
    expect(existsSync(f.output)).toBe(false);
  });

  it('rejects split REF instructions in an otherwise unnumbered header', () => {
    const f = fixture(); const zip = new AdmZip(f.input);
    zip.addFile('word/header1.xml', Buffer.from(`<w:hdr xmlns:w="${W}"><w:p><w:r><w:instrText> R</w:instrText></w:r><w:r><w:instrText>EF Target \\w </w:instrText></w:r></w:p></w:hdr>`));
    zip.writeZip(f.input);
    expect(() => createNumberingRenderCopy(f.input, f.output)).toThrow(/header1.xml.*unsupported/);
    expect(existsSync(f.output)).toBe(false);
  });

  it.each(['numbered branches', 'split REF', 'simple REF'])('rejects AlternateContent with %s before writing', kind => {
    const f = fixture(); const zip = new AdmZip(f.input);
    const content = kind === 'numbered branches'
      ? '<w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Alternative numbered paragraph</w:t></w:r></w:p>'
      : kind === 'split REF'
        ? '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> R</w:instrText></w:r><w:r><w:instrText>EF Target \\w </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
        : '<w:p><w:fldSimple w:instr="REF Target \\w"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>';
    const alternate = `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><mc:Choice Requires="w14">${content}</mc:Choice><mc:Fallback>${content}</mc:Fallback></mc:AlternateContent>`;
    zip.updateFile('word/document.xml', Buffer.from(zip.readAsText('word/document.xml').replace('<w:body>', `<w:body>${alternate}`)));
    zip.writeZip(f.input); const original = readFileSync(f.input);
    expect(() => createNumberingRenderCopy(f.input, f.output)).toThrow(/AlternateContent.*unsupported/);
    expect(existsSync(f.output)).toBe(false);
    expect(readFileSync(f.input)).toEqual(original);
  });
});
