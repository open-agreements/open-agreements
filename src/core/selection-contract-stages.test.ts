import { expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileSelectionContract, fillSelectionContract } from './selection-contract.js';

const it = itAllure.epic('Filling & Rendering').withLabels({ feature: 'Declarative contracts' });

const orderForm = resolve('templates/common-paper-cc-by-4.0/common-paper-order-form');
const independentContractor = resolve('templates/common-paper-cc-by-4.0/common-paper-independent-contractor-agreement');
const otherTermsSource = '[ Add any other terms relevant to the engagement, such as expense or travel reimbursements. Delete this row if not applicable ]';

it('rejects string booleans rather than silently selecting an Order Form option', async () => {
  const contract = await compileSelectionContract(orderForm);
  await expect(fillSelectionContract(orderForm, contract, { pilot_has_fee: 'false' }, '/unused.docx'))
    .rejects.toThrow('Invalid input');
});

for (const replacements of [
  { 'absent source text': '{other_terms}' },
  { [otherTermsSource]: '{unknown_field}' },
  { [otherTermsSource]: '{INS process.exit()}' },
]) {
  it(`rejects unsupported replacement ${JSON.stringify(replacements)}`, async () => {
    const temp = mkdtempSync(join(tmpdir(), 'oa-invalid-contract-'));
    try {
      cpSync(independentContractor, temp, { recursive: true });
      writeFileSync(join(temp, 'replacements.json'), JSON.stringify(replacements));
      await expect(compileSelectionContract(temp)).rejects.toThrow('Literal replacement must match exactly one authored paragraph');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
}

it('rejects replacement drift after compiling a valid ICA manifest', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'oa-contract-drift-'));
  try {
    cpSync(independentContractor, temp, { recursive: true });
    const contract = await compileSelectionContract(temp);
    writeFileSync(join(temp, 'replacements.json'), JSON.stringify({ [otherTermsSource]: '{governing_law}' }));
    await expect(fillSelectionContract(temp, contract, {}, join(temp, 'out.docx')))
      .rejects.toThrow('Contract/source mismatch; regenerate and verify');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
