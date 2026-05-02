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

  it('accepts an optional display_label on fields', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'company_name',
        type: 'string',
        description: 'Company name',
        display_label: 'Company Name',
      },
      true
    );
  });

  it('rejects a null display_label on fields', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'company_name',
        type: 'string',
        description: 'Company name',
        display_label: null,
      },
      false
    );
  });

  it.openspec('OA-TMP-028')('accepts an array field with nested item schema', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'signers',
        type: 'array',
        description: 'Signers on the document',
        items: [
          {
            name: 'name',
            type: 'string',
            description: 'Printed signer name',
          },
          {
            name: 'title',
            type: 'string',
            description: 'Printed signer title',
            default: '',
          },
        ],
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

  it('rejects nested items on non-array fields', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'company_name',
        type: 'string',
        description: 'Company name',
        items: [
          {
            name: 'nested',
            type: 'string',
            description: 'Should not be allowed',
          },
        ],
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

  it.openspec('OA-TMP-021')('rejects unknown priority_fields entries', async () => {
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
        priority_fields: ['missing_field'],
      },
      false
    );
  });

  it.openspec('OA-TMP-021')('rejects duplicate priority_fields entries', async () => {
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
        priority_fields: ['party_name', 'party_name'],
      },
      false
    );
  });

  it.openspec('OA-TMP-029')('accepts valid credits and derived_from', async () => {
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      {
        name: 'Test Consent',
        source_url: 'https://example.com/consent',
        version: '1.0',
        license: 'CC-BY-4.0',
        allow_derivatives: true,
        attribution_text: 'Based on Example Consent',
        fields: [],
        credits: [
          {
            name: 'Joey Tsang',
            role: 'drafting_editor',
            profile_url: 'https://www.linkedin.com/in/joey-t-b90912b1/',
          },
        ],
        derived_from: 'Publicly available Series Seed SAFE board consent materials',
      },
      true
    );
  });

  it.openspec('OA-TMP-030')('defaults missing credits to empty array', async () => {
    const parsed = await allureStep('Parse template metadata without credits', () =>
      TemplateMetadataSchema.parse({
        name: 'Test NDA',
        source_url: 'https://example.com/nda',
        version: '1.0',
        license: 'CC-BY-4.0',
        allow_derivatives: true,
        attribution_text: 'Based on Example NDA',
        fields: [],
      })
    );
    await allureJsonAttachment('template-metadata-credits-default.json', parsed);
    await allureStep('Assert credits defaults to empty array', () => {
      expect(parsed.credits).toEqual([]);
      expect(parsed.derived_from).toBeUndefined();
    });
  });

  it.openspec('OA-TMP-031')('rejects credit role outside the closed enum', async () => {
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
        credits: [{ name: 'Author X', role: 'author' }],
      },
      false
    );
  });

  it.openspec('OA-TMP-031')('rejects non-string derived_from', async () => {
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
        derived_from: 42,
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
