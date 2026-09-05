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
  getFieldSelectorInputSchema,
  type JsonSchema,
} from './input-schema.js';
import { loadComputedProfile } from './computed.js';
import { loadFieldSelectorMetadata } from '../metadata.js';
import { listFieldSelectorIds, resolveFieldSelectorDir } from '../../utils/paths.js';

const NVCA_GOLDEN_HASHES: Record<string, string> = {
  'nvca-certificate-of-incorporation': '532a0ce6922a8baa2097881f68ac139e68e91c331c44a375f5b415dfd53b4f3e',
  'nvca-indemnification-agreement': '378070ff3d36bffc460b6b7d95a29f1c950c88f724fe90484260108900ac0b9b',
  'nvca-investors-rights-agreement': '054fa5f41f4355c65a1054ffb9aa11dadbe1497fbd19ddd2b6e3c09c3003525b',
  'nvca-management-rights-letter': 'b0b62fcf846b49166a6c7045b6134cc4ca24dda6b07f459145b12324597cedf1',
  'nvca-rofr-co-sale-agreement': 'a202c5bd4d08abafd5f67854e0a0ded2c0254d9a20c272022c50c6dc70f8c3b9',
  'nvca-stock-purchase-agreement': '1fd6470a5f1b2280633f804de230ee6ecb6e936aa4e9dec25674fa0f7d97efe9',
  'nvca-voting-agreement': '6959d714c6c0a444d8ea80e3558af516fa9bcf3ffdf95caccfa650ab9204fa63',
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

  it('fails closed for unknown directories and invalid metadata', () => {
    expect(() => getFieldSelectorInputSchema('missing', '/definitely/missing')).toThrow(/Unknown field-selector/);
    const dir = mkdtempSync(join(tmpdir(), 'oa-invalid-schema-'));
    writeFileSync(join(dir, 'metadata.yaml'), 'name: Broken\nfields: []\n');
    expect(() => getFieldSelectorInputSchema('broken', dir)).toThrow();
    expect(readFileSync(join(dir, 'metadata.yaml'), 'utf8')).toContain('Broken');
  });
});
