import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { compileSelectionContract, fillSelectionContract } from './selection-contract.js';
import { fillTemplate } from './engine.js';
import { applySelections } from './selector.js';

const it = itAllure.epic('Filling & Rendering').withLabels({ feature: 'Declarative contracts' });

const source = resolve('templates/common-paper-cc-by-4.0/common-paper-mutual-nda');
const baaSource = resolve('templates/common-paper-cc-by-4.0/common-paper-business-associate-agreement');
const dpaSource = resolve('templates/common-paper-cc-by-4.0/common-paper-data-processing-agreement');
const icaSource = resolve('templates/common-paper-cc-by-4.0/common-paper-independent-contractor-agreement');
const psaSource = resolve('templates/bonterms-cc0-1.0/bonterms-professional-services-agreement');
const slaOrderFormSource = resolve('templates/common-paper-cc-by-4.0/common-paper-order-form-with-sla');
const designPartnerSource = resolve('templates/common-paper-cc-by-4.0/common-paper-design-partner-agreement');
const evidence = resolve('.cache/common-paper-declarative');
const temporaryDirectories: string[] = [];
const temporaryDirectory = (prefix: string) => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
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
    const dir = temporaryDirectory('oa-cp-blanks-');
    const c = await compileSelectionContract(source);
    const input = { effective_date: '2026-09-12', party_1_name: '_______', party_2_title: ' _______ ' };
    await fillSelectionContract(source, c, input, join(dir, 'new.docx'));
    await fillTemplate({ templateDir: source, values: input, outputPath: join(dir, 'old.docx') });
    expect(xmlParts(join(dir, 'new.docx'))).toEqual(xmlParts(join(dir, 'old.docx')));
  });
  it('rejects modified manifests and invalid/derived inputs before writing', async () => {
    const dir = temporaryDirectory('oa-cp-invalid-');
    const c = await compileSelectionContract(source);
    for (const input of [{ party_1_type: 'corporation' }, { party_1_title_display: 'injected' }, { purpose: 42 }]) {
      await expect(fillSelectionContract(source, c, input, join(dir, 'output.docx'))).rejects.toThrow('Invalid input');
    }
    await expect(fillSelectionContract(source, { ...c, rules: [] }, values, join(dir, 'output.docx'))).rejects.toThrow('Contract/source mismatch');
    expect(existsSync(join(dir, 'output.docx'))).toBe(false);
  });
  it('detects source drift and refuses missing selection markers and unsupported stages', async () => {
    const dir = temporaryDirectory('oa-cp-drift-');
    cpSync(source, dir, { recursive: true });
    const c = await compileSelectionContract(dir);
    const meta = join(dir, 'metadata.yaml');
    writeFileSync(meta, readFileSync(meta, 'utf8') + '\n# upstream update\n');
    await expect(fillSelectionContract(dir, c, values, join(dir, 'out.docx'))).rejects.toThrow('Contract/source mismatch');
    const selectionPath = join(dir, 'selections.json');
    const originalSelections = readFileSync(selectionPath, 'utf8');
    writeFileSync(selectionPath, originalSelections.replace('In perpetuity.', 'missing marker'));
    await expect(compileSelectionContract(dir)).rejects.toThrow('Selection marker must match exactly once');
    writeFileSync(selectionPath, originalSelections);
    writeFileSync(join(dir, 'unsupported.json'), '{}');
    await expect(compileSelectionContract(dir)).rejects.toThrow('Unsupported source artifact/stage');
  });
  it('adds Business Associate Agreement with entry-for-entry legacy parity', async () => {
    const dir = temporaryDirectory('oa-baa-parity-');
    const input = {
      party_role: 'business associate', principal_agreement: 'Master Services Agreement',
      custom_effective_date: '2026-09-12',
    };
    const contract = await compileSelectionContract(baaSource);
    await fillSelectionContract(baaSource, contract, input, join(dir, 'new.docx'));
    await fillTemplate({ templateDir: baaSource, values: input, outputPath: join(dir, 'legacy.docx') });
    expect(xmlParts(join(dir, 'new.docx'))).toEqual(xmlParts(join(dir, 'legacy.docx')));
  });
  it('hashes and applies an ICA clean stage with entry-for-entry legacy parity', async () => {
    const dir = temporaryDirectory('oa-ica-parity-');
    const input = {
      company_signatory_name: 'Company signer', company_signatory_title: 'CEO', company_signatory_company: 'Company',
      contractor_signatory_name: 'Contractor signer', contractor_signatory_title: 'Consultant', contractor_signatory_company: 'Contractor',
      services_description: 'Services', rates_and_fees: '$100', payment_terms: '30 days', timeline: 'June',
      governing_law: 'Illinois', jurisdiction: 'Cook County', other_terms: '',
    };
    const contract = await compileSelectionContract(icaSource);
    expect(contract.sourceHashes['clean.json']).toMatch(/^[a-f0-9]{64}$/);
    await fillSelectionContract(icaSource, contract, input, join(dir, 'new.docx'));
    await fillTemplate({ templateDir: icaSource, values: input, outputPath: join(dir, 'legacy.docx') });
    expect(xmlParts(join(dir, 'new.docx'))).toEqual(xmlParts(join(dir, 'legacy.docx')));
    expect(new AdmZip(join(dir, 'new.docx')).readAsText('word/document.xml')).not.toContain('Interpreting help text');
  });
  it('adapts Bonterms PSA’s closed declared radio domain with legacy parity', async () => {
    const dir = temporaryDirectory('oa-psa-parity-');
    const contract = await compileSelectionContract(psaSource);
    expect(contract.selectionEnums).toEqual({ deliverables_type: ['licensed', 'assigned'] });
    for (const deliverables_type of ['licensed', 'assigned']) {
      const input = { customer_name: 'Customer', provider_name: 'Provider', effective_date: '2026-09-12', deliverables_type };
      await fillSelectionContract(psaSource, contract, input, join(dir, `${deliverables_type}-new.docx`));
      await fillTemplate({ templateDir: psaSource, values: input, outputPath: join(dir, `${deliverables_type}-legacy.docx`) });
      expect(xmlParts(join(dir, `${deliverables_type}-new.docx`))).toEqual(xmlParts(join(dir, `${deliverables_type}-legacy.docx`)));
    }
    await expect(fillSelectionContract(psaSource, contract, { deliverables_type: 'other' }, join(dir, 'invalid.docx'))).rejects.toThrow('Invalid input');
  });
  it('rejects a changed Bonterms provenance recipe before filling', async () => {
    const dir = temporaryDirectory('oa-psa-recipe-');
    cpSync(psaSource, dir, { recursive: true });
    const contract = await compileSelectionContract(dir);
    const recipe = join(dir, 'source.json');
    writeFileSync(recipe, readFileSync(recipe, 'utf8').replace('psa-cover-page.docx', 'changed-cover-page.docx'));
    await expect(fillSelectionContract(dir, contract, {}, join(dir, 'output.docx'))).rejects.toThrow('Contract/source mismatch');
  });
  it('rejects ambiguous literal replacements instead of preserving legacy SLA corruption', async () => {
    await expect(compileSelectionContract(slaOrderFormSource)).rejects.toThrow('Literal replacement must match exactly one authored paragraph');
    await expect(compileSelectionContract(designPartnerSource)).rejects.toThrow('Literal replacement must match exactly one authored paragraph');
  });
  it('rejects two literal replacement occurrences in one authored paragraph', async () => {
    const dir = temporaryDirectory('oa-same-paragraph-replacement-');
    cpSync(source, dir, { recursive: true });
    writeFileSync(join(dir, 'replacements.json'), JSON.stringify({ SAME_TOKEN: '{effective_date}' }));
    const template = join(dir, 'template.docx');
    const zip = new AdmZip(template);
    const document = zip.getEntry('word/document.xml')!;
    const xml = document.getData().toString('utf8').replace(
      '</w:body>', '<w:p><w:r><w:t>SAME_TOKEN SAME_TOKEN</w:t></w:r></w:p></w:body>',
    );
    zip.updateFile('word/document.xml', Buffer.from(xml));
    zip.writeZip(template);
    await expect(compileSelectionContract(dir)).rejects.toThrow('Literal replacement must match exactly one authored paragraph');
  });
  it('selects standalone checkboxes independently and does not prefix-match authored labels', async () => {
    const dir = temporaryDirectory('oa-standalone-');
    const output = join(dir, 'selected.docx');
    await applySelections(join(dpaSource, 'template.docx'), output, {
      groups: [
        { id: 'soc-type-one', type: 'checkbox', standalone: true, options: [{ marker: 'SOC 2 Type I', trigger: { field: 'type_one' } }] },
        { id: 'soc-type-two', type: 'checkbox', standalone: true, options: [{ marker: 'SOC 2 Type II', trigger: { field: 'type_two' } }] },
      ],
    }, { type_one: true, type_two: false });
    const xml = new AdmZip(output).readAsText('word/document.xml');
    expect(xml).toContain('SOC 2 Type I');
    expect(xml).not.toContain('SOC 2 Type II');
    expect(xml).toMatch(/[☑]|\[\s*x\s*\]/i);
  });
});
