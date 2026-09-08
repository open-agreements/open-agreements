import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeDetachedHeadingPunctuation } from './heading-punctuation-normalizer.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Filling & Rendering');

function fixture(body: string, styles?: string): { dir: string; input: string; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'heading-punctuation-'));
  const input = join(dir, 'input.docx');
  const output = join(dir, 'output.docx');
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`,
  ));
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  if (styles) zip.addFile('word/styles.xml', Buffer.from(`<w:styles xmlns:w="${W_NS}">${styles}</w:styles>`));
  zip.writeZip(input);
  return { dir, input, output };
}

describe('detached heading punctuation normalization', () => {
  const heading = '<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:rPr><w:vanish/><w:specVanish/></w:rPr></w:pPr><w:bookmarkStart w:id="42" w:name="Target"/><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>Parent</w:t></w:r></w:p>';
  const carrier = (properties = '') => `<w:p><w:pPr><w:pStyle w:val="HeadingPara2"/>${properties}</w:pPr><w:r><w:t>.</w:t></w:r><w:bookmarkEnd w:id="42"/><w:r><w:commentReference w:id="7"/></w:r></w:p>`;
  const next = '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>Child</w:t></w:r></w:p>';

  it('preserves the visible boundary before a numbered child and all semantic children in order', () => {
    const f = fixture(heading + carrier() + next);
    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(1);
    const xml = new AdmZip(f.output).readAsText('word/document.xml');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const ps = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
    expect(ps).toHaveLength(2);
    for (const name of ['vanish', 'specVanish']) expect(ps[0].getElementsByTagNameNS(W_NS, name)[0].getAttributeNS(W_NS, 'val')).toBe('0');
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('<w:t>.</w:t></w:r><w:bookmarkEnd w:id="42"/><w:r><w:commentReference w:id="7"/></w:r>');
    expect(ps[1].getElementsByTagNameNS(W_NS, 't')[0].textContent).toBe('Child');
    expect(ps[1].getElementsByTagNameNS(W_NS, 'rPr')).toHaveLength(0);
    rmSync(f.dir, { recursive: true, force: true });
  });

  it('does not let an adjacent hidden heading become a continuation of the previous heading', () => {
    const second = heading.replace('Parent', 'Second').replace('w:id="42"', 'w:id="43"');
    const f = fixture(heading + carrier() + second + '<w:p><w:pPr><w:pStyle w:val="HeadingPara2"/></w:pPr><w:r><w:t>. Body</w:t></w:r></w:p>');
    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(1);
    const doc = new DOMParser().parseFromString(new AdmZip(f.output).readAsText('word/document.xml'), 'text/xml');
    const ps = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
    expect(ps).toHaveLength(3);
    expect(ps[0].getElementsByTagNameNS(W_NS, 'specVanish')[0].getAttributeNS(W_NS, 'val')).toBe('0');
    expect(ps[1].getElementsByTagNameNS(W_NS, 'specVanish')[0].hasAttributeNS(W_NS, 'val')).toBe(false);
    rmSync(f.dir, { recursive: true, force: true });
  });

  const style = (id: string, body: string) => `<w:style w:type="paragraph" w:styleId="${id}">${body}</w:style>`;
  for (const [name, properties, styles, expected] of [
    ['direct hidden carrier', '<w:rPr><w:vanish/></w:rPr>', undefined, 0],
    ['character-style carrier mark', '<w:rPr><w:rStyle w:val="HiddenCharacter"/></w:rPr>', style('HiddenCharacter', '<w:rPr><w:vanish/></w:rPr>') + style('HeadingPara2', ''), 0],
    ['inherited hidden carrier', '', style('HeadingPara2', '<w:basedOn w:val="Base"/>') + style('Base', '<w:rPr><w:specVanish/></w:rPr>'), 0],
    ['style false does not cancel base hidden toggle', '', style('HeadingPara2', '<w:basedOn w:val="Base"/><w:rPr><w:vanish w:val="0"/></w:rPr>') + style('Base', '<w:rPr><w:vanish/></w:rPr>'), 0],
    ['inherited toggles are conservatively left untouched', '', style('HeadingPara2', '<w:basedOn w:val="Base"/><w:rPr><w:vanish/></w:rPr>') + style('Base', '<w:rPr><w:vanish/></w:rPr>'), 0],
    ['hidden document defaults', '', '<w:docDefaults><w:rPrDefault><w:rPr><w:vanish/></w:rPr></w:rPrDefault></w:docDefaults>' + style('HeadingPara2', ''), 0],
    ['direct false overrides inherited flags', '<w:rPr><w:vanish w:val="0"/><w:specVanish w:val="false"/></w:rPr>', style('HeadingPara2', '<w:rPr><w:vanish/><w:specVanish/></w:rPr>'), 1],
    ['cyclic style inheritance', '', style('HeadingPara2', '<w:basedOn w:val="HeadingPara2"/>'), 0],
    ['missing style definition', '', style('Other', ''), 0],
    ['inherited page break', '', style('HeadingPara2', '<w:pPr><w:pageBreakBefore/></w:pPr>'), 0],
    ['inherited frame', '', style('HeadingPara2', '<w:pPr><w:framePr/></w:pPr>'), 0],
  ] as const) it(`handles ${name} conservatively`, () => {
    const f = fixture(heading + carrier(properties) + next, styles);
    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(expected);
    rmSync(f.dir, { recursive: true, force: true });
  });

  it('explicitly overrides inherited hidden heading marks without changing heading run formatting', () => {
    const f = fixture(heading.replace('<w:rPr><w:vanish/><w:specVanish/></w:rPr>', '') + carrier() + next,
      style('Heading2', '<w:rPr><w:vanish/><w:specVanish/></w:rPr>') + style('HeadingPara2', ''));
    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(1);
    const xml = new AdmZip(f.output).readAsText('word/document.xml');
    expect(xml).toContain('<w:vanish w:val="0"/><w:specVanish w:val="0"/>');
    expect(xml).toContain('<w:rPr><w:u w:val="single"/></w:rPr><w:t>Parent</w:t>');
    rmSync(f.dir, { recursive: true, force: true });
  });

  for (const value of ['0', '1']) it(`preserves terminal keepNext=${value}, widowControl and mark formatting in order`, () => {
    const configuredHeading = heading.replace('<w:rPr><w:vanish/>', '<w:keepNext w:val="1"/><w:numPr><w:numId w:val="7"/></w:numPr><w:rPr><w:lang w:val="en-US"/><w:vanish/>');
    const f = fixture(configuredHeading + carrier(`<w:keepNext w:val="${value}"/><w:widowControl w:val="0"/><w:rPr><w:szCs w:val="22"/><w:lang w:val="fr-FR"/></w:rPr>`) + next);
    expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(1);
    const doc = new DOMParser().parseFromString(new AdmZip(f.output).readAsText('word/document.xml'), 'text/xml');
    const pPr = doc.getElementsByTagNameNS(W_NS, 'pPr')[0];
    expect(Array.from(pPr.childNodes).filter(node => node.nodeType === 1).map(node => node.localName)).toEqual(['pStyle', 'keepNext', 'widowControl', 'numPr', 'rPr']);
    expect(pPr.getElementsByTagNameNS(W_NS, 'keepNext')[0].getAttributeNS(W_NS, 'val')).toBe(value);
    expect(pPr.getElementsByTagNameNS(W_NS, 'numId')[0].getAttributeNS(W_NS, 'val')).toBe('7');
    const mark = pPr.getElementsByTagNameNS(W_NS, 'rPr')[0];
    expect(mark.getElementsByTagNameNS(W_NS, 'lang')).toHaveLength(1);
    expect(mark.getElementsByTagNameNS(W_NS, 'lang')[0].getAttributeNS(W_NS, 'val')).toBe('fr-FR');
    expect(Array.from(mark.childNodes).filter(node => node.nodeType === 1).map(node => node.localName)).toEqual(['vanish', 'specVanish', 'szCs', 'lang']);
    expect(mark.getElementsByTagNameNS(W_NS, 'szCs')[0].getAttributeNS(W_NS, 'val')).toBe('22');
    rmSync(f.dir, { recursive: true, force: true });
  });

  for (const property of ['sectPr', 'framePr', 'pageBreakBefore', 'pPrChange', 'numPr', 'spacing']) {
    it(`preserves a carrier with unsupported ${property} properties`, () => {
      const f = fixture(heading + carrier(`<w:${property}/>`)+ next);
      expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(0);
      expect(new AdmZip(f.output).readAsText('word/document.xml')).toContain(`<w:${property}/>`);
      rmSync(f.dir, { recursive: true, force: true });
    });
  }

  for (const revision of ['del', 'ins', 'moveFrom', 'moveTo']) {
    for (const target of ['heading', 'carrier']) it(`preserves ${target} paragraph-mark ${revision} revisions`, () => {
      const marker = `<w:${revision} w:id="99" w:author="Synthetic Reviewer"/>`;
      const f = fixture((target === 'heading' ? heading.replace('<w:vanish/>', marker + '<w:vanish/>') : heading) +
        carrier(target === 'carrier' ? `<w:rPr>${marker}</w:rPr>` : '') + next);
      expect(normalizeDetachedHeadingPunctuation(f.input, f.output)).toBe(0);
      expect(new AdmZip(f.output).readAsText('word/document.xml')).toContain(marker);
      rmSync(f.dir, { recursive: true, force: true });
    });
  }

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
