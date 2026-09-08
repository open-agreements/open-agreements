import { describe, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { FieldSelectorMetadataSchema } from './metadata.js';
import { assertConditionalRequiredInputs } from './conditional-inputs.js';
import { assertFieldSelectorInputValueShapes, buildFieldSelectorInputSchema } from './field-selector/input-schema.js';

const it = itAllure.epic('Filling & Rendering');
const fixture = {
  name: 'Explicit integer format', source_url: 'https://example.com/form.docx', source_version: '1', license_note: 'Synthetic',
  fields: [
    {name: 'enabled', type: 'boolean', description: 'Enable'},
    {name: 'arbitrary_name', type: 'string', description: 'Explicit format independent of its name', value_format: 'nonnegative_integer',
      required_when: {field: 'enabled', equals: true}},
  ],
};

describe('explicit nonnegative integer string format', () => {
  it('shares a full-string ASCII grammar between runtime and schema, including newline edges', () => {
    const metadata = FieldSelectorMetadataSchema.parse(fixture);
    const ajv = new Ajv2020({strict: true}); ajv.addKeyword('x-openagreements');
    const validate = ajv.compile(buildFieldSelectorInputSchema('fixture', metadata, null));
    const cases: Array<[unknown, boolean]> = [
      ['0', true], ['1', true], ['100', true], ['999999999999999999999999999999999999', true],
      ['00', false], ['01', false], ['-1', false], ['+1', false], ['1.0', false], ['1e3', false],
      ['1,000', false], [' 1', false], ['1 ', false], ['1\n', false], ['1\r\n', false], ['\n1', false],
      ['1\u2028', false], ['1\u2029', false], ['1\u0000', false], ['١', false], ['１', false],
      ['100 shares', false], [0, false], [1, false], [false, false], [null, false], [{}, false], [[], false],
    ];
    for (const [amount, valid] of cases) {
      const values = {enabled: true, arbitrary_name: amount};
      expect(validate(values), JSON.stringify(amount)).toBe(valid);
      if (valid) expect(() => assertFieldSelectorInputValueShapes(values, metadata.fields)).not.toThrow();
      else expect(() => assertFieldSelectorInputValueShapes(values, metadata.fields)).toThrow(/nonnegative integer string/);
    }
  });

  it('allows absent/empty inactive values but requires explicit nonblank active values', () => {
    const metadata = FieldSelectorMetadataSchema.parse(fixture);
    const ajv = new Ajv2020({strict: false});
    const validate = ajv.compile(buildFieldSelectorInputSchema('fixture', metadata, null));
    for (const enabled of [false, true]) for (const amount of [undefined, '']) {
      const values = {enabled, ...(amount === undefined ? {} : {arbitrary_name: amount})};
      expect(validate(values)).toBe(!enabled);
      expect(() => assertFieldSelectorInputValueShapes(values, metadata.fields)).not.toThrow();
      if (enabled) expect(() => assertConditionalRequiredInputs(values, metadata.fields)).toThrow(/arbitrary_name/);
      else expect(() => assertConditionalRequiredInputs(values, metadata.fields)).not.toThrow();
    }
    expect(() => assertConditionalRequiredInputs({enabled: true, arbitrary_name: ' \t\n'}, metadata.fields)).toThrow(/arbitrary_name/);
  });

  it('rejects unsupported formats/types/defaults without changing unformatted fields', () => {
    for (const field of [
      {name: 'x', type: 'string', description: 'X', value_format: 'arbitrary_regex'},
      {name: 'x', type: 'number', description: 'X', value_format: 'nonnegative_integer'},
      {name: 'x', type: 'string', description: 'X', value_format: 'nonnegative_integer', default: '-1'},
      {name: 'x', type: 'string', description: 'X', value_format: 'nonnegative_integer', default: '1\n'},
    ]) expect(FieldSelectorMetadataSchema.safeParse({...fixture, fields: [field]}).success).toBe(false);
    for (const defaultValue of ['', '0', '123']) {
      expect(FieldSelectorMetadataSchema.safeParse({...fixture, fields: [{
        name: 'x', type: 'string', description: 'X', value_format: 'nonnegative_integer', default: defaultValue,
      }]}).success).toBe(true);
    }
    const metadata = FieldSelectorMetadataSchema.parse({...fixture, fields: [{name: 'x', type: 'string', description: 'X'}]});
    expect(() => assertFieldSelectorInputValueShapes({x: '-1 units'}, metadata.fields)).not.toThrow();
  });
});
