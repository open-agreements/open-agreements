import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileSelectionContract } from '../src/core/selection-contract.js';
import { selectionReferenceInputs, verifyThirdpartyTemplate } from './verify-thirdparty-contracts.js';

const orderForm = resolve('templates/common-paper-cc-by-4.0/common-paper-order-form');
const businessAssociate = resolve('templates/common-paper-cc-by-4.0/common-paper-business-associate-agreement');
const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

function evidenceRoot(): string {
  const path = mkdtempSync(join(tmpdir(), 'oa-thirdparty-reference-'));
  temporaryPaths.push(path);
  return path;
}

describe('explicit-empty legacy selection reference inputs', () => {
  it('normalizes only declared presence-trigger placeholders for actual contracts', async () => {
    const orderContract = await compileSelectionContract(orderForm);
    const baaContract = await compileSelectionContract(businessAssociate);

    expect(selectionReferenceInputs(orderContract, {})).toEqual({
      values: { custom_start_date: '' },
      fields: ['custom_start_date'],
    });
    expect(selectionReferenceInputs(baaContract, {})).toEqual({
      values: { custom_effective_date: '' },
      fields: ['custom_effective_date'],
    });

    const supplied = {
      custom_start_date: 'January 2, 2027',
      provider_name: '_______',
      pilot_has_fee: false,
      fee_is_other: true,
    };
    expect(selectionReferenceInputs(orderContract, supplied)).toEqual({ values: supplied, fields: [] });
    expect(selectionReferenceInputs(orderContract, {
      custom_start_date: '_______',
      provider_name: 'UNCHANGED_NON_TARGET',
      pilot_has_fee: false,
    })).toEqual({
      values: {
        custom_start_date: '',
        provider_name: 'UNCHANGED_NON_TARGET',
        pilot_has_fee: false,
      },
      fields: ['custom_start_date'],
    });
  });

  it.each([
    ['Order Form', orderForm, 'custom_start_date'],
    ['Business Associate Agreement', businessAssociate, 'custom_effective_date'],
  ] as const)('%s records a passing explicit-empty reference without waiving raw differences', async (_name, templateDir, normalizedField) => {
    const receipt = await verifyThirdpartyTemplate(templateDir, evidenceRoot());
    const emptyDefaults = receipt.cases.find((item) => item.id === 'empty-defaults');

    expect(emptyDefaults).toBeDefined();
    expect(emptyDefaults).toMatchObject({
      status: 'verified',
      comparison_profile: 'legacy-explicit-empty-selection-inputs',
      normalized_selection_fields: [normalizedField],
      reasons: [],
    });
    expect(emptyDefaults?.raw_legacy_differences).toEqual(expect.arrayContaining([
      expect.stringMatching(/meaningful ZIP entry differs|raw legacy ordered body differs/),
    ]));
    expect(emptyDefaults?.reference_input_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(emptyDefaults?.reference_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(emptyDefaults?.legacy_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(emptyDefaults?.reference_sha256).not.toBe(emptyDefaults?.legacy_sha256);
  }, 60_000);
});
