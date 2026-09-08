import {DOMParser, XMLSerializer, type Element} from '@xmldom/xmldom';
import {describe, expect} from 'vitest';
import {itAllure} from '../../../integration-tests/helpers/allure-test.js';
import type {NumberingSnapshot} from './numbering-counters.js';
import {materializeNumberingReferences} from './numbering-render-references.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Filling & Rendering');
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml');
const complex = (code: string, cached = 'WRONG') => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>${code}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${cached}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
function fixture(code = ' REF Target \\w \\h \\* MERGEFORMAT ', context?: number[], patterns = ['%1.', '%2.', '%3.'], formats = ['decimal', 'decimal', 'decimal']) {
  const document = parse(`<w:document xmlns:w="${W}"><w:body><w:p><w:bookmarkStart w:id="1" w:name="Target"/><w:r><w:t>Target heading</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p><w:p>${complex(code)}</w:p></w:body></w:document>`);
  const abstract = parse(`<w:abstractNum xmlns:w="${W}" w:abstractNumId="1">${patterns.map((pattern, index) => `<w:lvl w:ilvl="${index}"><w:numFmt w:val="${formats[index]}"/><w:lvlText w:val="${pattern}"/></w:lvl>`).join('')}</w:abstractNum>`).documentElement!;
  const ps = Array.from(document.getElementsByTagNameNS(W, 'p'));
  const snapshot = (paragraph: Element, counters: number[]): NumberingSnapshot => ({paragraph, numId: '1', ilvl: 2, counters: [...counters, ...Array(6).fill(1)], effectiveAbstract: abstract});
  const snapshots = [snapshot(ps[0], [4, 5, 2]), ...(context ? [snapshot(ps[1], context)] : [])];
  return {document, snapshots, reference: ps[1], target: ps[0], abstract};
}
const text = (node: Element) => Array.from(node.getElementsByTagNameNS(W, 't')).map(n => n.textContent).join('');
const xml = (node: Parameters<XMLSerializer['serializeToString']>[0]) => new XMLSerializer().serializeToString(node);

