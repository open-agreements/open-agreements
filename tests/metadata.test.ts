import { describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';
import {
  TemplateMetadataSchema,
  RecipeMetadataSchema,
  FieldDefinitionSchema,
  CleanConfigSchema,
  GuidanceOutputSchema,
} from '../src/core/metadata.js';

type SafeParseSchema = {
  safeParse: (payload: unknown) => { success: boolean };
};
const it = itAllure.epic('Discovery & Metadata');

async function expectSafeParseOutcome(
  schemaName: string,
  schema: SafeParseSchema,
  payload: unknown,
  shouldSucceed: boolean
): Promise<void> {
  await allureParameter('schema', schemaName);
  await allureJsonAttachment(`${schemaName}-input.json`, payload);

  const result = await allureStep(`safeParse with ${schemaName}`, () => schema.safeParse(payload));
  await allureJsonAttachment(`${schemaName}-result.json`, result);

  await allureStep(`Assert ${schemaName} parse outcome`, () => {
    expect(result.success).toBe(shouldSucceed);
  });
}

describe('FieldDefinitionSchema', () => {
  it('accepts a valid string field', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'company_name',
        type: 'string',
        description: 'Company name',
        required: true,
      },
      true
    );
  });

  it.openspec('OA-007')('rejects enum field without options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'status',
        type: 'enum',
        description: 'Status',
        required: true,
      },
      false
    );
  });

  it('accepts enum field with options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'status',
        type: 'enum',
        description: 'Status',
        required: true,
        options: ['active', 'inactive'],
      },
      true
    );
  });

  it('rejects enum field with empty options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'status',
        type: 'enum',
        description: 'Status',
        required: true,
        options: [],
      },
      false
    );
  });

  it.openspec('OA-008')('rejects number field with non-numeric default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'count',
        type: 'number',
        description: 'Count',
        required: false,
        default: 'abc',
      },
      false
    );
  });

  it('accepts number field with numeric default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'count',
        type: 'number',
        description: 'Count',
        required: false,
        default: '42',
      },
      true
    );
  });

  it('rejects boolean field with invalid default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'active',
        type: 'boolean',
        description: 'Active',
        required: false,
        default: 'yes',
      },
      false
    );
  });
});

describe('TemplateMetadataSchema', () => {
  it.openspec('OA-038')('accepts valid template metadata', async () => {
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      {
        name: 'Test NDA',
        source_url: 'https://example.com/nda',
        version: '1.0',
        license: 'CC-BY-4.0',
        allow_derivatives: true,
        attribution_text: 'Based on Example NDA',
        fields: [],
      },
      true
    );
  });

  it.openspec('OA-039')('rejects metadata missing required license field', async () => {
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      {
        name: 'Test NDA',
        source_url: 'https://example.com/nda',
        version: '1.0',
        allow_derivatives: true,
        attribution_text: 'Based on Example NDA',
        fields: [],
      },
      false
    );
  });

  it.openspec('OA-040')('rejects invalid license', async () => {
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      {
        name: 'Test NDA',
        source_url: 'https://example.com/nda',
        version: '1.0',
        license: 'MIT',
        allow_derivatives: true,
        attribution_text: 'Based on Example NDA',
        fields: [],
      },
      false
    );
  });
});

describe('RecipeMetadataSchema', () => {
  it.openspec('OA-029')('accepts valid recipe metadata', async () => {
    await expectSafeParseOutcome(
      'RecipeMetadataSchema',
      RecipeMetadataSchema,
      {
        name: 'NVCA Voting Agreement',
        source_url: 'https://nvca.org/document.docx',
        source_version: '10-1-2025',
        license_note: 'Not redistributable',
      },
      true
    );
  });

  it.openspec('OA-030')('rejects missing source_url', async () => {
    await expectSafeParseOutcome(
      'RecipeMetadataSchema',
      RecipeMetadataSchema,
      {
        name: 'NVCA Voting Agreement',
        source_version: '10-1-2025',
        license_note: 'Not redistributable',
      },
      false
    );
  });

  it('defaults optional to false', async () => {
    const parsed = await allureStep('Parse recipe metadata with optional omitted', () =>
      RecipeMetadataSchema.parse({
        name: 'Test',
        source_url: 'https://example.com/doc.docx',
        source_version: '1.0',
        license_note: 'Not redistributable',
      })
    );
    await allureJsonAttachment('recipe-metadata-parse-output.json', parsed);

    await allureStep('Assert optional defaults to false', () => {
      expect(parsed.optional).toBe(false);
    });
  });
});

describe('CleanConfigSchema', () => {
  it('accepts valid clean config', async () => {
    await expectSafeParseOutcome(
      'CleanConfigSchema',
      CleanConfigSchema,
      {
        removeFootnotes: true,
        removeParagraphPatterns: ['^Note to Drafter:'],
      },
      true
    );
  });

  it('defaults missing fields', async () => {
    const parsed = await allureStep('Parse empty clean config', () => CleanConfigSchema.parse({}));
    await allureJsonAttachment('clean-config-defaults.json', parsed);

    await allureStep('Assert clean config defaults', () => {
      expect(parsed.removeFootnotes).toBe(false);
      expect(parsed.removeParagraphPatterns).toEqual([]);
    });
  });
});

describe('GuidanceOutputSchema', () => {
  it('accepts valid guidance output', async () => {
    await expectSafeParseOutcome(
      'GuidanceOutputSchema',
      GuidanceOutputSchema,
      {
        extractedFrom: { sourceHash: 'abc123', configHash: 'def456' },
        entries: [
          { source: 'footnote', part: 'word/footnotes.xml', index: 0, text: 'Some footnote' },
          { source: 'pattern', part: 'word/document.xml', index: 1, text: 'A note' },
          { source: 'range', part: 'word/document.xml', index: 2, text: 'Range text', groupId: 'range-2' },
        ],
      },
      true
    );
  });

  it('rejects missing extractedFrom', async () => {
    await expectSafeParseOutcome(
      'GuidanceOutputSchema',
      GuidanceOutputSchema,
      {
        entries: [],
      },
      false
    );
  });

  it('rejects invalid source type', async () => {
    await expectSafeParseOutcome(
      'GuidanceOutputSchema',
      GuidanceOutputSchema,
      {
        extractedFrom: { sourceHash: 'a', configHash: 'b' },
        entries: [
          { source: 'invalid', part: 'word/document.xml', index: 0, text: 'test' },
        ],
      },
      false
    );
  });
});
