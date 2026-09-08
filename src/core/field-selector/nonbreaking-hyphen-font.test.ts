import { describe, expect } from 'vitest';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { applyNonbreakingHyphenFont } from './nonbreaking-hyphen-font.js';

const it = itAllure.epic('Filling & Rendering');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parse = (body: string) => new DOMParser().parseFromString(`<w:document xmlns:w="${W}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body>${body}</w:body></w:document>`, 'text/xml');
const xml = (node: Parameters<XMLSerializer['serializeToString']>[0]) => new XMLSerializer().serializeToString(node);

describe('opt-in nonbreaking-hyphen font isolation', () => {
  it('isolates token and literal glyphs while preserving text, run properties and semantic events', () => {
    const doc = parse('<w:p><w:bookmarkStart w:id="9" w:name="Target"/><w:r w:rsidR="1234"><w:rPr><w:rStyle w:val="Emphasis"/><w:rFonts w:ascii="Original" w:asciiTheme="majorHAnsi"/><w:b/><w:lang w:val="en-US"/></w:rPr><w:t xml:space="preserve"> A </w:t><w:noBreakHyphen/><w:t> B‑ C‑D </w:t><w:commentReference w:id="4"/></w:r><w:bookmarkEnd w:id="9"/><w:r><w:fldChar w:fldCharType="begin"/><w:instrText> REF Target </w:instrText><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t>Unrelated ASCII-hyphen</w:t></w:r></w:p>');
    const before = Array.from(doc.getElementsByTagNameNS(W, 'r')).slice(1).map(xml);
    expect(applyNonbreakingHyphenFont(doc, 'Example & "Serif"')).toEqual({ fontFamily: 'Example & "Serif"', codePoint: 'U+2011', replacements: 3, parts: ['word/document.xml'] });
    const runs = Array.from(doc.getElementsByTagNameNS(W, 'r'));
    expect(runs.slice(-2).map(xml)).toEqual(before);
    expect(Array.from(doc.getElementsByTagNameNS(W, 't')).map(n => n.textContent).join('')).toBe(' A ‑ B‑ C‑D Unrelated ASCII-hyphen');
    const glyphs = runs.filter(run => run.getElementsByTagNameNS(W, 't')[0]?.textContent === '‑');
    expect(glyphs).toHaveLength(3);
    for (const run of glyphs) {
      expect(run.getAttributeNS(W, 'rsidR')).toBe('1234');
      expect(run.getElementsByTagNameNS(W, 'b')).toHaveLength(1);
      expect(run.getElementsByTagNameNS(W, 'lang')[0].getAttributeNS(W, 'val')).toBe('en-US');
      const fonts = run.getElementsByTagNameNS(W, 'rFonts')[0];
      expect(fonts.getAttributeNS(W, 'ascii')).toBe('Example & "Serif"');
      expect(fonts.hasAttributeNS(W, 'asciiTheme')).toBe(false);
    }
    expect(doc.getElementsByTagNameNS(W, 'bookmarkStart')[0].getAttributeNS(W, 'id')).toBe('9');
    expect(doc.getElementsByTagNameNS(W, 'bookmarkEnd')[0].getAttributeNS(W, 'id')).toBe('9');
    expect(doc.getElementsByTagNameNS(W, 'commentReference')).toHaveLength(1);
    expect(xml(doc)).toContain('&amp;');
    expect(xml(doc)).toContain('&quot;');
  });

  it.each(['', ' ', ' Leading', 'Trailing ', 'Bad\nFont', 'Bad\u0000Font', 'Bad\u0085Font'])('rejects invalid font %j before mutation', font => {
    const doc = parse('<w:p><w:r><w:noBreakHyphen/></w:r></w:p>'), before = xml(doc);
    expect(() => applyNonbreakingHyphenFont(doc, font)).toThrow(/font must/);
    expect(xml(doc)).toBe(before);
  });

  it.each([
    '<mc:AlternateContent><mc:Choice><w:p><w:r><w:noBreakHyphen/></w:r></w:p></mc:Choice></mc:AlternateContent>',
    '<w:txbxContent><w:p><w:r><w:t>A‑B</w:t></w:r></w:p></w:txbxContent>',
    '<w:p><w:ins><w:r><w:noBreakHyphen/></w:r></w:ins></w:p>',
    '<w:p><w:del><w:r><w:delText>A‑B</w:delText></w:r></w:del></w:p>',
    '<w:p><w:r><w:rPr><w:rPrChange/></w:rPr><w:noBreakHyphen/></w:r></w:p>',
    '<w:p><w:noBreakHyphen/></w:p>',
  ])('fails unsupported glyph contexts atomically', content => {
    const doc = parse(`<w:p><w:r><w:noBreakHyphen/></w:r></w:p>${content}`), before = xml(doc);
    expect(() => applyNonbreakingHyphenFont(doc, 'Verified Serif')).toThrow(/unsupported/);
    expect(xml(doc)).toBe(before);
  });
});
