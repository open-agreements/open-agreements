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

async function compare(id: string, variant: string, overrides: Record<string, string | boolean>, blanks = false) {
  const dir = join(root, id);
  const contract = await compileSelectionContract(dir);
  const values: Record<string, string | boolean> = blanks ? {} : Object.fromEntries(contract.metadata.fields.map(f => [f.name,
    f.default ?? (f.type === 'boolean' ? false : f.type === 'date' ? '2026-09-12' : f.type === 'enum' ? f.options![0] : `Synthetic ${f.name}`),
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
  for (const selected of ['partner_feedback_sessions', 'partner_case_study', 'partner_private_list', 'partner_public_list', 'partner_reference', 'has_partner_other_details', 'provider_discount', 'provider_develop_functionality', 'has_provider_other_details']) {
    it(`Design Partner independent checkbox ${selected}`, async () => {
      const {contract, text} = await compare('common-paper-design-partner-agreement', selected, {[selected]: true});
      expect(contract.replacements).toEqual({'[ # ]': '{free_text}', '[$__________]': '{discount_amount}'});
      expect(contract.sourceHashes['replacements.json']).toHaveLength(64);
      for (const option of contract.selections.groups.find(g => g.type === 'checkbox')!.options) {
        const marker = option.marker.replace(/\{([a-z_]+)\}/g, (_, name: string) => `Synthetic ${name}`);
        expect(text.includes(marker), marker).toBe(option.trigger !== 'default' && option.trigger.field === selected);
      }
    });
  }
  for (const hasFees of [true, false]) {
    for (const type of ['entity', 'individual']) {
      it(`Design Partner fees=${hasFees} signer=${type}`, async () => {
        const {text} = await compare('common-paper-design-partner-agreement', `fees-${hasFees}-${type}`, {
          has_fees: hasFees, provider_signatory_type: type, partner_signatory_type: type,
        });
        expect(text.includes('There are no Fees under this Agreement')).toBe(!hasFees);
        expect(text.includes('Synthetic provider_signatory_title')).toBe(type === 'entity');
      });
    }
  }
  for (const [id, prefixes, fieldCount] of [
    ['common-paper-letter-of-intent', ['provider_signatory', 'customer_signatory'], 15],
    ['common-paper-term-sheet', ['party_1_signatory', 'party_2_signatory'], 12],
  ] as const) {
    for (const first of ['entity', 'individual']) {
      for (const second of ['entity', 'individual']) {
        it(`${id}: ${first}/${second}`, async () => {
          const { contract, text } = await compare(id, `${first}-${second}`, {
            [`${prefixes[0]}_type`]: first, [`${prefixes[1]}_type`]: second,
          });
          expect(contract.metadata.fields).toHaveLength(fieldCount);
          expect(contract.rules).toHaveLength(12);
          expect(text.includes(`Synthetic ${prefixes[0]}_title`)).toBe(first === 'entity');
          expect(text.includes(`Synthetic ${prefixes[1]}_title`)).toBe(second === 'entity');
          expect(text).toContain(`Synthetic ${prefixes[0]}_name`);
          expect(text).toContain(`Synthetic ${prefixes[1]}_name`);
        });
      }
    }
    it(`${id}: default/blank signatures`, async () => {
      await compare(id, 'blank-defaults', {}, true);
    });
  }
});
