import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export const LicenseEnum = z.enum(['CC-BY-4.0', 'CC0-1.0', 'CC-BY-ND-4.0']);
export type License = z.infer<typeof LicenseEnum>;

const FieldTypeEnum = z.enum(['string', 'date', 'number', 'boolean', 'enum', 'array']);
export type FieldType = z.infer<typeof FieldTypeEnum>;

export interface FieldDefinition {
  name: string;
  type: FieldType;
  description: string;
  default?: string;
  default_value_rationale?: string;
  options?: string[];
  section?: string;
  items?: FieldDefinition[];
}

export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: FieldTypeEnum,
    description: z.string(),
    default: z.string().optional(),
    default_value_rationale: z.string().optional(),
    options: z.array(z.string()).optional(),
    section: z.string().optional(),
    items: z.array(FieldDefinitionSchema).nonempty().optional(),
  }).superRefine((field, ctx) => {
    if (field.type === 'enum' && (field.options === undefined || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Fields with type "enum" must have a non-empty options array',
      });
    }

    if (field.items !== undefined && field.type !== 'array') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Only fields with type "array" may define nested items',
      });
    }

    if (field.default !== undefined) {
      if (field.type === 'number' && isNaN(Number(field.default))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['default'],
          message: 'Default value must be valid for the declared field type',
        });
      }

      if (field.type === 'boolean' && field.default !== 'true' && field.default !== 'false') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['default'],
          message: 'Default value must be valid for the declared field type',
        });
      }
    }
  })
);

const TemplateCreditRoleEnum = z.enum([
  'drafter',
  'drafting_editor',
  'reviewer',
  'maintainer',
]);

const TemplateCreditSchema = z.object({
  name: z.string(),
  role: TemplateCreditRoleEnum,
  profile_url: z.string().url().optional(),
});

function validatePriorityFields(
  fields: FieldDefinition[],
  priorityFields: string[],
  ctx: z.RefinementCtx
): void {
  const fieldNames = new Set(fields.map((field) => field.name));
  const seen = new Set<string>();

  priorityFields.forEach((fieldName, index) => {
    if (seen.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority_fields', index],
        message: `Duplicate priority field "${fieldName}"`,
      });
      return;
    }
    seen.add(fieldName);
    if (!fieldNames.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priority_fields', index],
        message: `Priority field "${fieldName}" is not defined in fields`,
      });
    }
  });
}

const TemplateMetadataBaseSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  source_url: z.string().url(),
  version: z.string(),
  license: LicenseEnum,
  allow_derivatives: z.boolean(),
  attribution_text: z.string(),
  fields: z.array(FieldDefinitionSchema),
  priority_fields: z.array(z.string()).default([]),
  credits: z.array(TemplateCreditSchema).default([]),
  derived_from: z.string().optional(),
});

export const TemplateMetadataSchema = TemplateMetadataBaseSchema.superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
});
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

// --- External template schemas ---

export const ExternalMetadataSchema = TemplateMetadataBaseSchema.extend({
  source_sha256: z.string(),
}).superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
});
export type ExternalMetadata = z.infer<typeof ExternalMetadataSchema>;

// --- Recipe schemas ---

export const CleanConfigSchema = z.object({
  removeFootnotes: z.boolean().default(false),
  removeBeforePattern: z.string().optional(),
  removeParagraphPatterns: z.array(z.string()).default([]),
  removeRanges: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).default([]),
  clearParts: z.array(z.string()).default([]),
});
export type CleanConfig = z.infer<typeof CleanConfigSchema>;

export const DeclarativeParagraphNormalizeRuleSchema = z.object({
  id: z.string(),
  section_heading: z.string(),
  section_heading_any: z.array(z.string()).optional(),
  ignore_heading: z.boolean().optional(),
  paragraph_contains: z.string(),
  paragraph_end_contains: z.string().optional(),
  replacements: z.record(z.string(), z.string()).optional(),
  trim_unmatched_trailing_bracket: z.boolean().optional(),
  expected_min_matches: z.number().int().nonnegative().optional(),
});
export type DeclarativeParagraphNormalizeRule = z.infer<typeof DeclarativeParagraphNormalizeRuleSchema>;

