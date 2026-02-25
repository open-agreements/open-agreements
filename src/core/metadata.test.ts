import { describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from '../../integration-tests/helpers/allure-test.js';
import {
  TemplateMetadataSchema,
  RecipeMetadataSchema,
  FieldDefinitionSchema,
  CleanConfigSchema,
  GuidanceOutputSchema,
} from './metadata.js';

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
  it.openspec('OA-TMP-020')('accepts a valid string field', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'company_name',
        type: 'string',
        description: 'Company name',
      },
      true
    );
  });

  it.openspec('OA-TMP-003')('rejects enum field without options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'status',
        type: 'enum',
        description: 'Status',
      },
      false
    );
  });

  it.openspec('OA-TMP-020')('accepts enum field with options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'status',
        type: 'enum',
        description: 'Status',
        options: ['active', 'inactive'],
      },
      true
    );
  });

  it.openspec('OA-TMP-020')('rejects enum field with empty options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'status',
        type: 'enum',
        description: 'Status',
        options: [],
      },
      false
    );
  });

  it.openspec('OA-TMP-004')('rejects number field with non-numeric default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'count',
        type: 'number',
        description: 'Count',
        default: 'abc',
      },
      false
    );
  });

  it.openspec('OA-TMP-020')('accepts number field with numeric default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'count',
        type: 'number',
        description: 'Count',
        default: '42',
      },
      true
    );
  });

  it.openspec('OA-TMP-020')('rejects boolean field with invalid default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'active',
        type: 'boolean',
        description: 'Active',
        default: 'yes',
      },
      false
    );
  });
});

describe('TemplateMetadataSchema', () => {
  it.openspec('OA-TMP-009')('accepts valid template metadata', async () => {
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

  it.openspec('OA-TMP-010')('rejects metadata missing required license field', async () => {
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

  it.openspec('OA-TMP-011')('rejects invalid license', async () => {
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

  it.openspec('OA-TMP-021')('rejects unknown required_fields entries', async () => {
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
        fields: [{ name: 'party_name', type: 'string', description: 'Party name' }],
        required_fields: ['missing_field'],
      },
      false
    );
  });

  it.openspec('OA-TMP-021')('rejects duplicate required_fields entries', async () => {
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
        fields: [{ name: 'party_name', type: 'string', description: 'Party name' }],
        required_fields: ['party_name', 'party_name'],
      },
      false
    );
  });
});

describe('RecipeMetadataSchema', () => {
  it.openspec('OA-RCP-014')('accepts valid recipe metadata', async () => {
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

  it.openspec('OA-RCP-015')('rejects missing source_url', async () => {
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

  it.openspec('OA-RCP-042')('defaults optional to false', async () => {
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
  it.openspec('OA-ENG-010')('accepts valid clean config', async () => {
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

  it.openspec('OA-ENG-010')('defaults missing fields', async () => {
    const parsed = await allureStep('Parse empty clean config', () => CleanConfigSchema.parse({}));
    await allureJsonAttachment('clean-config-defaults.json', parsed);

    await allureStep('Assert clean config defaults', () => {
      expect(parsed.removeFootnotes).toBe(false);
      expect(parsed.removeParagraphPatterns).toEqual([]);
    });
  });
});

describe('GuidanceOutputSchema', () => {
  it.openspec('OA-RCP-043')('accepts valid guidance output', async () => {
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

  it.openspec('OA-RCP-043')('rejects missing extractedFrom', async () => {
    await expectSafeParseOutcome(
      'GuidanceOutputSchema',
      GuidanceOutputSchema,
      {
        entries: [],
      },
      false
    );
  });

  it.openspec('OA-RCP-043')('rejects invalid source type', async () => {
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
