import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { compileSelectionContract, fillSelectionContract } from './selection-contract.js';
import { fillTemplate } from './engine.js';

const root = resolve('templates/common-paper-cc-by-4.0');
const evidence = resolve('.cache/common-paper-declarative/expansion');
const parts = (file: string) => Object.fromEntries(new AdmZip(readFileSync(file)).getEntries()
  .filter(e => !e.isDirectory).map(e => [e.entryName, e.getData().toString('base64')]));

async function compare(id: string, variant: string, overrides: Record<string, string>, blanks = false) {
  const dir = join(root, id);
  const contract = await compileSelectionContract(dir);
  const values: Record<string, string> = blanks ? {} : Object.fromEntries(contract.metadata.fields.map(f => [f.name,
    f.default ?? (f.type === 'date' ? '2026-09-12' : f.type === 'enum' ? f.options![0] : `Synthetic ${f.name}`),
  ]));
  Object.assign(values, overrides);
  const out = join(evidence, id);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'fill-contract.json'), JSON.stringify(contract, null, 2));
  const next = join(out, `${variant}.docx`);
  const previous = join(out, `${variant}-legacy.docx`);
  const result = await fillSelectionContract(dir, contract, values, next);
  const legacy = await fillTemplate({ templateDir: dir, values, outputPath: previous });
  expect(parts(next)).toEqual(parts(previous));
  expect(result.fieldsUsed).toEqual(legacy.fieldsUsed);
  expect(result.fillCommandCount).toBeGreaterThan(0);
  expect(result.warnings.filter(w => !w.includes('ignored for individual'))).toEqual(legacy.warnings);
  const xml = new AdmZip(next).readAsText('word/document.xml');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  // Word can split punctuation across runs. Assert visible text, not contiguous XML.
  const text = Array.from(doc.getElementsByTagName('w:p')).map(p =>
    Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent).join('')).join('\n');
  return { contract, xml, text };
}

describe('additional source-generated Common Paper contracts', () => {
  for (const term of ['1 year(s)', 'until terminated']) {
    for (const confidentiality of ['1 year(s)', 'In perpetuity']) {
      for (const type of ['entity', 'individual']) {
        const variant = `${term === 'until terminated' ? 'terminated' : 'fixed'}-${confidentiality === 'In perpetuity' ? 'perpetual' : 'fixed'}-${type}`;
        it(`one-way NDA ${variant}`, async () => {
          const { contract, text } = await compare('common-paper-one-way-nda', variant, {
            nda_term: term, confidentiality_term: confidentiality, recipient_signatory_type: type,
          });
          expect(contract.metadata.fields).toHaveLength(14);
          expect(contract.bindings).toHaveLength(13);
          expect(text.includes('Continues until terminated')).toBe(term === 'until terminated');
          expect(text.includes('In perpetuity.')).toBe(confidentiality === 'In perpetuity');
          expect(text.includes('Synthetic recipient_signatory_company')).toBe(type === 'entity');
        });
      }
    }
  }
  for (const first of ['entity', 'individual']) {
    for (const second of ['entity', 'individual']) {
      it(`amendment ${first}/${second}`, async () => {
        const { contract, xml } = await compare('common-paper-amendment', `${first}-${second}`, {
          party_1_signatory_type: first, party_2_signatory_type: second,
        });
        expect(contract.metadata.fields).toHaveLength(17);
        expect(contract.selections.groups).toHaveLength(0);
        expect(xml.includes('Synthetic party_1_signatory_title')).toBe(first === 'entity');
        expect(xml.includes('Synthetic party_2_signatory_title')).toBe(second === 'entity');
      });
    }
  }
  it('CSA click-through: all scalar fields, repeated bindings, XML escaping', async () => {
    const { contract, xml } = await compare('common-paper-csa-click-through', 'complete', {
      provider_name: 'Example & Co <Synthetic>', cloud_service: 'Synthetic service',
    });
    expect(contract.metadata.fields).toHaveLength(14);
    expect(contract.bindings).toHaveLength(14);
    expect(xml).toContain('Example &amp; Co &lt;Synthetic&gt;');
  });
  for (const id of ['common-paper-one-way-nda', 'common-paper-amendment', 'common-paper-csa-click-through']) {
    it(`${id}: missing-input/default parity`, async () => {
      await compare(id, 'blank-defaults', {}, true);
    });
  }
  it('still blocks unsupported preprocessing rather than counting it as converted', async () => {
    await expect(compileSelectionContract(join(root, 'common-paper-design-partner-agreement')))
      .rejects.toThrow('Unsupported source artifact/stage');
  });
});
