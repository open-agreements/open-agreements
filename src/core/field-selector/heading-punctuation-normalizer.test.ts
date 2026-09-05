import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import AdmZip from 'adm-zip';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeDetachedHeadingPunctuation } from './heading-punctuation-normalizer.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Filling & Rendering');

function fixture(body: string): { dir: string; input: string; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'heading-punctuation-'));
  const input = join(dir, 'input.docx');
  const output = join(dir, 'output.docx');
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`,
  ));
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.writeZip(input);
  return { dir, input, output };
}

describe('detached heading punctuation normalization', () => {
  it('joins an isolated punctuation continuation to its matching heading and preserves bookmarks', () => {
    const f = fixture(
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Sale of the Company</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="HeadingPara2"/></w:pPr><w:r><w:t>.</w:t></w:r>' +
      '<w:bookmarkStart w:id="9" w:name="_RefTail"/><w:bookmarkEnd w:id="9"/>' +
      '<w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Following text.</w:t></w:r></w:p>',
    );

    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(1);
    const xml = new AdmZip(f.output).readAsText('word/document.xml');
    expect(xml).toContain('Sale of the Company</w:t></w:r><w:r><w:t>.</w:t></w:r>');
    expect(xml).toContain('w:name="_RefTail"');
    expect(xml).not.toContain('HeadingPara2');
    rmSync(f.dir, { recursive: true, force: true });
  });

  it('leaves substantive continuations and mismatched heading levels unchanged', () => {
    const f = fixture(
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Heading</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="HeadingPara2"/></w:pPr><w:r><w:t>. Body</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="HeadingPara3"/></w:pPr><w:r><w:t>.</w:t></w:r></w:p>',
    );

    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(0);
    const xml = new AdmZip(f.output).readAsText('word/document.xml');
    expect(xml).toContain('. Body');
    expect(xml).toContain('HeadingPara3');
    rmSync(f.dir, { recursive: true, force: true });
  });

  it('fails closed on punctuation paragraphs carrying semantic references', () => {
    const f = fixture(
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Heading</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="HeadingPara2"/></w:pPr><w:r><w:t>.</w:t>' +
      '<w:footnoteReference w:id="48"/></w:r></w:p>',
    );

    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(0);
    const xml = new AdmZip(f.output).readAsText('word/document.xml');
    expect(xml).toContain('footnoteReference');
    expect(xml).toContain('HeadingPara2');
    rmSync(f.dir, { recursive: true, force: true });
  });
});
