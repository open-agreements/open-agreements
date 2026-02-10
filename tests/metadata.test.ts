import { describe, it, expect } from 'vitest';
import { TemplateMetadataSchema, RecipeMetadataSchema, FieldDefinitionSchema, CleanConfigSchema, GuidanceOutputSchema } from '../src/core/metadata.js';

describe('FieldDefinitionSchema', () => {
  it('accepts a valid string field', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'company_name',
      type: 'string',
      description: 'Company name',
      required: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects enum field without options', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'status',
      type: 'enum',
      description: 'Status',
      required: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts enum field with options', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'status',
      type: 'enum',
      description: 'Status',
      required: true,
      options: ['active', 'inactive'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects enum field with empty options', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'status',
      type: 'enum',
      description: 'Status',
      required: true,
      options: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects number field with non-numeric default', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'count',
      type: 'number',
      description: 'Count',
      required: false,
      default: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('accepts number field with numeric default', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'count',
      type: 'number',
      description: 'Count',
      required: false,
      default: '42',
    });
    expect(result.success).toBe(true);
  });

  it('rejects boolean field with invalid default', () => {
    const result = FieldDefinitionSchema.safeParse({
      name: 'active',
      type: 'boolean',
      description: 'Active',
      required: false,
      default: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

describe('TemplateMetadataSchema', () => {
  it('accepts valid template metadata', () => {
    const result = TemplateMetadataSchema.safeParse({
      name: 'Test NDA',
      source_url: 'https://example.com/nda',
      version: '1.0',
      license: 'CC-BY-4.0',
      allow_derivatives: true,
      attribution_text: 'Based on Example NDA',
      fields: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid license', () => {
    const result = TemplateMetadataSchema.safeParse({
      name: 'Test NDA',
      source_url: 'https://example.com/nda',
      version: '1.0',
      license: 'MIT',
      allow_derivatives: true,
      attribution_text: 'Based on Example NDA',
      fields: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('RecipeMetadataSchema', () => {
  it('accepts valid recipe metadata', () => {
    const result = RecipeMetadataSchema.safeParse({
      name: 'NVCA Voting Agreement',
      source_url: 'https://nvca.org/document.docx',
      source_version: '10-1-2025',
      license_note: 'Not redistributable',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing source_url', () => {
    const result = RecipeMetadataSchema.safeParse({
      name: 'NVCA Voting Agreement',
      source_version: '10-1-2025',
      license_note: 'Not redistributable',
    });
    expect(result.success).toBe(false);
  });

  it('defaults optional to false', () => {
    const result = RecipeMetadataSchema.parse({
      name: 'Test',
      source_url: 'https://example.com/doc.docx',
      source_version: '1.0',
      license_note: 'Not redistributable',
    });
    expect(result.optional).toBe(false);
  });
});

describe('CleanConfigSchema', () => {
  it('accepts valid clean config', () => {
    const result = CleanConfigSchema.safeParse({
      removeFootnotes: true,
      removeParagraphPatterns: ['^Note to Drafter:'],
    });
    expect(result.success).toBe(true);
  });

  it('defaults missing fields', () => {
    const result = CleanConfigSchema.parse({});
    expect(result.removeFootnotes).toBe(false);
    expect(result.removeParagraphPatterns).toEqual([]);
  });
});

describe('GuidanceOutputSchema', () => {
  it('accepts valid guidance output', () => {
    const result = GuidanceOutputSchema.safeParse({
      extractedFrom: { sourceHash: 'abc123', configHash: 'def456' },
      entries: [
        { source: 'footnote', part: 'word/footnotes.xml', index: 0, text: 'Some footnote' },
        { source: 'pattern', part: 'word/document.xml', index: 1, text: 'A note' },
        { source: 'range', part: 'word/document.xml', index: 2, text: 'Range text', groupId: 'range-2' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing extractedFrom', () => {
    const result = GuidanceOutputSchema.safeParse({
      entries: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source type', () => {
    const result = GuidanceOutputSchema.safeParse({
      extractedFrom: { sourceHash: 'a', configHash: 'b' },
      entries: [
        { source: 'invalid', part: 'word/document.xml', index: 0, text: 'test' },
      ],
    });
    expect(result.success).toBe(false);
  });
});
