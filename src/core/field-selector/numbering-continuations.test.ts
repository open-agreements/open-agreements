import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DOMParser } from '@xmldom/xmldom';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { NumberingContinuationsSchema, NormalizeConfigSchema } from '../metadata.js';
import type { NumberingContinuations } from '../metadata.js';
import { validateNumberingContinuationSource } from './numbering-continuations.js';
import { normalizeNumberedHeadingSections } from './numbering-normalizer.js';

const it = itAllure.epic('Filling & Rendering');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'numbering-continuations-')); directories.push(root);
  const source = join(root, 'source.docx'), output = join(root, 'output.docx');
  const p = (name: string, level: number, id = '1') => `<w:p><w:pPr><w:pStyle w:val="L${level}"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${id}"/></w:numPr></w:pPr><w:r><w:t>${name}</w:t></w:r></w:p>`;
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}"><w:body>${p('First', 0)}${p('First child', 1)}${p('Second', 0)}${p('Before', 1)}${p('Continued', 1, '2')}${p('Child A', 2)}${p('Child B', 2)}${p('Independent restart', 1, '3')}${p('Independent child', 2, '3')}</w:body></w:document>`));
  zip.addFile('word/styles.xml', Buffer.from(`<w:styles xmlns:w="${W}">${[0, 1, 2].map(i => `<w:style w:type="paragraph" w:styleId="L${i}"><w:pPr><w:numPr><w:numId w:val="1"/><w:ilvl w:val="${i}"/></w:numPr><w:outlineLvl w:val="${i}"/></w:pPr></w:style>`).join('')}</w:styles>`));
  const num = (id: string, starts: number[]) => `<w:num w:numId="${id}"><w:abstractNumId w:val="0"/>${starts.map((start, i) => `<w:lvlOverride w:ilvl="${i}"><w:startOverride w:val="${start}"/></w:lvlOverride>`).join('')}</w:num>`;
  zip.addFile('word/numbering.xml', Buffer.from(`<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0">${[0, 1, 2].map(i => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/></w:lvl>`).join('')}</w:abstractNum>${num('1', [])}${num('2', [2, 2, 1])}${num('3', [9, 7, 1])}</w:numbering>`));
  zip.writeZip(source);
  const config: NumberingContinuations = { source_sha256: createHash('sha256').update(readFileSync(source)).digest('hex'), source_num_id: '1', headings: [{ anchor: 'Continued', num_id: '2', expected_abstract_num_id: '0', ilvl: 1, expected_starts: { 0: 2, 1: 2, 2: 1 } }] };
  return { root, source, output, config };
}
function edit(path: string, part: string, mutate: (xml: string) => string) {
  const zip = new AdmZip(path); zip.updateFile(part, Buffer.from(mutate(zip.readAsText(part)))); zip.writeZip(path);
}
function repin(f: ReturnType<typeof fixture>) { f.config.source_sha256 = createHash('sha256').update(readFileSync(f.source)).digest('hex'); }

describe('explicit source-pinned numbering continuations', () => {
  it('rebases only a declared heading into its child stream, retaining unrelated same-abstract restarts', () => {
    const f = fixture(), before = readFileSync(f.source);
    const plan = validateNumberingContinuationSource(f.source, f.config);
    expect(normalizeNumberedHeadingSections(f.source, f.output, plan)).toEqual({ sections: 2, paragraphs: 7 });
    const doc = new DOMParser().parseFromString(new AdmZip(f.output).readAsText('word/document.xml'), 'text/xml');
    const ids = Array.from(doc.getElementsByTagNameNS(W, 'numId')).map(n => n.getAttributeNS(W, 'val'));
    expect(ids).toEqual(['4', '4', '5', '5', '5', '5', '5', '3', '3']);
    expect(readFileSync(f.source)).toEqual(before);
    expect(new AdmZip(f.output).readAsText('word/numbering.xml')).toContain('<w:startOverride w:val="7"/>');
  });

  it('leaves legacy behavior unchanged without declarations', () => {
    const f = fixture(); normalizeNumberedHeadingSections(f.source, f.output);
    expect(new AdmZip(f.output).readAsText('word/document.xml')).toContain('<w:numId w:val="2"/>');
  });

  it('allows a selection to remove the validated heading and accepts bracket/period cleanup', () => {
    const f = fixture(), plan = validateNumberingContinuationSource(f.source, f.config);
    edit(f.source, 'word/document.xml', xml => xml.replace('Continued', '[Continued].'));
    expect(() => normalizeNumberedHeadingSections(f.source, f.output, plan)).not.toThrow();
    edit(f.source, 'word/document.xml', xml => xml.replace(/<w:p><w:pPr><w:pStyle w:val="L1"\/><w:numPr><w:ilvl w:val="1"\/><w:numId w:val="2"\/><\/w:numPr><\/w:pPr><w:r><w:t>\[Continued\]\.<\/w:t><\/w:r><\/w:p>/, ''));
    expect(normalizeNumberedHeadingSections(f.source, f.output, plan).paragraphs).toBe(6);
  });

  it('rejects changed source bytes even if the declaration itself still matches', () => {
    const f = fixture(); edit(f.source, 'word/document.xml', xml => xml.replace('First child', 'Different'));
    expect(() => validateNumberingContinuationSource(f.source, f.config)).toThrow(/SHA-256/);
  });

  it('does not let caller mutation or a fabricated plan bypass source validation', () => {
    const f = fixture(), plan = validateNumberingContinuationSource(f.source, f.config);
    f.config.headings[0].anchor = 'Wrong';
    expect(() => normalizeNumberedHeadingSections(f.source, f.output, plan)).not.toThrow();
    expect(() => normalizeNumberedHeadingSections(f.source, f.output, { sourceNumId: '1', sourceSha256: f.config.source_sha256 })).toThrow(/unvalidated/);
  });

  for (const [name, part, mutate] of [
    ['anchor drift', 'word/document.xml', (s: string) => s.replace('Continued', 'Different')],
    ['level drift', 'word/document.xml', (s: string) => s.replace('<w:ilvl w:val="1"/><w:numId w:val="2"/>', '<w:ilvl w:val="2"/><w:numId w:val="2"/>')],
    ['override drift', 'word/numbering.xml', (s: string) => s.replace('<w:startOverride w:val="2"/>', '<w:startOverride w:val="3"/>')],
    ['replacement level', 'word/numbering.xml', (s: string) => s.replace('<w:startOverride w:val="2"/>', '<w:startOverride w:val="2"/><w:lvl w:ilvl="0"/>')],
    ['unknown instance property', 'word/numbering.xml', (s: string) => s.replace('<w:num w:numId="2">', '<w:num w:numId="2"><w:unexpected/>')],
    ['different abstract', 'word/numbering.xml', (s: string) => s.replace('<w:num w:numId="2"><w:abstractNumId w:val="0"/>', '<w:num w:numId="2"><w:abstractNumId w:val="9"/>')],
  ] as const) {
    it(`rejects ${name} in the source and after transformation`, () => {
      const f = fixture(), plan = validateNumberingContinuationSource(f.source, f.config);
      edit(f.source, part, mutate); repin(f);
      expect(() => validateNumberingContinuationSource(f.source, f.config)).toThrow(/numbering continuations:/);
      expect(() => normalizeNumberedHeadingSections(f.source, f.output, plan)).toThrow(/numbering continuations:/);
    });
  }

  it('rejects duplicate anchors and instances, missing abstract ID and unknown keys at load time', () => {
    const f = fixture();
    expect(() => NumberingContinuationsSchema.parse({ ...f.config, headings: [...f.config.headings, f.config.headings[0]] })).toThrow();
    expect(() => NumberingContinuationsSchema.parse({ ...f.config, headings: [{ ...f.config.headings[0], expected_abstract_num_id: undefined }] })).toThrow();
    expect(() => NumberingContinuationsSchema.parse({ ...f.config, guess_same_abstract: true })).toThrow();
    expect(NormalizeConfigSchema.parse({ numbering_continuations: f.config }).numbering_continuations).toEqual(f.config);
  });

  function distinctAbstract(mutate: (xml: string) => string = x => x) {
    const f = fixture();
    edit(f.source, 'word/numbering.xml', xml => {
      const source = xml.match(/<w:abstractNum w:abstractNumId="0">[\s\S]*?<\/w:abstractNum>/)![0];
      const target = mutate(source.replace('abstractNumId="0"', 'abstractNumId="9"').replace('<w:start w:val="1"/>', '<w:start w:val="2"/>'));
      return xml.replace('</w:abstractNum>', `</w:abstractNum>${target}`).replace(/<w:num w:numId="2">[\s\S]*?<\/w:num>/, '<w:num w:numId="2"><w:abstractNumId w:val="9"/></w:num>');
    });
    f.config.headings[0].expected_abstract_num_id = '9';
    f.config.headings[0].expected_starts = {};
    repin(f);
    return f;
  }

  it('accepts explicit compatible different abstracts with no overrides and ignores unused-level differences', () => {
    const f = distinctAbstract(xml => xml.replace('<w:lvl w:ilvl="2">', '<w:lvl w:ilvl="2"><w:pPr><w:ind w:left="999"/></w:pPr>').replace('<w:lvl w:ilvl="1">', '<w:lvl w:ilvl="1"><w:pStyle w:val="L1"/>'));
    const plan = validateNumberingContinuationSource(f.source, f.config);
    expect(normalizeNumberedHeadingSections(f.source, f.output, plan)).toEqual({ sections: 2, paragraphs: 7 });
  });

  it('accepts only an otherwise empty explicit default font hint as an equivalent font declaration', () => {
    const f = distinctAbstract();
    edit(f.source, 'word/numbering.xml', xml => xml.replaceAll('<w:numFmt', '<w:rPr><w:rFonts w:hint="default"/></w:rPr><w:numFmt').replace('<w:abstractNum w:abstractNumId="9">', '<w:abstractNum w:abstractNumId="9">'));
    // Remove the hint only in the target; both sides retain equivalent rPr.
    edit(f.source, 'word/numbering.xml', xml => xml.replace(/(<w:abstractNum w:abstractNumId="9">)([\s\S]*?)(<\/w:abstractNum>)/, (_, a, b: string, c) => a + b.replaceAll('<w:rFonts w:hint="default"/>', '') + c));
    repin(f);
    expect(() => validateNumberingContinuationSource(f.source, f.config)).not.toThrow();
  });

  for (const [name, insertion] of [
    ['indent', '<w:pPr><w:ind w:left="99"/></w:pPr>'],
    ['font', '<w:rPr><w:rFonts w:ascii="Different"/></w:rPr>'],
    ['restart', '<w:lvlRestart w:val="0"/>'],
    ['suffix', '<w:suff w:val="space"/>'],
  ]) it(`rejects a different-abstract ${name} mismatch`, () => {
    const f = distinctAbstract(xml => xml.replace('<w:lvl w:ilvl="1">', `<w:lvl w:ilvl="1">${insertion}`));
    expect(() => validateNumberingContinuationSource(f.source, f.config)).toThrow(/incompatible/);
  });

  it('rejects different-abstract label formats even with matching anchors and starts', () => {
    const f = distinctAbstract(xml => xml.replace('w:val="decimal"', 'w:val="upperRoman"'));
    expect(() => validateNumberingContinuationSource(f.source, f.config)).toThrow(/incompatible/);
  });

  it('fingerprints unused levels and source defaults against post-validation drift', () => {
    const f = distinctAbstract(), plan = validateNumberingContinuationSource(f.source, f.config);
    edit(f.source, 'word/numbering.xml', xml => xml.replace('<w:start w:val="2"/>', '<w:start w:val="3"/>'));
    expect(() => normalizeNumberedHeadingSections(f.source, f.output, plan)).toThrow(/fingerprint drifted/);
  });
});