describe('render-only numeric REF materialization', () => {
  it.each([
    ['w', [4, 3, 1], '4.5.2'],
    ['r', [4, 3, 1], '5.2'],
    ['n', [4, 3, 1], '2'],
    ['r', undefined, '2'],
    ['r', [4, 5, 2], '2'],
  ] as const)('Microsoft switch %s with context %j yields %s', (mode, context, expected) => {
    const f = fixture(`REF Target \\${mode}`, context ? [...context] : undefined);
    expect(materializeNumberingReferences(f.document, f.snapshots)).toBe(1);
    expect(text(f.reference)).toBe(expected);
    expect(f.document.getElementsByTagNameNS(W, 'fldChar')).toHaveLength(0);
    expect(f.document.getElementsByTagNameNS(W, 'instrText')).toHaveLength(0);
    expect(f.document.getElementsByTagNameNS(W, 'bookmarkStart')).toHaveLength(1);
    expect(f.reference.getElementsByTagNameNS(W, 'b')).toHaveLength(1);
  });

  it.each([['w', undefined, '4.5(b)'], ['n', undefined, '(b)'], ['r', [4, 5, 2], '(b)'], ['r', [4, 3, 1], '4.5(b)']] as const)('preserves punctuation for %s', (mode, context, expected) => {
    const f = fixture(`REF Target \\${mode}`, context ? [...context] : undefined, ['%1.', '%1.%2', '(%3)'], ['decimal', 'decimal', 'lowerLetter']);
    expect(materializeNumberingReferences(f.document, f.snapshots)).toBe(1);
    expect(text(f.reference)).toBe(expected);
  });

  it('does not strip embedded ancestors from a composite relative target label', () => {
    const f = fixture('REF Target \\r', [4, 5, 2], ['%1.', '%1.%2', '%1.%2.%3']);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('4.5.2');
  });

  it.each([['\\n', 'Exhibit B'], ['\\n \\t', 'B']])('preserves or suppresses literal text only for %s', (switches, expected) => {
    const f = fixture(`REF Target ${switches}`, undefined, ['%1.', '%2.', 'Exhibit %3'], ['decimal', 'decimal', 'upperLetter']);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe(expected);
  });

  it('preserves the pinned-style fixed alphanumeric current-level prefix', () => {
    const f = fixture('REF Target \\n', undefined, ['%1.', '%2.', '5A.%3.']);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('5A.2');
  });

  it('keeps ancestor placeholders explicitly included in the current level for n', () => {
    const f = fixture('REF Target \\n', undefined, ['%1.', '%1.%2', '%1.%2.%3']);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('4.5.2');
  });

  it.each([['\\w \\n', '2'], ['\\n \\w', '2'], ['\\r \\w', '5.2'], ['\\w \\r', '5.2'], ['\\n \\r', '5.2'], ['\\r \\n', '5.2'], ['\\w \\t', '4.5.2']])('matches native LibreOffice precedence for %s', (switches, expected) => {
    const f = fixture(`REF Target ${switches}`, [4, 6, 3]);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe(expected);
  });

  it.each([['before', '4.5.2'], ['level0', '5.2'], ['level1', '5.2'], ['other-instance', '4.5.2']])('matches native LibreOffice unnumbered context %s', (kind, expected) => {
    const f = fixture('REF Target \\r');
    if (kind === 'before') f.target.parentNode!.insertBefore(f.reference, f.target);
    else {
      const context = f.document.createElementNS(W, 'w:p');
      f.reference.parentNode!.insertBefore(context, f.reference);
      f.snapshots.push({...f.snapshots[0], paragraph: context, ilvl: kind === 'level0' ? 0 : 1, counters: [4, 6, 2, 1, 1, 1, 1, 1, 1], numId: kind === 'other-instance' ? '2' : '1'});
    }
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe(expected);
  });

  it('does not suppress coincidental prefixes from another numbering instance', () => {
    const f = fixture('REF Target \\r', [4, 5, 2]); f.snapshots[1].numId = '2';
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('4.5.2');
  });

  it('handles Roman and uppercase letters, without trusting cached labels', () => {
    const f = fixture('REF Target \\w', undefined, ['%1.', '%2.', '(%3)'], ['upperRoman', 'upperLetter', 'lowerRoman']);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('IV.E.(ii)');
  });

  it.each(['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'].map((word, index) => [index + 1, word] as const))('matches native English ordinal %i', (value, expected) => {
    const f = fixture('REF Target \\n', undefined, ['%1.', '%2.', '%3.'], ['decimal', 'decimal', 'ordinalText']);
    f.snapshots[0].counters[2] = value;
    const styles = parse(`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
    materializeNumberingReferences(f.document, f.snapshots, styles);
    expect(text(f.reference)).toBe(expected);
  });

  it.each(['unknown', 'French default', 'French level', 'French inherited style', 'range'])('rejects ordinal language/range %s', kind => {
    const f = fixture('REF Target \\n', undefined, ['%1.', '%2.', '%3.'], ['decimal', 'decimal', 'ordinalText']);
    const styles = parse(`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="${kind === 'French default' ? 'fr-FR' : 'en-US'}"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:basedOn w:val="Base"/></w:style><w:style w:styleId="Base"><w:rPr>${kind === 'French inherited style' ? '<w:lang w:val="fr-FR"/>' : ''}</w:rPr></w:style></w:styles>`);
    if (kind === 'French level') f.abstract.getElementsByTagNameNS(W, 'lvl')[2].appendChild(f.abstract.ownerDocument!.importNode(parse(`<w:rPr xmlns:w="${W}"><w:lang w:val="fr-FR"/></w:rPr>`).documentElement!, true));
    if (kind === 'range') f.snapshots[0].counters[2] = 21;
    expect(() => materializeNumberingReferences(f.document, f.snapshots, kind === 'unknown' ? undefined : styles)).toThrow(/ordinalText/);
  });

  it('handles split instruction/result runs and preserves styles and interior bookmarks', () => {
    const f = fixture();
    const instruction = f.reference.getElementsByTagNameNS(W, 'instrText')[0];
    instruction.textContent = ' REF Tar';
    const extraRun = parse(`<w:r xmlns:w="${W}"><w:instrText>get \\w\\h\\*MERGEFORMAT</w:instrText></w:r>`).documentElement!;
    f.reference.insertBefore(f.document.importNode(extraRun, true), instruction.parentNode!.nextSibling);
    const old = f.reference.getElementsByTagNameNS(W, 't')[0]; old.textContent = '0';
    const second = parse(`<w:r xmlns:w="${W}"><w:rPr><w:i/></w:rPr><w:t>.0</w:t></w:r>`).documentElement!;
    f.reference.insertBefore(f.document.importNode(second, true), old.parentNode!.nextSibling);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('4.5.2');
    expect(f.reference.getElementsByTagNameNS(W, 'b')).toHaveLength(1);
    expect(f.reference.getElementsByTagNameNS(W, 'i')).toHaveLength(1);
  });

  it('unwraps a simple numeric field while leaving text REF fields intact', () => {
    const f = fixture();
    while (f.reference.firstChild) f.reference.removeChild(f.reference.firstChild);
    const simple = parse(`<w:fldSimple xmlns:w="${W}" w:instr="REF Target \\w"><w:r><w:t>WRONG</w:t></w:r></w:fldSimple>`).documentElement!;
    f.reference.appendChild(f.document.importNode(simple, true));
    const ordinary = simple.cloneNode(true) as Element; ordinary.setAttributeNS(W, 'w:instr', 'REF Target \\h');
    f.reference.appendChild(f.document.importNode(ordinary, true));
    expect(materializeNumberingReferences(f.document, f.snapshots)).toBe(1);
    expect(text(f.reference)).toBe('4.5.2WRONG');
    expect(f.document.getElementsByTagNameNS(W, 'fldSimple')).toHaveLength(1);
  });

  for (const code of ['REF Target \\w \\p', 'REF Target \\w \\w', 'REF Missing \\w']) {
    it(`rejects ${code} before mutation`, () => {
      const f = fixture(code); const before = xml(f.document);
      expect(() => materializeNumberingReferences(f.document, f.snapshots)).toThrow(/render-copy REF:/);
      expect(xml(f.document)).toBe(before);
    });
  }

  it('preflights every field before materializing any result', () => {
    const f = fixture();
    const extra = parse(`<w:p xmlns:w="${W}">${complex('REF Missing \\w')}</w:p>`).documentElement!;
    f.reference.parentNode!.appendChild(f.document.importNode(extra, true));
    const before = xml(f.document);
    expect(() => materializeNumberingReferences(f.document, f.snapshots)).toThrow(/Missing/);
    expect(xml(f.document)).toBe(before);
  });

  it.each(['1', '01'])('rejects differently named starts sharing numeric ID %s before mutation', id => {
    const f = fixture();
    const extra = parse(`<w:bookmarkStart xmlns:w="${W}" w:id="${id}" w:name="OtherName"/>`).documentElement!;
    f.reference.appendChild(f.document.importNode(extra, true));
    const before = xml(f.document);
    expect(() => materializeNumberingReferences(f.document, f.snapshots)).toThrow(/duplicate numeric bookmark ID/);
    expect(xml(f.document)).toBe(before);
  });

  it.each(['nested', 'unclosed', 'missing separator', 'missing bookmark end', 'duplicate bookmark end', 'reversed bookmark', 'nested target paragraph', 'textbox field', 'unnumbered target', 'unsupported format'])('rejects %s', kind => {
    const f = fixture();
    if (kind === 'nested') f.reference.insertBefore(f.document.importNode(parse(`<w:r xmlns:w="${W}"><w:fldChar w:fldCharType="begin"/></w:r>`).documentElement!, true), f.reference.childNodes[1]);
    if (kind === 'unclosed') f.reference.removeChild(f.reference.lastChild!);
    if (kind === 'missing separator') f.reference.removeChild(f.reference.childNodes[2]);
    if (kind === 'missing bookmark end') f.target.removeChild(f.target.lastChild!);
    if (kind === 'duplicate bookmark end') f.target.appendChild(f.target.lastChild!.cloneNode(true));
    if (kind === 'reversed bookmark') f.target.insertBefore(f.target.lastChild!, f.target.firstChild);
    if (kind === 'nested target paragraph') f.target.insertBefore(f.document.importNode(parse(`<w:p xmlns:w="${W}"><w:r><w:t>nested</w:t></w:r></w:p>`).documentElement!, true), f.target.lastChild);
    if (kind === 'textbox field') { const box = f.document.createElementNS(W, 'w:txbxContent'); f.reference.parentNode!.appendChild(box); box.appendChild(f.reference); }
    if (kind === 'unnumbered target') f.snapshots.shift();
    if (kind === 'unsupported format') f.abstract.getElementsByTagNameNS(W, 'numFmt')[2].setAttributeNS(W, 'w:val', 'bullet');
    const before = xml(f.document);
    expect(() => materializeNumberingReferences(f.document, f.snapshots)).toThrow(/render-copy REF:/);
    expect(xml(f.document)).toBe(before);
  });

  it('uses the numbered bookmark start, not later numbered paragraphs in the range', () => {
    const f = fixture('REF Target \\w', [4, 6, 3]);
    f.reference.appendChild(f.target.lastChild!);
    materializeNumberingReferences(f.document, f.snapshots);
    expect(text(f.reference)).toBe('4.5.2');
  });

  it('resolves a heading bookmark extending into unnumbered body without inventing context', () => {
    const f = fixture('REF Target \\r');
    f.reference.appendChild(f.target.lastChild!);
    expect(materializeNumberingReferences(f.document, f.snapshots)).toBe(1);
    expect(text(f.reference)).toBe('2');
  });

  it('replaces parsed xml:space without duplicate namespace attributes', () => {
    const f = fixture();
    const old = f.reference.getElementsByTagNameNS(W, 't')[0];
    old.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'default');
    materializeNumberingReferences(f.document, f.snapshots);
    expect(xml(old).match(/xml:space=/g)).toHaveLength(1);
    expect(old.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space')).toBe('preserve');
    expect(() => parse(xml(f.document))).not.toThrow();
  });
});
