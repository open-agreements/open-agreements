import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { resolveNumberingSnapshots } from './numbering-counters.js';

const it = itAllure.epic('Filling & Rendering');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');
const level = (index: number, extra = '', start: number | null = 1) => `<w:lvl w:ilvl="${index}">${start === null ? '' : `<w:start w:val="${start}"/>`}<w:numFmt w:val="${['decimal', 'lowerLetter', 'lowerRoman'][index] ?? 'decimal'}"/>${extra}<w:lvlText w:val="${Array.from({ length: index + 1 }, (_, i) => `%${i + 1}`).join('.')}"/></w:lvl>`;
const paragraph = (ilvl: number, numId = '1', text = '') => `<w:p><w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const document = (ps: string) => parse(`<w:document xmlns:w="${W}"><w:body>${ps}</w:body></w:document>`);
const numbering = (levels = level(0) + level(1) + level(2), overrides = '', extra = '') => parse(`<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0">${levels}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/>${overrides}</w:num>${extra}</w:numbering>`);
const sequence = (indices: number[], levels?: string, overrides?: string) => resolveNumberingSnapshots(document(indices.map(i => paragraph(i)).join('')), undefined, numbering(levels, overrides));
const tuples = (indices: number[], levels?: string, overrides?: string) => sequence(indices, levels, overrides).map(s => s.counters.slice(0, 3));

