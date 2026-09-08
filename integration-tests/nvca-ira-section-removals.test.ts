import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect} from 'vitest';
import {itAllure} from './helpers/allure-test.js';
import {extractAllText, runFieldSelector} from '../src/core/field-selector/index.js';

const it = itAllure.epic('Filling & Rendering');
const recipeId = 'nvca-investors-rights-agreement';
const source = join(homedir(), '.open-agreements/cache', recipeId, 'source.docx');
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/ira-production-full.json'), 'utf8'));
const sections = [
  {field: 'include_board_attendance_expenses', heading: 'Board Attendance Expenses', bodies: ['The Company shall reimburse the directors']},
  {field: 'include_successor_indemnification', heading: 'Successor Indemnification', bodies: ['If the Company or any of its successors or assignees consolidates']},
  {field: 'include_transaction_assistance', heading: 'Expenses of Counsel and Transaction Assistance in an IPO and Sale of the Company', bodies: ['Expense Reimbursement.', 'Sale of the Company. At the outset', 'IPO. If in connection with the IPO', 'Joint Defense/Common Interest Agreement.']},
  {field: 'include_indemnification_matters', heading: 'Indemnification Matters', bodies: ['The Company hereby acknowledges that one or more of the directors affiliated']},
  {field: 'include_corporate_governance_program', heading: 'Corporate Governance', bodies: ['prepare and submit each of the corporate governance policies']},
  {field: 'include_real_property_reporting', heading: 'Real Property Holding Corporation', bodies: ['interest in the Company constitutes a United States real property interest']},
  {field: 'include_subsidiary_governance', heading: 'Subsidiary Governance', bodies: ['The Company shall not permit any subsidiary of the Company']},
];
const fields = sections.map(({field}) => field);
const extra = ['include_fair_practices_covenant', 'include_cybersecurity_covenant', 'include_dpa_foreign_person_provisions', 'include_outbound_investment_covenant'];
const baseline = {...fixture, ...Object.fromEntries([...fields, ...extra].map(field => [field, true])), include_transaction_ipo_advance_notice: true};
const cases = [
  {name: 'all enabled', off: []},
  ...fields.map(field => ({name: `without ${field}`, off: [field]})),
  {name: 'all disabled, child enabled', off: [...fields, ...extra]},
  ...fields.slice(0, -1).map((field, index) => ({name: `adjacent pair ${index}`, off: [field, fields[index + 1]]})),
  {name: 'governance/FCPA boundary', off: ['include_corporate_governance_program', 'include_fair_practices_covenant']},
  {name: 'cyber/real-property boundary', off: ['include_cybersecurity_covenant', 'include_real_property_reporting']},
  {name: 'real-property/CFIUS boundary', off: ['include_real_property_reporting', 'include_dpa_foreign_person_provisions']},
  {name: 'CFIUS/outbound boundary', off: ['include_dpa_foreign_person_provisions', 'include_outbound_investment_covenant']},
  {name: 'outbound/subsidiary boundary', off: ['include_outbound_investment_covenant', 'include_subsidiary_governance']},
  {name: 'transaction child disabled', off: ['include_transaction_ipo_advance_notice']},
];
const describeWithSource = existsSync(source) ? describe : describe.skip;

describeWithSource('IRA complete split-section election matrix (LE #2521)', () => {
  it('uses the pinned real NVCA source', () => {
    expect(createHash('sha256').update(readFileSync(source)).digest('hex'))
      .toBe('be8ad13f171a343bdb53716b1d318689ae3477cdf7f1986b2e3985e1cabbd08a');
  });
  it.each(cases)('$name', async ({name, off}) => {
    const dir = mkdtempSync(join(tmpdir(), 'ira-section-election-'));
    try {
      const values: Record<string, unknown> = {...baseline, ...Object.fromEntries(off.map(field => [field, false]))};
      const result = await runFieldSelector({fieldSelectorId: recipeId, inputPath: source, outputPath: join(dir, 'filled.docx'), values, selectionsZeroMatchPolicy: 'error'});
      const text = extractAllText(result.outputPath);
      expect(result.warnings, name).toEqual([]);
      for (const {field, heading, bodies} of sections) {
        const headingPresent = text.split('\n').some(line => line.trim().replace(/^\[/, '').replace(/[.\]\s]+$/, '') === heading);
        expect(headingPresent, `${name}: ${heading}`).toBe(values[field]);
        for (const marker of bodies) expect(text.includes(marker), `${name}: ${field}`).toBe(values[field]);
      }
      expect(text.includes('ten days’ advanced written notice to Investor Counsel')).toBe(Boolean(values.include_transaction_assistance && values.include_transaction_ipo_advance_notice));
      const mandatory = text.split('\n').find(line => line.includes('Nothing in this Agreement shall preclude or in any way restrict the Professional Investment Organization'));
      expect(mandatory).toBeDefined();
      expect(createHash('sha256').update(mandatory ?? '').digest('hex'))
        .toBe('7fff4b798538848a988247c935240f4426a7b8bf4eb1421fe4268c6daa431457');
      expect(text).toContain('Termination of Covenants');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }, 30000);
});
