import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRecipeMetadata, loadRecipeMetadata } from '../metadata.js';
import { CleanConfigSchema } from '../metadata.js';
import { parseReplacementKey } from '../recipe/replacement-keys.js';

export interface RecipeValidationResult {
  recipeId: string;
  valid: boolean;
  scaffold: boolean;
  errors: string[];
  warnings: string[];
}

/** Pattern for valid template tags within replacement values */
const TAG_RE = /\{[a-z_][a-z0-9_]*\}/g;
/** Pattern for any curly-brace token (to detect control tags) */
const ANY_BRACE_RE = /\{[^}]+\}/g;
/** Only simple identifiers inside braces are allowed */
const SAFE_TAG_RE = /^\{[a-z_][a-z0-9_]*\}$/;

/**
 * Validate a recipe directory:
 * - No .docx files (copyrighted content must not be committed)
 * - metadata.yaml validates against schema
 * - For non-scaffold recipes: replacements.json, schema.json present and valid
 * - Replacement values must be valid {identifier} tags
 * - In strict mode: scaffolds are errors, all files required
 */
export function validateRecipe(
  recipeDir: string,
  recipeId: string,
  options?: { strict?: boolean }
): RecipeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = options?.strict ?? false;

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
    return { recipeId, valid: false, scaffold: false, errors, warnings };
  }

  // Scaffold detection: if only metadata.yaml exists, this is a scaffold
  const hasReplacements = existsSync(join(recipeDir, 'replacements.json'));
  const hasSchema = existsSync(join(recipeDir, 'schema.json'));
  const isScaffold = !hasReplacements && !hasSchema;

  if (isScaffold) {
    if (strict) {
      errors.push('Scaffold recipe (metadata-only): not runnable. Use non-strict mode to allow scaffolds.');
    } else {
      warnings.push('Scaffold recipe (metadata-only): not runnable');
    }
    return { recipeId, valid: errors.length === 0, scaffold: true, errors, warnings };
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
            continue;
          }

          // Value must contain at least one {identifier} tag
          const tags = value.match(TAG_RE);
          if (!tags || tags.length === 0) {
            errors.push(
              `replacements.json: value for "${key}" must contain at least one {identifier} tag, got "${value}"`
            );
          }

          // All curly-brace tokens in value must be safe identifiers (no control tags)
          const allBraces = value.match(ANY_BRACE_RE);
          if (allBraces) {
            for (const token of allBraces) {
              if (!SAFE_TAG_RE.test(token)) {
                errors.push(
                  `replacements.json: unsafe tag "${token}" in value for "${key}". Only {identifier} tags allowed.`
                );
              }
            }
          }

          // Value must not contain the source key (infinite loop prevention)
          // For qualified keys, check against the searchText, not the full key.
          // Nth keys use single-shot replacement so they can't loop — skip the check.
          const parsed = parseReplacementKey(key, value);
          if (parsed.type === 'simple' && value.includes(parsed.searchText)) {
            errors.push(
              `replacements.json: value for "${key}" contains the key itself (would cause infinite loop)`
            );
          } else if (parsed.type === 'context' && value.includes(parsed.searchText)) {
            errors.push(
              `replacements.json: value for "${key}" contains the search text "${parsed.searchText}" (would cause infinite loop)`
            );
          }
          // nth keys: no infinite-loop check needed (single-shot replacement)
        }
      }
    } catch (err) {
      errors.push(`replacements.json: ${(err as Error).message}`);
    }
  } else {
    if (strict) {
      errors.push('replacements.json not found (required for runnable recipes)');
    } else {
      warnings.push('replacements.json not found (required for runnable recipes)');
    }
  }

  // schema.json is required for non-scaffold recipes
  if (!hasSchema) {
    if (strict) {
      errors.push('schema.json not found (required for runnable recipes)');
    } else {
      warnings.push('schema.json not found (required for runnable recipes)');
    }
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
    } catch {
      errors.push(`clean.json: invalid format`);
    }
  }

  // Warn if source_sha256 is missing (fill will skip integrity verification)
  try {
    const meta = loadRecipeMetadata(recipeDir);
    if (!meta.source_sha256) {
      warnings.push('No source_sha256 in metadata — fill will skip integrity verification');
    }
  } catch {
    // metadata validation already handled above
  }

  return { recipeId, valid: errors.length === 0, scaffold: false, errors, warnings };
}