describe('render-copy numbering counter resolution', () => {
  it('resolves the complete decimal/letter/roman hierarchy and resets descendants', () => {
    expect(tuples([0, 1, 2, 2, 1, 2, 0, 1, 2])).toEqual([
      [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 2], [1, 2, 1], [1, 2, 1], [2, 1, 1], [2, 1, 1], [2, 1, 1],
    ]);
    const result = sequence([0, 1, 2]);
    expect(Array.from(result[2].effectiveAbstract.getElementsByTagNameNS(W, 'numFmt')).map(n => n.getAttributeNS(W, 'val'))).toEqual(['decimal', 'lowerLetter', 'lowerRoman']);
    expect(result[2].counters).toHaveLength(9);
  });

  it('honors never-restart even across all higher levels', () => {
    expect(tuples([0, 1, 2, 2, 0, 1, 2], level(0) + level(1) + level(2, '<w:lvlRestart w:val="0"/>'))).toEqual([
      [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 2], [2, 1, 2], [2, 1, 2], [2, 1, 3],
    ]);
  });

  it('uses a custom one-based ancestor restart instead of the immediate parent', () => {
    expect(tuples([0, 1, 2, 1, 2, 0, 2], level(0) + level(1) + level(2, '<w:lvlRestart w:val="1"/>'))).toEqual([
      [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 2, 1], [1, 2, 2], [2, 1, 1], [2, 1, 1],
    ]);
  });

  it('ignores a restart reference to a non-ancestor as specified by OOXML', () => {
    expect(tuples([0, 1, 1, 0, 1], level(0) + level(1, '<w:lvlRestart w:val="9"/>'))).toEqual([
      [1, 1, 0], [1, 1, 0], [1, 2, 0], [2, 1, 0], [2, 1, 0],
    ]);
  });

  it('uses zero for omitted starts and does not consume unseen ancestor starts', () => {
    expect(tuples([2, 2, 0, 1, 2], level(0, '', 5) + level(1, '', null) + level(2, '', null))).toEqual([
      [5, 0, 0], [5, 0, 1], [5, 0, 0], [5, 0, 0], [5, 0, 0],
    ]);
  });

  it('folds level replacements and startOverride, including every subsequent restart', () => {
    const override = `<w:lvlOverride w:ilvl="1"><w:startOverride w:val="4"/>${level(1, '<w:lvlRestart w:val="1"/>', 8)}</w:lvlOverride>`;
    expect(tuples([0, 1, 1, 0, 1], undefined, override)).toEqual([
      [1, 4, 1], [1, 4, 1], [1, 5, 1], [2, 4, 1], [2, 4, 1],
    ]);
    const effective = sequence([1], undefined, override)[0].effectiveAbstract;
    expect(effective.getElementsByTagNameNS(W, 'lvl')[1].getElementsByTagNameNS(W, 'start')[0].getAttributeNS(W, 'val')).toBe('4');
  });

  it('resolves start-only overrides and full overrides adding a previously undefined level', () => {
    expect(tuples([0, 0], level(0), '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="7"/></w:lvlOverride>')).toEqual([[7, 0, 0], [8, 0, 0]]);
    expect(tuples([0, 1], level(0), `<w:lvlOverride w:ilvl="1">${level(1)}</w:lvlOverride>`)).toEqual([[1, 1, 0], [1, 1, 0]]);
  });

  it('keeps interleaved instances independent even when they share an abstract definition', () => {
    const doc = document(paragraph(0) + paragraph(0, '2') + paragraph(0) + paragraph(0, '0') + paragraph(0, '2'));
    const num = numbering(level(0), '', '<w:num w:numId="2"><w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="8"/></w:lvlOverride></w:num>');
    expect(resolveNumberingSnapshots(doc, undefined, num).map(s => [s.numId, s.counters[0]])).toEqual([['1', 1], ['2', 8], ['1', 2], ['2', 9]]);
  });

  it('merges partial numbering through basedOn, defaults and direct paragraph properties', () => {
    const styles = parse(`<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:default="1" w:styleId="Base"><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Child"><w:basedOn w:val="Base"/><w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr></w:pPr></w:style></w:styles>`);
    const doc = document('<w:p/>' + '<w:p><w:pPr><w:pStyle w:val="Child"/></w:pPr></w:p>' + '<w:p><w:pPr><w:pStyle w:val="Child"/><w:numPr><w:ilvl w:val="2"/></w:numPr></w:pPr></w:p>' + '<w:p><w:pPr><w:pStyle w:val="Child"/><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr></w:p>');
    expect(resolveNumberingSnapshots(doc, styles, numbering()).map(s => s.ilvl)).toEqual([0, 1, 2]);
  });

  it('includes numbered body paragraphs and table cells, and ignores separator run formatting', () => {
    const doc = document(paragraph(0) + paragraph(1).replace('</w:pPr>', '<w:rPr><w:vanish/><w:specVanish/></w:rPr></w:pPr>') + '<w:tbl><w:tr><w:tc>' + paragraph(2) + '</w:tc></w:tr></w:tbl>' + paragraph(1));
    expect(resolveNumberingSnapshots(doc, undefined, numbering()).map(s => s.counters.slice(0, 3))).toEqual([[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 2, 1]]);
  });

  it('does not mutate inputs or share mutable effective definitions between snapshots', () => {
    const doc = document(paragraph(0) + paragraph(1));
    const num = numbering();
    const serializer = new XMLSerializer();
    const before = [serializer.serializeToString(doc), serializer.serializeToString(num)];
    const result = resolveNumberingSnapshots(doc, undefined, num);
    result[0].effectiveAbstract.setAttribute('probe', 'changed');
    expect(result[1].effectiveAbstract.hasAttribute('probe')).toBe(false);
    expect([serializer.serializeToString(doc), serializer.serializeToString(num)]).toEqual(before);
    expect(result[0].paragraph).toBe(doc.getElementsByTagNameNS(W, 'p')[0]);
  });

  for (const [name, levels, override, index] of [
    ['invalid abstract level', level(9), '', 0],
    ['duplicate level', level(0) + level(0), '', 0],
    ['invalid start', level(0, '', -1), '', 0],
    ['invalid restart', level(0) + level(1, '<w:lvlRestart w:val="-1"/>'), '', 0],
    ['undefined used level', level(0), '', 1],
    ['undefined referenced ancestor', level(1), '', 1],
    ['numbering style link', '<w:numStyleLink w:val="ListStyle"/>' + level(0), '', 0],
    ['override level mismatch', level(0), `<w:lvlOverride w:ilvl="0">${level(1)}</w:lvlOverride>`, 0],
    ['duplicate override', level(0), '<w:lvlOverride w:ilvl="0"/><w:lvlOverride w:ilvl="0"/>', 0],
    ['undefined overridden level', level(0), '<w:lvlOverride w:ilvl="1"><w:startOverride w:val="2"/></w:lvlOverride>', 0],
  ] as const) {
    it(`fails closed for ${name}`, () => {
      expect(() => sequence([index], levels, override)).toThrow(/numbering counters:/);
    });
  }

  it('rejects unresolved numbering and malformed paragraph levels', () => {
    expect(() => resolveNumberingSnapshots(document(paragraph(0, '99')), undefined, numbering())).toThrow(/unresolved numbering/);
    expect(() => resolveNumberingSnapshots(document(paragraph(9)), undefined, numbering())).toThrow(/paragraph level/);
  });

  it('rejects used cyclic or missing paragraph styles rather than dropping numbering', () => {
    const styles = parse(`<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Cycle"><w:basedOn w:val="Cycle"/></w:style></w:styles>`);
    const styled = (id: string) => document(`<w:p><w:pPr><w:pStyle w:val="${id}"/></w:pPr></w:p>`);
    expect(() => resolveNumberingSnapshots(styled('Cycle'), styles, numbering())).toThrow(/style cycle/);
    expect(() => resolveNumberingSnapshots(styled('Missing'), styles, numbering())).toThrow(/unresolved paragraph style/);
  });
});
