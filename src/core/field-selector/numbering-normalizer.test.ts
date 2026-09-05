import AdmZip from 'adm-zip';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { normalizeNumberedHeadingSections } from './numbering-normalizer.js';

const it = itAllure.epic('Filling & Rendering');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function fixture(ambiguous = false) {
  const dir = mkdtempSync(join(tmpdir(), 'numbering-normalizer-'));
  const input = join(dir, 'input.docx');
  const output = join(dir, 'output.docx');
  const p = (style: string, text: string) => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const zip = new AdmZip();
  const ref = '<w:p><w:bookmarkStart w:id="7" w:name="_RefTarget"/><w:r><w:t>Target</w:t></w:r><w:bookmarkEnd w:id="7"/></w:p><w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF _RefTarget </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2.1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}"><w:body>${p('H1','One')}${p('H2','One A')}${p('H1','Two')}${p('H2','Two A')}${p('H2','Two B')}${ref}${ambiguous ? p('Other','Other One') + p('Other','Other Two') : ''}</w:body></w:document>`));
  zip.addFile('word/styles.xml', Buffer.from(`<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="H1"><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="H2"><w:basedOn w:val="H1"/><w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr><w:outlineLvl w:val="1"/></w:pPr></w:style>${ambiguous ? '<w:style w:type="paragraph" w:styleId="Other"><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' : ''}</w:styles>`));
  const abstract = (id: number) => `<w:abstractNum w:abstractNumId="${id}"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/></w:lvl></w:abstractNum><w:num w:numId="${id + 1}"><w:abstractNumId w:val="${id}"/></w:num>`;
  zip.addFile('word/numbering.xml', Buffer.from(`<w:numbering xmlns:w="${W}">${abstract(0)}${ambiguous ? abstract(1) : ''}</w:numbering>`));
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.writeZip(input);
  return { dir, input, output };
}

describe('post-selection numbered heading normalization', () => {
  it('materializes deterministic starts without touching text, bookmarks, or cached REF results', () => {
    const f = fixture();
    expect(normalizeNumberedHeadingSections(f.input, f.output)).toEqual({ sections: 2, paragraphs: 5 });
    const zip = new AdmZip(f.output);
    const documentXml = zip.readAsText('word/document.xml');
    const numberingXml = zip.readAsText('word/numbering.xml');
    expect(documentXml).toContain('One A');
    expect(documentXml).toContain('w:name="_RefTarget"');
    expect(documentXml).toContain('REF _RefTarget');
    expect(documentXml).toContain('<w:t>2.1</w:t>');
    expect((documentXml.match(/<w:fldChar/g) ?? [])).toHaveLength(3);
    expect(numberingXml).toContain('w:val="2"');
    expect((documentXml.match(/<w:numId/g) ?? [])).toHaveLength(5);
    const paragraphNumIds = [...documentXml.matchAll(/<w:numId w:val="(\d+)"/g)].map((match) => match[1]);
    expect(paragraphNumIds[0]).toBe(paragraphNumIds[1]);
    expect(paragraphNumIds[2]).toBe(paragraphNumIds[3]);
    expect(paragraphNumIds[3]).toBe(paragraphNumIds[4]);
    expect(paragraphNumIds[0]).not.toBe(paragraphNumIds[2]);
    rmSync(f.dir, { recursive: true, force: true });
  });

  it('fails closed when two hierarchical top-level numbering sequences are equally plausible', () => {
    const f = fixture(true);
    expect(() => normalizeNumberedHeadingSections(f.input, f.output)).toThrow(/ambiguous dominant/);
    rmSync(f.dir, { recursive: true, force: true });
  });
});
