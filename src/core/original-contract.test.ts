import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { compileOriginalContract, fillOriginalContract } from './original-contract.js';

const PRIVACY = 'templates/openagreements-cc-by-4.0/openagreements-privacy-policy';
const BOARD = 'templates/openagreements-cc-by-4.0/openagreements-board-consent-safe';
const FLORIDA = 'templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-florida';
const OFFER = 'templates/openagreements-cc-by-4.0/openagreements-employment-offer-letter';
const temporary: string[] = [];
const temp = () => { const path = mkdtempSync(join(tmpdir(), 'oa-original-test-')); temporary.push(path); return path; };
const output = () => join(temp(), 'filled.docx');
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
const copiedPrivacy = () => { const path = join(temp(), 'privacy'); cpSync(PRIVACY, path, { recursive: true }); return path; };

describe('original source contracts', () => {
  it('preserves literal false text in string-gated clauses without treating it as Boolean false', async () => {
    const contract = await compileOriginalContract(OFFER);
    for (const text of ['false', ' false ', '0']) {
      const path = output();
      await fillOriginalContract(OFFER, contract, { bonus_terms: text }, path);
      const xml = new AdmZip(path).readAsText('word/document.xml');
      expect(xml).toContain('Bonus Opportunity');
      expect(xml).toContain(`>${text}<`);
    }
    for (const text of ['', '   ', '_______']) {
      const path = output();
      await fillOriginalContract(OFFER, contract, { bonus_terms: text }, path);
      expect(new AdmZip(path).readAsText('word/document.xml')).not.toContain('Bonus Opportunity');
    }
  });

  it('keeps the privacy canonical schema separate from its public projection', async () => {
    const contract = await compileOriginalContract(PRIVACY);
    expect(contract.fields).toHaveLength(35);
    expect(contract.metadata.fields).toHaveLength(14);
    expect(contract.publicFields).toHaveLength(14);
    expect(contract.fields.some(field => field.name === 'show_rights_machinery' && field.ai_only)).toBe(true);
    expect(contract.derivedGates.some(gate => gate.field === 'show_sale_optout')).toBe(true);
  });

  it('rejects a tampered source/runtime manifest before rendering', async () => {
    const contract = await compileOriginalContract(BOARD);
    const sourceTampered = structuredClone(contract);
    sourceTampered.sourceHashes['template.mdoc'] = '0'.repeat(64);
    await expect(fillOriginalContract(BOARD, sourceTampered, {}, output())).rejects.toThrow(/Contract\/source\/runtime mismatch/);
    const runtimeTampered = structuredClone(contract);
    runtimeTampered.runtime.hash = '1'.repeat(64);
    await expect(fillOriginalContract(BOARD, runtimeTampered, {}, output())).rejects.toThrow(/Contract\/source\/runtime mismatch/);
  });

  it('rejects string booleans, caller-derived gates, and unknown nested array members', async () => {
    const privacy = await compileOriginalContract(PRIVACY);
    await expect(fillOriginalContract(PRIVACY, privacy, { covered_by_comprehensive_privacy_act: 'false' }, output()))
      .rejects.toThrow('Invalid input: covered_by_comprehensive_privacy_act');
    await expect(fillOriginalContract(PRIVACY, privacy, { show_rights_machinery: false }, output()))
      .rejects.toThrow(/derived gates are runtime-computed/);
    const board = await compileOriginalContract(BOARD);
    await expect(fillOriginalContract(BOARD, board, { board_members: [{ name: 'Director', injected: true }] }, output()))
      .rejects.toThrow('Invalid input: board_members');
  });

  it('fills an array-of-objects contract through the native canonical renderer', async () => {
    const contract = await compileOriginalContract(BOARD);
    const result = await fillOriginalContract(BOARD, contract, {
      company_name: 'Acme, Inc.', effective_date: '2026-09-15', purchase_amount: '1000', board_members: [{ name: 'A. Director' }],
    }, output());
    expect(result.fillCommandCount).toBeGreaterThan(0);
  });

  it('rejects source drift and malformed derived-gate programs in a copied source bundle', async () => {
    const source = copiedPrivacy();
    const contract = await compileOriginalContract(source);
    writeFileSync(join(source, 'template.mdoc'), `${readFileSync(join(source, 'template.mdoc'), 'utf8')}\n`);
    await expect(fillOriginalContract(source, contract, {}, output())).rejects.toThrow(/Contract\/source\/runtime mismatch/);
    const cases: Array<[string, RegExp]> = [
      ['unknown_gate_ref', /derived gate/],
      ['covered_by_comprehensive_privacy_act; process.exit()', /derived gate/],
    ];
    for (const [expression, message] of cases) {
      const fixture = copiedPrivacy(); const path = join(fixture, 'template.mdoc');
      writeFileSync(path, readFileSync(path, 'utf8').replace('derived_gate: "covered_by_comprehensive_privacy_act"', `derived_gate: "${expression}"`));
      await expect(compileOriginalContract(fixture)).rejects.toThrow(message);
    }
  });

  it('rejects a derived-gate cycle even where every identifier exists', async () => {
    const fixture = copiedPrivacy(); const path = join(fixture, 'template.mdoc');
    let source = readFileSync(path, 'utf8');
    source = source.replace('derived_gate: "covered_by_comprehensive_privacy_act"', 'derived_gate: "show_profiling_optout"');
    source = source.replace('derived_gate: "covered_by_comprehensive_privacy_act AND processes_for_profiling"', 'derived_gate: "show_rights_machinery"');
    writeFileSync(path, source);
    await expect(compileOriginalContract(fixture)).rejects.toThrow(/Derived gate cycle/);
  });

  it('renders Florida confirmation states without auto-confirming a statutory fact', async () => {
    const contract = await compileOriginalContract(FLORIDA);
    const render = async (covered: boolean, confirmed: boolean) => {
      const path = output();
      await fillOriginalContract(FLORIDA, contract, {
        employer_name: 'Acme', employee_name: 'Employee', covered_employee: covered,
        choice_act_advance_notice_confirmed: confirmed,
      }, path);
      return new AdmZip(path).readAsText('word/document.xml');
    };
    const inapplicable = await render(false, false);
    expect(inapplicable).not.toContain('CHOICE Act Counsel Advisal');
    const pending = await render(true, false);
    expect(pending).toContain('CHOICE Act Counsel Advisal');
    expect(pending).toContain('CONFIRM before signing');
    const confirmed = await render(true, true);
    expect(confirmed).toContain('CHOICE Act Counsel Advisal');
    expect(confirmed).not.toContain('CONFIRM before signing');
  });
});
