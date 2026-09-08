import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import {
  buildFieldSelectorInputSchema,
  canonicalSha256,
  computedFieldNames,
  fieldValuePattern,
  getFieldSelectorInputSchema,
  assertFieldSelectorInputValueShapes,
  type JsonSchema,
} from './input-schema.js';
import { loadComputedProfile } from './computed.js';
import { loadFieldSelectorMetadata } from '../metadata.js';
import { listFieldSelectorIds, resolveFieldSelectorDir } from '../../utils/paths.js';

const NVCA_GOLDEN_HASHES: Record<string, string> = {
  'nvca-certificate-of-incorporation': '003b1da0413315f4f7692f1b7641c0bdd1c683c64a2c7526f5f8ef1e4230eb9a',
  'nvca-indemnification-agreement': '378070ff3d36bffc460b6b7d95a29f1c950c88f724fe90484260108900ac0b9b',
  'nvca-investors-rights-agreement': 'b16253ec1e9a3db38974c1ad9d9774e5de1f79a3b6575e756afc227fb4ae4ce6',
  'nvca-management-rights-letter': '5e27820907e815dbb139ff81943b6a9ee68cb06994a1b732de1f60aefd410ba9',
  'nvca-rofr-co-sale-agreement': '70b3f7017a95c812926bca57a56beb189980500b73e09ee7fad9b09e2a8c6d56',
  'nvca-stock-purchase-agreement': 'c4c8835b56aa13071a6c89f430929ca484b376f219d930161da0fe44e92d1d99',
  'nvca-voting-agreement': 'b8d0a54005f0dd8131655f4f8c6f589615a4341f01b70507e409799041b45962',
};
const it = itAllure.epic('Discovery & Metadata');

function validator(schema: JsonSchema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addKeyword('x-openagreements');
  return ajv.compile(schema);
}

