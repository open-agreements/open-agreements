import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { compileSelectionContract, fillSelectionContract } from './selection-contract.js';

const it = itAllure.epic('Filling & Rendering').withLabels({ feature: 'Declarative contracts' });

const source = resolve('templates/common-paper-cc-by-4.0/common-paper-software-license-agreement');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('static unparameterized selection contract', () => {
  it('compiles the explicit static capability and fills by exact-byte copy', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'oa-static-selection-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'output.docx');
    const contract = await compileSelectionContract(source);

    expect(contract).toMatchObject({
      profile: 'oa-static-unparameterized-v1',
      capabilities: { staticUnparameterized: true },
      bindings: [],
    });
    const result = await fillSelectionContract(source, contract, {}, outputPath);

    expect(readFileSync(outputPath)).toEqual(readFileSync(join(source, 'template.docx')));
    expect(result).toMatchObject({ fieldsUsed: [], providedFieldsUsed: [], fillCommandCount: 0, warnings: [] });
  });

  it.each([
    ['nonempty object', { unexpected: 'value' }],
    ['array', []],
    ['boolean', true],
    ['null', null],
  ])('rejects %s values', async (_label, values) => {
    const directory = mkdtempSync(join(tmpdir(), 'oa-static-selection-invalid-'));
    temporaryDirectories.push(directory);
    const contract = await compileSelectionContract(source);
    await expect(fillSelectionContract(
      source,
      contract,
      values as unknown as Record<string, unknown>,
      join(directory, 'output.docx'),
    )).rejects.toThrow('Invalid input');
  });
});
