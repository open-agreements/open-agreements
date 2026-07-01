import { describe, expect } from 'vitest';
import {
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from '../../integration-tests/helpers/allure-test.js';
import {
  TemplateMetadataSchema,
  ExternalMetadataSchema,
  FieldSelectorMetadataSchema,
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
  it('accepts a valid string field', async () => {
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

  it('accepts an array field with nested item schema', async () => {
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

  it('accepts a well-formed statutory_compliance_representation field', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'boolean',
        description: 'CONFIRM-BEFORE-SIGNING: set true only if the advance notice was actually given.',
        statutory_compliance_representation: true,
        authority_url: 'https://www.flsenate.gov/Laws/Statutes/2025/542.45',
        confirm_note: 'the advance notice was actually given before signing',
        default: 'false',
      },
      true
    );
  });

  it('rejects a non-boolean statutory_compliance_representation field', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'string',
        description: 'Should be boolean',
        statutory_compliance_representation: true,
        authority_url: 'https://example.com/statute',
        confirm_note: 'note',
        default: 'false',
      },
      false
    );
  });

  it('rejects a statutory_compliance_representation field defaulting to true', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'boolean',
        description: 'Must default false',
        statutory_compliance_representation: true,
        authority_url: 'https://example.com/statute',
        confirm_note: 'note',
        default: 'true',
      },
      false
    );
  });

  it('rejects a statutory_compliance_representation field without authority_url', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'boolean',
        description: 'Missing authority_url',
        statutory_compliance_representation: true,
        confirm_note: 'note',
        default: 'false',
      },
      false
    );
  });

  it('rejects an http-less authority_url on a statutory_compliance_representation field', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'boolean',
        description: 'Bad URL',
        statutory_compliance_representation: true,
        authority_url: 'flsenate.gov/542.45',
        confirm_note: 'note',
        default: 'false',
      },
      false
    );
  });

  it('rejects authority_url on a field that is not a statutory_compliance_representation', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'some_flag',
        type: 'boolean',
        description: 'authority_url is scoped to statutory_compliance_representation fields',
        authority_url: 'https://example.com/statute',
        default: 'false',
      },
      false
    );
  });

  it('rejects a statutory_compliance_representation field without confirm_note', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'boolean',
        description: 'Missing confirm_note',
        statutory_compliance_representation: true,
        authority_url: 'https://example.com/statute',
        default: 'false',
      },
      false
    );
  });

  it('rejects a blank confirm_note on a statutory_compliance_representation field', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'advance_notice_confirmed',
        type: 'boolean',
        description: 'Blank confirm_note',
        statutory_compliance_representation: true,
        authority_url: 'https://example.com/statute',
        confirm_note: '   ',
        default: 'false',
      },
      false
    );
  });

  it('rejects confirm_note on a field that is not a statutory_compliance_representation', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'some_flag',
        type: 'boolean',
        description: 'confirm_note is scoped to statutory_compliance_representation fields',
        confirm_note: 'orphan note',
        default: 'false',
      },
      false
    );
  });

  it('rejects enum field without options', async () => {
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

  it('accepts enum field with options', async () => {
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

  it('rejects enum field with empty options', async () => {
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

  it('accepts a multiselect field with options, derive_booleans, and JSON default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'cross_border_rider'],
        derive_booleans: true,
        default: '["tech_rider"]',
      },
      true
    );
  });

  it('rejects multiselect fields without options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
      },
      false
    );
  });

  it('rejects multiselect options that are not valid identifiers', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech-rider', 'cross border'],
      },
      false
    );
  });

  it('rejects duplicate multiselect options', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'tech_rider'],
      },
      false
    );
  });

  it('rejects derive_booleans on non-multiselect fields', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'tech_rider_enabled',
        type: 'boolean',
        description: 'Tech rider toggle',
        derive_booleans: true,
      },
      false
    );
  });

  it('accepts an empty multiselect JSON default', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'cross_border_rider'],
        default: '[]',
      },
      true
    );
  });

  it('rejects multiselect defaults outside the options allowlist', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'cross_border_rider'],
        default: '["unknown_rider"]',
      },
      false
    );
  });

  it('rejects malformed multiselect JSON defaults', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'cross_border_rider'],
        default: 'not-json',
      },
      false
    );
  });

  it('rejects multiselect defaults with non-string entries', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'cross_border_rider'],
        default: '[null]',
      },
      false
    );
  });

  it('rejects multiselect defaults with duplicate entries', async () => {
    await expectSafeParseOutcome(
      'FieldDefinitionSchema',
      FieldDefinitionSchema,
      {
        name: 'industry_modules',
        type: 'multiselect',
        description: 'Industry riders',
        options: ['tech_rider', 'cross_border_rider'],
        default: '["tech_rider","tech_rider"]',
      },
      false
    );
  });

  it('rejects number field with non-numeric default', async () => {
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

  it('accepts number field with numeric default', async () => {
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

  it('rejects boolean field with invalid default', async () => {
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

const BASE_TEMPLATE_METADATA = {
  name: 'Test NDA',
  source_url: 'https://example.com/nda',
  version: '1.0',
  license: 'CC-BY-4.0' as const,
  allow_derivatives: true,
  attribution_text: 'Based on Example NDA',
};

function buildTemplateMetadataPayload(fields: unknown[]) {
  return {
    ...BASE_TEMPLATE_METADATA,
    fields,
  };
}

function buildExternalMetadataPayload(fields: unknown[]) {
  return {
    ...BASE_TEMPLATE_METADATA,
    source_sha256: 'a'.repeat(64),
    fields,
  };
}

function buildFieldSelectorMetadataPayload(fields: unknown[]) {
  return {
    name: 'Fixture FieldSelector',
    source_url: 'https://example.com/source.docx',
    source_version: '1.0',
    license_note: 'Not redistributable',
    fields,
  };
}

describe('TemplateMetadataSchema', () => {
  it('accepts valid template metadata', async () => {
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

  it('rejects metadata missing required license field', async () => {
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

  it('rejects metadata with empty or whitespace-only name', async () => {
    // Empty name fails — schema-level guard for the list_templates display_name contract.
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      {
        name: '',
        source_url: 'https://example.com/nda',
        version: '1.0',
        license: 'CC-BY-4.0',
        allow_derivatives: true,
        attribution_text: 'Based on Example NDA',
        fields: [],
      },
      false
    );
    // Whitespace-only name also fails (.trim().min(1)).
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      {
        name: '   ',
        source_url: 'https://example.com/nda',
        version: '1.0',
        license: 'CC-BY-4.0',
        allow_derivatives: true,
        attribution_text: 'Based on Example NDA',
        fields: [],
      },
      false
    );
  });

  it('FieldSelectorMetadataSchema rejects empty name', async () => {
    await expectSafeParseOutcome(
      'FieldSelectorMetadataSchema',
      FieldSelectorMetadataSchema,
      {
        name: '',
        source_url: 'https://example.com/fieldSelector',
        source_version: '1.0',
        license_note: 'Public domain',
      },
      false
    );
  });

  it('rejects top-level field collisions with derived boolean keys', async () => {
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      buildTemplateMetadataPayload([
        {
          name: 'industry_modules',
          type: 'multiselect',
          description: 'Industry riders',
          options: ['tech_rider'],
          derive_booleans: true,
        },
        {
          name: 'tech_rider_enabled',
          type: 'boolean',
          description: 'Conflicting top-level field',
        },
      ]),
      false
    );
  });

  it('rejects derived key collisions between multiselect fields', async () => {
    await expectSafeParseOutcome(
      'TemplateMetadataSchema',
      TemplateMetadataSchema,
      buildTemplateMetadataPayload([
        {
          name: 'industry_modules',
          type: 'multiselect',
          description: 'Industry riders',
          options: ['tech_rider'],
          derive_booleans: true,
        },
        {
          name: 'additional_modules',
          type: 'multiselect',
          description: 'Additional riders',
          options: ['tech_rider'],
          derive_booleans: true,
        },
      ]),
      false
    );
  });

  it('rejects invalid license', async () => {
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

  it('rejects unknown priority_fields entries', async () => {
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

  it('rejects duplicate priority_fields entries', async () => {
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

  it('accepts valid credits and derived_from', async () => {
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

  it('defaults missing credits to empty array', async () => {
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

  it('rejects credit role outside the closed enum', async () => {
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

  it('rejects non-string derived_from', async () => {
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

describe('FieldSelectorMetadataSchema', () => {
  it('accepts valid fieldSelector metadata', async () => {
    await expectSafeParseOutcome(
      'FieldSelectorMetadataSchema',
      FieldSelectorMetadataSchema,
      {
        name: 'NVCA Voting Agreement',
        source_url: 'https://nvca.org/document.docx',
        source_version: '10-1-2025',
        license_note: 'Not redistributable',
      },
      true
    );
  });

  it('rejects missing source_url', async () => {
    await expectSafeParseOutcome(
      'FieldSelectorMetadataSchema',
      FieldSelectorMetadataSchema,
      {
        name: 'NVCA Voting Agreement',
        source_version: '10-1-2025',
        license_note: 'Not redistributable',
      },
      false
    );
  });

  it('defaults optional to false', async () => {
    const parsed = await allureStep('Parse fieldSelector metadata with optional omitted', () =>
      FieldSelectorMetadataSchema.parse({
        name: 'Test',
        source_url: 'https://example.com/doc.docx',
        source_version: '1.0',
        license_note: 'Not redistributable',
      })
    );
    await allureJsonAttachment('field-selector-metadata-parse-output.json', parsed);

    await allureStep('Assert optional defaults to false', () => {
      expect(parsed.optional).toBe(false);
    });
  });

  it('rejects derived key collisions in external metadata', async () => {
    await expectSafeParseOutcome(
      'ExternalMetadataSchema',
      ExternalMetadataSchema,
      buildExternalMetadataPayload([
        {
          name: 'industry_modules',
          type: 'multiselect',
          description: 'Industry riders',
          options: ['tech_rider'],
          derive_booleans: true,
        },
        {
          name: 'tech_rider_enabled',
          type: 'boolean',
          description: 'Conflicting top-level field',
        },
      ]),
      false
    );
  });

  it('rejects derived key collisions in fieldSelector metadata', async () => {
    await expectSafeParseOutcome(
      'FieldSelectorMetadataSchema',
      FieldSelectorMetadataSchema,
      buildFieldSelectorMetadataPayload([
        {
          name: 'industry_modules',
          type: 'multiselect',
          description: 'Industry riders',
          options: ['tech_rider'],
          derive_booleans: true,
        },
        {
          name: 'tech_rider_enabled',
          type: 'boolean',
          description: 'Conflicting top-level field',
        },
      ]),
      false
    );
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
