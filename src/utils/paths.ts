import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Root of the open-agreements package */
export function getPackageRoot(): string {
  // From dist/utils/paths.js → go up to package root
  return join(__dirname, '..', '..');
}

/** Resolve a child directory, rejecting path traversal (e.g. "../../etc") */
function resolveChildDir(parentDir: string, childId: string, label: string): string {
  const resolved = resolve(join(parentDir, childId));
  const rel = relative(resolve(parentDir), resolved);
  if (rel.startsWith('..') || rel.startsWith(sep + sep)) {
    throw new Error(`Invalid ${label} ID: ${childId}`);
  }
  return resolved;
}

/** Templates directory */
export function getTemplatesDir(): string {
  return join(getPackageRoot(), 'templates');
}

/** Resolve a specific template directory by ID */
export function resolveTemplateDir(templateId: string): string {
  return resolveChildDir(getTemplatesDir(), templateId, 'template');
}

/** External templates directory */
export function getExternalDir(): string {
  return join(getPackageRoot(), 'external');
}

/** Resolve a specific external template directory by ID */
export function resolveExternalDir(externalId: string): string {
  return resolveChildDir(getExternalDir(), externalId, 'external');
}

/** Recipes directory */
export function getRecipesDir(): string {
  return join(getPackageRoot(), 'recipes');
}

/** Resolve a specific recipe directory by ID */
export function resolveRecipeDir(recipeId: string): string {
  return resolveChildDir(getRecipesDir(), recipeId, 'recipe');
}
