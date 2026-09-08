import { describe, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { FieldSelectorMetadataSchema } from './metadata.js';
import { assertConditionalInputOwnership, assertConditionalRequiredInputs } from './conditional-inputs.js';
import { buildFieldSelectorInputSchema } from './field-selector/input-schema.js';

const it = itAllure.epic('Filling & Rendering');
const predicates = [{ field: 'parent', equals: true }, { field: 'child', equals: true }];
const fixture = {
  name: 'Conjunctive caller requirements', source_url: 'https://example.com/form.docx', source_version: '1', license_note: 'Synthetic',
  fields: [
    { name: 'parent', type: 'boolean', description: 'Parent election' },
    { name: 'child', type: 'boolean', description: 'Child election' },
    { name: 'amount', type: 'string', description: 'Explicit amount', required_when: { all_of: predicates } },
  ],
};

describe('caller-only conjunctive requirements', () => {
  it('requires an amount only for both true, with schema/runtime parity across omissions and blanks', () => {
    for (const parentDefault of [undefined, 'false', 'true']) {
      for (const childDefault of [undefined, 'false', 'true']) {
        const raw = structuredClone(fixture);
        Object.assign(raw.fields[0], { default: parentDefault });
        Object.assign(raw.fields[1], { default: childDefault });
        const metadata = FieldSelectorMetadataSchema.parse(raw);
        const ajv = new Ajv2020({ strict: true }); ajv.addKeyword('x-openagreements');
        const validate = ajv.compile(buildFieldSelectorInputSchema('fixture', metadata, null));
        for (const parent of [undefined, false, true]) for (const child of [undefined, false, true]) {
          const required = (parent ?? (parentDefault === 'true')) && (child ?? (childDefault === 'true'));
          for (const amount of [undefined, '', ' \t', '100']) {
            const input = { ...(parent === undefined ? {} : { parent }), ...(child === undefined ? {} : { child }), ...(amount === undefined ? {} : { amount }) };
            const valid = !required || amount === '100';
            expect(validate(input), JSON.stringify({ parentDefault, childDefault, input })).toBe(valid);
            if (valid) expect(() => assertConditionalRequiredInputs(input, metadata.fields)).not.toThrow();
            else expect(() => assertConditionalRequiredInputs(input, metadata.fields)).toThrow(/amount/);
          }
        }
      }
    }
  });

  it('rejects malformed controllers regardless of predicate order or an inactive sibling', () => {
    for (const all_of of [predicates, [...predicates].reverse()]) {
      const metadata = FieldSelectorMetadataSchema.parse({ ...fixture, fields: [...fixture.fields.slice(0, 2), {
        ...fixture.fields[2], required_when: { all_of },
      }] });
      const ajv = new Ajv2020({ strict: false });
      const validate = ajv.compile(buildFieldSelectorInputSchema('fixture', metadata, null));
      for (const input of [{ parent: false, child: 'true' }, { parent: 'false', child: false }, { parent: true, child: null }]) {
        expect(validate(input)).toBe(false);
        expect(() => assertConditionalRequiredInputs(input, metadata.fields)).toThrow(/controller/);
      }
    }
  });

  it('rejects empty/singleton/duplicate/nested/unknown/self/type-incompatible predicates and expressions', () => {
    for (const required_when of [
      { all_of: [] }, { all_of: [predicates[0]] }, { all_of: [predicates[0], predicates[0]] },
      { all_of: [predicates[0], { field: 'parent', equals: false }] },
      { all_of: [predicates[0], { all_of: predicates }] },
      { all_of: [predicates[0], { field: 'unknown', equals: true }] },
      { all_of: [predicates[0], { field: 'amount', equals: '100' }] },
      { all_of: [predicates[0], { field: 'child', equals: 'true' }] },
      { all_of: predicates, expression: 'parent && child' },
      { all_of: predicates, field: 'parent', equals: true },
      { any_of: predicates },
    ]) {
      expect(FieldSelectorMetadataSchema.safeParse({ ...fixture, fields: [...fixture.fields.slice(0, 2), {
        ...fixture.fields[2], required_when,
      }] }).success, JSON.stringify(required_when)).toBe(false);
    }
    for (const target of [{ ...fixture.fields[2], default: '100' }, {
      name: 'rows', type: 'array', description: 'Nested', items: [fixture.fields[2]],
    }]) {
      expect(FieldSelectorMetadataSchema.safeParse({ ...fixture, fields: [...fixture.fields.slice(0, 2), target] }).success).toBe(false);
    }
  });

  it('rejects computed ownership for every controller and the target', () => {
    const metadata = FieldSelectorMetadataSchema.parse(fixture);
    for (const computed of ['parent', 'child', 'amount']) {
      expect(() => assertConditionalInputOwnership(metadata.fields, new Set([computed]))).toThrow(/not computed fields/);
    }
    expect(() => assertConditionalInputOwnership(metadata.fields, new Set())).not.toThrow();
  });
});