describe('field-selector caller-input JSON Schema', () => {
  it('has an intentional golden for every published NVCA field-selector', () => {
    expect(listFieldSelectorIds().sort()).toEqual(Object.keys(NVCA_GOLDEN_HASHES).sort());
    for (const [id, expected] of Object.entries(NVCA_GOLDEN_HASHES)) {
      const schema = getFieldSelectorInputSchema(id, resolveFieldSelectorDir(id));
      expect(canonicalSha256(schema), id).toBe(expected);
      expect(() => validator(schema)).not.toThrow();
      const validate = validator(schema);
      expect(validate({}), `${id} must enforce priority fields`).toBe(false);
      expect(validate({ unexpected_field: true }), `${id} must be closed`).toBe(false);
    }
  });

  it('is generated from the exact validated metadata fields and excludes computed outputs', () => {
    for (const id of listFieldSelectorIds()) {
      const dir = resolveFieldSelectorDir(id);
      const metadata = loadFieldSelectorMetadata(dir);
      const computed = computedFieldNames(loadComputedProfile(dir));
      const schema = buildFieldSelectorInputSchema(id, metadata, loadComputedProfile(dir));
      const properties = schema.properties as Record<string, unknown>;
      expect(Object.keys(properties)).toEqual(
        metadata.fields.filter((field) => !computed.has(field.name)).map((field) => field.name),
      );
      expect(schema.required).toEqual(
        metadata.priority_fields.filter((name) => !computed.has(name)),
      );
      expect(schema.additionalProperties).toBe(false);
      for (const name of computed) expect(properties).not.toHaveProperty(name);
    }
  });

  it('closes and strongly types representative repeatable-array row objects', () => {
    const schema = getFieldSelectorInputSchema(
      'nvca-stock-purchase-agreement',
      resolveFieldSelectorDir('nvca-stock-purchase-agreement'),
    );
    const purchaser = ((schema.properties as Record<string, JsonSchema>).purchasers.items as JsonSchema);
    expect(purchaser.additionalProperties).toBe(false);
    expect(purchaser.required).toEqual([
      'name_and_address', 'convertible_investment', 'convertible_shares',
      'cash_purchase_price', 'cash_purchase_economics', 'cash_shares', 'total_shares',
    ]);
    const fields = purchaser.properties as Record<string, JsonSchema>;
    expect(fields.convertible_investment.type).toBe('number');
    expect(fields.name_and_address.type).toBe('string');
  });

  it('rejects unknown properties, missing priority fields, and malformed scalar/nested values', () => {
    const schema: JsonSchema = buildFieldSelectorInputSchema('fixture', {
      name: 'Fixture', source_url: 'https://example.com/source.docx', source_version: '1',
      license_note: 'fixture', optional: false, fields: [
        { name: 'name', type: 'string', description: 'Name' },
        { name: 'closing_date', type: 'date', description: 'Date' },
        { name: 'enabled', type: 'boolean', description: 'Enabled', default: 'false' },
        { name: 'amount', type: 'number', description: 'Amount' },
        { name: 'mode', type: 'enum', description: 'Mode', options: ['a', 'b'] },
        { name: 'rows', type: 'array', description: 'Rows', items: [
          { name: 'label', type: 'string', description: 'Label' },
          { name: 'shares', type: 'number', description: 'Shares' },
        ] },
      ], priority_fields: ['name', 'rows'], market_data_citations: [],
    }, null);
    const validate = validator(schema);
    const valid = { name: 'Acme', closing_date: '2026-09-05', enabled: true, amount: 1.5, mode: 'a', rows: [{ label: 'A', shares: 10 }] };
    expect(validate(valid)).toBe(true);
    for (const invalid of [
      { ...valid, extra: true },
      { ...valid, name: undefined },
      { ...valid, closing_date: 'September 5, 2026' },
      { ...valid, enabled: 'true' },
      { ...valid, amount: '1.5' },
      { ...valid, mode: 'c' },
      { ...valid, rows: [{ label: 'A' }] },
      { ...valid, rows: [{ label: 'A', shares: 10, extra: true }] },
    ]) expect(validate(invalid), JSON.stringify(invalid)).toBe(false);
  });

  it('rejects rendered series names and percent signs while accepting canonical bare values', () => {
    const schema = getFieldSelectorInputSchema(
      'nvca-voting-agreement',
      resolveFieldSelectorDir('nvca-voting-agreement'),
    );
    const properties = schema.properties as Record<string, JsonSchema>;
    expect(properties.series_designation.pattern).toBe(fieldValuePattern({
      name: 'series_designation', type: 'string', description: 'Series token',
    }));
    expect(properties.requisite_holders_percentage.pattern).toBe(fieldValuePattern({
      name: 'requisite_holders_percentage', type: 'string', description: 'Bare percent',
    }));

    const coiSchema = getFieldSelectorInputSchema(
      'nvca-certificate-of-incorporation',
      resolveFieldSelectorDir('nvca-certificate-of-incorporation'),
    );
    const coiProperties = coiSchema.properties as Record<string, JsonSchema>;
    expect(coiProperties.redemption_interest_rate.pattern).toBeDefined();
    expect(new RegExp(coiProperties.redemption_interest_rate.pattern as string).test('12%')).toBe(false);

    const seriesPattern = new RegExp(properties.series_designation.pattern as string);
    const percentagePattern = new RegExp(properties.requisite_holders_percentage.pattern as string);
    expect(seriesPattern.test('A')).toBe(true);
    expect(seriesPattern.test('B')).toBe(true);
    expect(seriesPattern.test('C')).toBe(true);
    expect(seriesPattern.test('Series A Preferred Stock')).toBe(false);
    expect(percentagePattern.test('60')).toBe(true);
    expect(percentagePattern.test('60.5')).toBe(true);
    expect(percentagePattern.test('60%')).toBe(false);
  });

  it('applies value-shape checks recursively before fill', () => {
    const fields = [{
      name: 'rows', type: 'array' as const, description: 'Rows', items: [
        { name: 'series_designation', type: 'string' as const, description: 'Series token' },
        { name: 'approval_percentage', type: 'string' as const, description: 'Bare percent' },
      ],
    }];
    expect(() => assertFieldSelectorInputValueShapes({
      rows: [{ series_designation: 'A', approval_percentage: '60' }],
    }, fields)).not.toThrow();
    expect(() => assertFieldSelectorInputValueShapes({
      rows: [{ series_designation: 'Series A Preferred Stock', approval_percentage: '60' }],
    }, fields)).toThrow(/rows\[0\]\.series_designation/);
    expect(() => assertFieldSelectorInputValueShapes({
      rows: [{ series_designation: 'A', approval_percentage: '60%' }],
    }, fields)).toThrow(/rows\[0\]\.approval_percentage/);
  });

  it('fails closed for unknown directories and invalid metadata', () => {
    expect(() => getFieldSelectorInputSchema('missing', '/definitely/missing')).toThrow(/Unknown field-selector/);
    const dir = mkdtempSync(join(tmpdir(), 'oa-invalid-schema-'));
    writeFileSync(join(dir, 'metadata.yaml'), 'name: Broken\nfields: []\n');
    expect(() => getFieldSelectorInputSchema('broken', dir)).toThrow();
    expect(readFileSync(join(dir, 'metadata.yaml'), 'utf8')).toContain('Broken');
  });
});
