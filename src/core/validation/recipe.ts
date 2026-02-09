import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRecipeMetadata, loadCleanConfig, loadRecipeMetadata } from '../metadata.js';
import { CleanConfigSchema } from '../metadata.js';

export interface RecipeValidationResult {
  recipeId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a recipe directory:
 * - No .docx files (copyrighted content must not be committed)
 * - metadata.yaml validates against schema
 * - For non-scaffold recipes: replacements.json, schema.json, clean.json present and valid
 */
export function validateRecipe(recipeDir: string, recipeId: string): RecipeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for .docx files (forbidden in recipe dirs)
  const files = readdirSync(recipeDir);
  const docxFiles = files.filter((f) => f.toLowerCase().endsWith('.docx'));
  if (docxFiles.length > 0) {
    errors.push(`Copyrighted .docx file(s) found: ${docxFiles.join(', ')}. Recipes must not contain source documents.`);
  }

  // Validate metadata
  const metaResult = validateRecipeMetadata(recipeDir);
  if (!metaResult.valid) {
    errors.push(...metaResult.errors.map((e) => `metadata: ${e}`));
    return { recipeId, valid: false, errors, warnings };
  }

  // Scaffold detection: if only metadata.yaml exists, this is a scaffold — skip further checks
  const hasReplacements = existsSync(join(recipeDir, 'replacements.json'));
  const hasSchema = existsSync(join(recipeDir, 'schema.json'));
  if (!hasReplacements && !hasSchema) {
    return { recipeId, valid: errors.length === 0, errors, warnings };
  }

  // Validate replacements.json
  if (hasReplacements) {
    try {
      const raw = readFileSync(join(recipeDir, 'replacements.json'), 'utf-8');
      const replacements = JSON.parse(raw);
      if (typeof replacements !== 'object' || replacements === null) {
        errors.push('replacements.json must be a JSON object');
      } else {
        for (const [key, value] of Object.entries(replacements)) {
          if (typeof value !== 'string') {
            errors.push(`replacements.json: value for "${key}" must be a string`);
          }
        }
      }
    } catch (err) {
      errors.push(`replacements.json: ${(err as Error).message}`);
    }
  } else {
    warnings.push('replacements.json not found (required for non-scaffold recipes)');
  }

  // Validate schema.json field coverage
  if (hasSchema && hasReplacements) {
    try {
      const schema = JSON.parse(readFileSync(join(recipeDir, 'schema.json'), 'utf-8'));
      const replacements = JSON.parse(readFileSync(join(recipeDir, 'replacements.json'), 'utf-8'));

      const schemaFields = new Set(
        (schema.fields ?? schema).map?.((f: { name: string }) => f.name) ?? Object.keys(schema)
      );

      // Check that replacement targets reference schema fields
      for (const value of Object.values(replacements)) {
        const tagMatch = (value as string).match(/^\{(\w+)\}$/);
        if (tagMatch) {
          const fieldName = tagMatch[1];
          if (!schemaFields.has(fieldName)) {
            warnings.push(`Replacement target {${fieldName}} not found in schema.json`);
          }
        }
      }
    } catch {
      // Already validated above
    }
  }

  // Validate clean.json if present
  const cleanPath = join(recipeDir, 'clean.json');
  if (existsSync(cleanPath)) {
    try {
      const raw = readFileSync(cleanPath, 'utf-8');
      CleanConfigSchema.parse(JSON.parse(raw));
    } catch (err) {
      errors.push(`clean.json: invalid format`);
    }
  }

  return { recipeId, valid: errors.length === 0, errors, warnings };
}
