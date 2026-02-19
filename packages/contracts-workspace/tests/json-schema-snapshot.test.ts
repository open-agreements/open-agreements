import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { z } from 'zod';
import { FormsCatalogSchema, CatalogEntrySchema } from '../src/core/catalog.js';
import { ConventionConfigSchema } from '../src/core/convention-config.js';

const it = itAllure.epic('Compliance & Governance');

describe('JSON Schema generation from Zod', () => {
  describe('key Zod construct mappings', () => {
    it('z.literal(1) produces const: 1', () => {
      const schema = z.toJSONSchema(FormsCatalogSchema, { reused: 'inline' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props.schema_version).toEqual({ type: 'number', const: 1 });
    });

    it('z.string().regex() produces pattern field', () => {
      const schema = z.toJSONSchema(CatalogEntrySchema, { reused: 'inline' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const checksum = props.checksum as Record<string, unknown>;
      const checksumProps = checksum.properties as Record<string, Record<string, unknown>>;
      expect(checksumProps.sha256).toHaveProperty('pattern', '^[a-fA-F0-9]{64}$');
    });

    it('z.iso.datetime() produces format: date-time', () => {
      const schema = z.toJSONSchema(FormsCatalogSchema, { reused: 'inline' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props.generated_at).toHaveProperty('type', 'string');
      expect(props.generated_at).toHaveProperty('format', 'date-time');
    });

    it('z.record(z.string(), z.string()) produces additionalProperties', () => {
      const schema = z.toJSONSchema(ConventionConfigSchema, { reused: 'inline' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const lifecycle = props.lifecycle as Record<string, unknown>;
      const lifecycleProps = lifecycle.properties as Record<string, Record<string, unknown>>;
      expect(lifecycleProps.folders).toHaveProperty('type', 'object');
      expect(lifecycleProps.folders).toHaveProperty('additionalProperties', { type: 'string' });
    });

    it('z.enum() produces enum array', () => {
      const schema = z.toJSONSchema(CatalogEntrySchema, { reused: 'inline' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props.destination_lifecycle).toEqual({
        type: 'string',
        enum: ['forms', 'drafts', 'incoming', 'executed', 'archive'],
      });
    });
  });

  describe('full schema snapshots', () => {
    it('FormsCatalogSchema snapshot', () => {
      const schema = z.toJSONSchema(FormsCatalogSchema, { reused: 'inline' });
      expect(schema).toMatchSnapshot();
    });

    it('ConventionConfigSchema snapshot', () => {
      const schema = z.toJSONSchema(ConventionConfigSchema, { reused: 'inline' });
      expect(schema).toMatchSnapshot();
    });
  });
});
