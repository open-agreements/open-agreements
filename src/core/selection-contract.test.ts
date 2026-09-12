import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { compileSelectionContract, fillSelectionContract } from './selection-contract.js';
import { fillTemplate } from './engine.js';

const source = resolve('templates/common-paper-cc-by-4.0/common-paper-mutual-nda');
const evidence = resolve('.cache/common-paper-declarative');
const values = {
  effective_date: '2026-09-12', purpose: 'Synthetic integration evaluation',
  party_1_name: 'Alex Example', party_1_title: 'Director', party_1_company: 'Example One LLC', party_1_email: 'one@example.com',
  party_2_name: 'Sam Example', party_2_title: 'President', party_2_company: 'Example Two LLC', party_2_email: 'two@example.com',
};
const xmlParts = (path: string) => Object.fromEntries(new AdmZip(readFileSync(path)).getEntries()
  .filter(e => !e.isDirectory).map(e => [e.entryName, e.getData().toString('base64')]));

describe('Common Paper source-generated selection contract pilot', () => {
  it('compiles fields, selections and bindings without a per-template contract file', async () => {
    const c = await compileSelectionContract(source);
    expect(c.metadata.fields).toHaveLength(18);
    expect(c.selections.groups).toHaveLength(2);
    expect(c.bindings).toHaveLength(16);
    expect(c.rules).toHaveLength(12);
    mkdirSync(evidence, { recursive: true });
    writeFileSync(join(evidence, 'fill-contract.json'), JSON.stringify(c, null, 2));
  });
  for (const term of ['1 year(s)', 'until terminated']) {
    for (const confidentiality of ['1 year(s)', 'In perpetuity']) {
      for (const p1 of ['entity', 'individual']) {
        for (const p2 of ['entity', 'individual']) {
          const id = `${term === 'until terminated' ? 'terminated' : 'fixed'}-${confidentiality === 'In perpetuity' ? 'perpetual' : 'fixed'}-${p1}-${p2}`;
          it(`matches every legacy ZIP entry: ${id}`, async () => {
            mkdirSync(evidence, { recursive: true });
            const input = { ...values, mnda_term: term, confidentiality_term: confidentiality, party_1_type: p1, party_2_type: p2 };
            const contract = await compileSelectionContract(source);
            const output = join(evidence, `${id}.docx`);
            const legacyOutput = join(evidence, `${id}-legacy.docx`);
            const result = await fillSelectionContract(source, contract, input, output);
            const legacy = await fillTemplate({ templateDir: source, values: input, outputPath: legacyOutput });
            expect(xmlParts(output)).toEqual(xmlParts(legacyOutput));
            expect(result.fieldsUsed).toEqual(legacy.fieldsUsed);
            expect(result.fillCommandCount).toBeGreaterThan(0);
            const xml = new AdmZip(output).readAsText('word/document.xml');
            expect(xml.includes('Continues until terminated')).toBe(term === 'until terminated');
            expect(xml.includes('In perpetuity.')).toBe(confidentiality === 'In perpetuity');
            expect(xml.includes('Example One LLC')).toBe(p1 === 'entity');
            expect(xml.includes('Example Two LLC')).toBe(p2 === 'entity');
            expect(result.warnings).toHaveLength((p1 === 'individual' ? 2 : 0) + (p2 === 'individual' ? 2 : 0));
          });
        }
      }
    }
  }
  it('preserves legacy blank signature normalization and defaults', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-cp-blanks-'));
    const c = await compileSelectionContract(source);
    const input = { effective_date: '2026-09-12', party_1_name: '_______', party_2_title: ' _______ ' };
    await fillSelectionContract(source, c, input, join(dir, 'new.docx'));
    await fillTemplate({ templateDir: source, values: input, outputPath: join(dir, 'old.docx') });
    expect(xmlParts(join(dir, 'new.docx'))).toEqual(xmlParts(join(dir, 'old.docx')));
  });
  it('rejects modified manifests and invalid/derived inputs before writing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-cp-invalid-'));
    const c = await compileSelectionContract(source);
    for (const input of [{ party_1_type: 'corporation' }, { party_1_title_display: 'injected' }, { purpose: 42 }]) {
      await expect(fillSelectionContract(source, c, input, join(dir, 'output.docx'))).rejects.toThrow('Invalid input');
    }
    await expect(fillSelectionContract(source, { ...c, rules: [] }, values, join(dir, 'output.docx'))).rejects.toThrow('Contract/source mismatch');
    expect(existsSync(join(dir, 'output.docx'))).toBe(false);
  });
  it('detects source drift and refuses missing selection markers and unsupported stages', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-cp-drift-'));
    cpSync(source, dir, { recursive: true });
    const c = await compileSelectionContract(dir);
    const meta = join(dir, 'metadata.yaml');
    writeFileSync(meta, readFileSync(meta, 'utf8') + '\n# upstream update\n');
    await expect(fillSelectionContract(dir, c, values, join(dir, 'out.docx'))).rejects.toThrow('Contract/source mismatch');
    const selectionPath = join(dir, 'selections.json');
    writeFileSync(selectionPath, readFileSync(selectionPath, 'utf8').replace('In perpetuity.', 'missing marker'));
    await expect(compileSelectionContract(dir)).rejects.toThrow('Selection marker must match exactly once');
    writeFileSync(join(dir, 'clean.json'), '{}');
    await expect(compileSelectionContract(dir)).rejects.toThrow('Unsupported source artifact/stage');
  });
});
