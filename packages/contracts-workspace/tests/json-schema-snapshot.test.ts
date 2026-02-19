import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FormsCatalogSchema, CatalogEntrySchema } from '../src/core/catalog.js';
import { ConventionConfigSchema } from '../src/core/convention-config.js';

const it = itAllure.epic('Compliance & Governance');

describe('JSON Schema generation from Zod', () => {
  describe('key Zod construct mappings', () => {
    it('z.literal(1) produces const: 1', () => {
      const schema = zodToJsonSchema(FormsCatalogSchema, { $refStrategy: 'none' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props.schema_version).toEqual({ type: 'number', const: 1 });
    });

    it('z.string().regex() produces pattern field', () => {
      const schema = zodToJsonSchema(CatalogEntrySchema, { $refStrategy: 'none' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const checksum = props.checksum as Record<string, unknown>;
      const checksumProps = checksum.properties as Record<string, Record<string, unknown>>;
      expect(checksumProps.sha256).toHaveProperty('pattern', '^[a-fA-F0-9]{64}$');
    });

    it('z.string().datetime() produces format: date-time', () => {
      const schema = zodToJsonSchema(FormsCatalogSchema, { $refStrategy: 'none' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props.generated_at).toEqual({ type: 'string', format: 'date-time' });
    });

    it('z.record(z.string(), z.string()) produces additionalProperties', () => {
      const schema = zodToJsonSchema(ConventionConfigSchema, { $refStrategy: 'none' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const lifecycle = props.lifecycle as Record<string, unknown>;
      const lifecycleProps = lifecycle.properties as Record<string, Record<string, unknown>>;
      expect(lifecycleProps.folders).toEqual({
        type: 'object',
        additionalProperties: { type: 'string' },
      });
    });

    it('z.enum() produces enum array', () => {
      const schema = zodToJsonSchema(CatalogEntrySchema, { $refStrategy: 'none' });
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props.destination_lifecycle).toEqual({
        type: 'string',
        enum: ['forms', 'drafts', 'incoming', 'executed', 'archive'],
      });
    });
  });

  describe('full schema snapshots', () => {
    it('FormsCatalogSchema snapshot', () => {
      const schema = zodToJsonSchema(FormsCatalogSchema, { $refStrategy: 'none' });
      expect(schema).toMatchSnapshot();
    });

    it('ConventionConfigSchema snapshot', () => {
      const schema = zodToJsonSchema(ConventionConfigSchema, { $refStrategy: 'none' });
      expect(schema).toMatchSnapshot();
    });
  });
});
