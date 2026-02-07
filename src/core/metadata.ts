import { z } from 'zod';
import { readFileSync } from 'node:fs';
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
});
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
