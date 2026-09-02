import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { prepareFillData } from './fill-pipeline.js';
import type { FieldDefinition } from './metadata.js';

const it = itAllure.epic('Template Filling').withLabels({ feature: 'Field Validation' });

const enumField: FieldDefinition = {
  name: 'debt_treatment',
  type: 'enum',
  description: 'Debt proceeds treatment',
  options: ['including', 'excluding'],
  default: 'excluding',
};

describe('prepareFillData enum validation', () => {
  it('accepts a declared enum option and applies a valid default', () => {
    expect(prepareFillData({ values: { debt_treatment: 'including' }, fields: [enumField] }))
      .toMatchObject({ debt_treatment: 'including' });
    expect(prepareFillData({ values: {}, fields: [enumField] }))
      .toMatchObject({ debt_treatment: 'excluding' });
  });

  it('rejects undeclared enum options instead of rendering them into legal text', () => {
    expect(() => prepareFillData({ values: { debt_treatment: 'whatever' }, fields: [enumField] }))
      .toThrow('Enum field "debt_treatment" received unknown option "whatever"');
  });

  it('allows an omitted defaultless enum in blank-placeholder document mode', () => {
    const defaultless = { ...enumField, default: undefined };
    expect(prepareFillData({
      values: {},
      fields: [defaultless],
      useBlankPlaceholder: true,
    })).toMatchObject({ debt_treatment: '_______' });
  });
});
