import { describe, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { FieldSelectorMetadataSchema } from './metadata.js';
import { assertConditionalRequiredInputs, IncompleteConditionalInputError } from './conditional-inputs.js';
import { buildFieldSelectorInputSchema } from './field-selector/input-schema.js';
import { prepareFillData } from './fill-pipeline.js';

const it = itAllure.epic('Filling & Rendering');
const fixture = {
  name: 'Conditional inputs', source_url: 'https://example.com/form.docx', source_version: '1', license_note: 'Synthetic',
  fields: [
    { name: 'enabled', type: 'boolean', description: 'Enable optional regime', default: 'false' },
    { name: 'start_date', type: 'date', description: 'Start', required_when: { field: 'enabled', equals: true } },
    { name: 'interest_rate', type: 'string', description: 'Percentage', required_when: { field: 'enabled', equals: true } },
    { name: 'frequency', type: 'enum', description: 'Frequency', options: ['annual', 'quarterly'], required_when: { field: 'enabled', equals: true } },
  ],
};

describe('conditional required inputs', () => {
  it('keeps runtime and exported schema aligned for omitted, blank, disabled and complete inputs', () => {
    const metadata = FieldSelectorMetadataSchema.parse(fixture);
    const ajv = new Ajv2020({ strict: true });
    addFormats(ajv); ajv.addKeyword('x-openagreements');
    const validate = ajv.compile(buildFieldSelectorInputSchema('fixture', metadata, null));
    const valid = { enabled: true, start_date: '2030-01-01', interest_rate: '0', frequency: 'annual' };
    for (const field of ['start_date', 'interest_rate', 'frequency']) {
      for (const omitted of [undefined, '', ' \t\n']) {
        const invalid = { ...valid, [field]: omitted };
        expect(validate(invalid)).toBe(false);
        expect(() => assertConditionalRequiredInputs(invalid, metadata.fields)).toThrow(IncompleteConditionalInputError);
        try { assertConditionalRequiredInputs(invalid, metadata.fields); } catch (error) {
          expect(error).toMatchObject({ code: 'INCOMPLETE_CONDITIONAL_INPUT', fields: [field] });
        }
      }
    }
    for (const input of [{}, { enabled: false }, valid]) {
      expect(validate(input)).toBe(true);
      expect(() => prepareFillData({ values: input, fields: metadata.fields })).not.toThrow();
    }
    expect(validate({ ...valid, frequency: 'daily' })).toBe(false);
    expect(() => prepareFillData({ values: { ...valid, frequency: 'daily' }, fields: metadata.fields })).toThrow(/unknown option/);
    expect(validate({ enabled: 'true' })).toBe(false);
    expect(() => assertConditionalRequiredInputs({ enabled: 'true' }, metadata.fields)).toThrow(/controller/);
  });

  it('uses matching controller defaults consistently without treating an absent controller as true otherwise', () => {
    for (const defaultValue of [undefined, 'false', 'true']) {
      const raw = structuredClone(fixture);
      if (defaultValue === undefined) delete (raw.fields[0] as { default?: string }).default;
      else raw.fields[0].default = defaultValue;
      const metadata = FieldSelectorMetadataSchema.parse(raw);
      const ajv = new Ajv2020({ strict: false }); addFormats(ajv);
      const validate = ajv.compile(buildFieldSelectorInputSchema('fixture', metadata, null));
      expect(validate({})).toBe(defaultValue !== 'true');
      expect(validate({ enabled: false })).toBe(true);
      if (defaultValue === 'true') expect(() => assertConditionalRequiredInputs({}, metadata.fields)).toThrow(/start_date/);
      else expect(() => assertConditionalRequiredInputs({}, metadata.fields)).not.toThrow();
      expect(() => assertConditionalRequiredInputs({ enabled: false }, metadata.fields)).not.toThrow();
    }
  });

  it('rejects unknown, self, incompatible or nested controllers and silent economic defaults', () => {
    for (const condition of [{ field: 'missing', equals: true }, { field: 'start_date', equals: true }, { field: 'enabled', equals: 'true' }]) {
      const raw = structuredClone(fixture); raw.fields[1].required_when = condition as typeof raw.fields[1]['required_when'];
      expect(FieldSelectorMetadataSchema.safeParse(raw).success).toBe(false);
    }
    const raw = structuredClone(fixture); raw.fields[1].default = '2030-01-01';
    expect(FieldSelectorMetadataSchema.safeParse(raw).success).toBe(false);
    expect(FieldSelectorMetadataSchema.safeParse({ ...fixture, fields: [...fixture.fields, {
      name: 'rows', type: 'array', description: 'Rows', items: [{ ...fixture.fields[1] }],
    }] }).success).toBe(false);
  });
});