export const NormalizeConfigSchema = z.object({
  paragraph_rules: z.array(DeclarativeParagraphNormalizeRuleSchema).default([]),
});
export type NormalizeConfig = z.infer<typeof NormalizeConfigSchema>;

export const GuidanceEntrySchema = z.object({
  source: z.enum(['footnote', 'pattern', 'range']),
  part: z.string(),
  index: z.number(),
  text: z.string(),
  groupId: z.string().optional(),
});
export type GuidanceEntry = z.infer<typeof GuidanceEntrySchema>;

export const GuidanceOutputSchema = z.object({
  extractedFrom: z.object({
    sourceHash: z.string(),
    configHash: z.string(),
  }),
  entries: z.array(GuidanceEntrySchema),
});
export type GuidanceOutput = z.infer<typeof GuidanceOutputSchema>;

const MarketDataCitationSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().optional(),
});

export const RecipeMetadataSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  source_url: z.string().url(),
  source_version: z.string(),
  license_note: z.string(),
  optional: z.boolean().default(false),
  source_sha256: z.string().optional(),
  fields: z.array(FieldDefinitionSchema).default([]),
  priority_fields: z.array(z.string()).default([]),
  market_data_citations: z.array(MarketDataCitationSchema).optional(),
}).superRefine((meta, ctx) => {
  validatePriorityFields(meta.fields, meta.priority_fields, ctx);
});
export type RecipeMetadata = z.infer<typeof RecipeMetadataSchema>;

// --- Template loaders ---

export function loadMetadata(templateDir: string): TemplateMetadata {
  const metadataPath = join(templateDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return TemplateMetadataSchema.parse(parsed);
}

export function validateMetadata(templateDir: string): { valid: boolean; errors: string[] } {
  try {
    loadMetadata(templateDir);
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}

// --- External template loaders ---

export function loadExternalMetadata(externalDir: string): ExternalMetadata {
  const metadataPath = join(externalDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return ExternalMetadataSchema.parse(parsed);
}

export function validateExternalMetadata(externalDir: string): { valid: boolean; errors: string[] } {
  try {
    loadExternalMetadata(externalDir);
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}

// --- Recipe loaders ---

export function loadRecipeMetadata(recipeDir: string): RecipeMetadata {
  const metadataPath = join(recipeDir, 'metadata.yaml');
  const raw = readFileSync(metadataPath, 'utf-8');
  const parsed = yaml.load(raw);
  return RecipeMetadataSchema.parse(parsed);
}

export function loadCleanConfig(recipeDir: string): CleanConfig {
  const cleanPath = join(recipeDir, 'clean.json');
  if (!existsSync(cleanPath)) {
    return { removeFootnotes: false, removeParagraphPatterns: [], removeRanges: [], clearParts: [] };
  }
  const raw = readFileSync(cleanPath, 'utf-8');
  return CleanConfigSchema.parse(JSON.parse(raw));
}

export function loadNormalizeConfig(recipeDir: string): NormalizeConfig {
  const normalizePath = join(recipeDir, 'normalize.json');
  if (!existsSync(normalizePath)) {
    return { paragraph_rules: [] };
  }
  const raw = readFileSync(normalizePath, 'utf-8');
  return NormalizeConfigSchema.parse(JSON.parse(raw));
}

export function validateRecipeMetadata(recipeDir: string): { valid: boolean; errors: string[] } {
  try {
    loadRecipeMetadata(recipeDir);
    return { valid: true, errors: [] };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        valid: false,
        errors: err.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }
    return { valid: false, errors: [(err as Error).message] };
  }
}
