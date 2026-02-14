import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRecipeMetadata, loadRecipeMetadata } from '../metadata.js';
import { CleanConfigSchema } from '../metadata.js';
import { NormalizeConfigSchema } from '../metadata.js';
import { parseReplacementKey } from '../recipe/replacement-keys.js';
import { ComputedProfileSchema } from '../recipe/computed.js';

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
 * - For non-scaffold recipes: replacements.json present and valid
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
  const metadata = loadRecipeMetadata(recipeDir);
  const metadataFieldNames = new Set(metadata.fields.map((field) => field.name));
  const computedPath = join(recipeDir, 'computed.json');
  const hasReplacements = existsSync(join(recipeDir, 'replacements.json'));
  const isScaffold = !hasReplacements;

  // Validate computed.json if present
  if (existsSync(computedPath)) {
    try {
      const raw = readFileSync(computedPath, 'utf-8');
      ComputedProfileSchema.parse(JSON.parse(raw));
    } catch (err) {
      if (err instanceof Error) {
        errors.push(`computed.json: ${err.message}`);
      } else {
        errors.push('computed.json: invalid format');
      }
    }
  }

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
        const unknownTargets = new Set<string>();
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
                continue;
              }
              const fieldName = token.slice(1, -1);
              if (!metadataFieldNames.has(fieldName)) {
                unknownTargets.add(fieldName);
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
        for (const fieldName of unknownTargets) {
          warnings.push(`Replacement target {${fieldName}} not found in metadata fields`);
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

  // Validate normalize.json if present
  const normalizePath = join(recipeDir, 'normalize.json');
  if (existsSync(normalizePath)) {
    try {
      const raw = readFileSync(normalizePath, 'utf-8');
      NormalizeConfigSchema.parse(JSON.parse(raw));
    } catch {
      errors.push('normalize.json: invalid format');
    }
  }

  // Warn if source_sha256 is missing (fill will skip integrity verification)
  if (!metadata.source_sha256) {
    warnings.push('No source_sha256 in metadata — fill will skip integrity verification');
  }

  return { recipeId, valid: errors.length === 0, scaffold: false, errors, warnings };
}
