import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export const LicenseEnum = z.enum(['CC-BY-4.0', 'CC0-1.0']);
export type License = z.infer<typeof LicenseEnum>;

export const FieldDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'date', 'number', 'boolean', 'enum']),
  description: z.string(),
  required: z.boolean(),
  default: z.string().optional(),
  options: z.array(z.string()).optional(),
  section: z.string().optional(),
}).refine(
  (f) => f.type !== 'enum' || (f.options !== undefined && f.options.length > 0),
  { message: 'Fields with type "enum" must have a non-empty options array' }
).refine(
  (f) => {
    if (f.default === undefined) return true;
    if (f.type === 'number') return !isNaN(Number(f.default));
    if (f.type === 'boolean') return f.default === 'true' || f.default === 'false';
    return true;
  },
  { message: 'Default value must be valid for the declared field type' }
);
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

export const TemplateMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  source_url: z.string().url(),
  version: z.string(),
  license: LicenseEnum,
  allow_derivatives: z.boolean(),
  attribution_text: z.string(),
  fields: z.array(FieldDefinitionSchema),
});
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

// --- Recipe schemas ---

export const CleanConfigSchema = z.object({
  removeFootnotes: z.boolean().default(false),
  removeParagraphPatterns: z.array(z.string()).default([]),
});
export type CleanConfig = z.infer<typeof CleanConfigSchema>;

export const RecipeMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  source_url: z.string().url(),
  source_version: z.string(),
  license_note: z.string(),
  optional: z.boolean().default(false),
  fields: z.array(FieldDefinitionSchema).default([]),
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
    return { removeFootnotes: false, removeParagraphPatterns: [] };
  }
  const raw = readFileSync(cleanPath, 'utf-8');
  return CleanConfigSchema.parse(JSON.parse(raw));
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
