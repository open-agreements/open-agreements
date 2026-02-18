import { join, dirname, resolve, relative, sep, delimiter } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONTENT_ROOTS_ENV = 'OPEN_AGREEMENTS_CONTENT_ROOTS';

export interface ContentEntry {
  id: string;
  dir: string;
  baseDir: string;
}

/** Root of the open-agreements package */
export function getPackageRoot(): string {
  // From dist/utils/paths.js → go up to package root
  return join(__dirname, '..', '..');
}

/** Optional additional content roots. Format is path-delimited, e.g. /a:/b on macOS/Linux. */
export function getContentRoots(): string[] {
  const envRoots = (process.env[CONTENT_ROOTS_ENV] ?? '')
    .split(delimiter)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => resolve(value));

  const roots = [...envRoots, resolve(getPackageRoot())];
  return uniqueOrdered(roots);
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

/** Resolve a content sub-directory, preferring the nested content/ layout. */
function resolveContentDir(root: string, kind: 'templates' | 'external' | 'recipes'): string {
  const nested = join(root, 'content', kind);
  if (existsSync(nested)) return nested;
  return join(root, kind);
}

/** Templates directory */
export function getTemplatesDir(): string {
  return resolveContentDir(getPackageRoot(), 'templates');
}

/** All template directories in precedence order (env roots first, package root last). */
export function getAllTemplatesDirs(): string[] {
  return getContentRoots().map((root) => resolveContentDir(root, 'templates'));
}

/** Resolve a specific template directory by ID */
export function resolveTemplateDir(templateId: string): string {
  return findTemplateDir(templateId) ?? resolveChildDir(getTemplatesDir(), templateId, 'template');
}

/** Find a specific template directory by ID across all configured content roots. */
export function findTemplateDir(templateId: string): string | undefined {
  return findChildDir(getAllTemplatesDirs(), templateId, 'template');
}

/** List template IDs across all content roots (first match wins for duplicates). */
export function listTemplateEntries(): ContentEntry[] {
  return listEntries(getAllTemplatesDirs(), 'template');
}

export function listTemplateIds(): string[] {
  return listTemplateEntries().map((entry) => entry.id);
}

/** External templates directory */
export function getExternalDir(): string {
  return resolveContentDir(getPackageRoot(), 'external');
}

/** All external template directories in precedence order (env roots first, package root last). */
export function getAllExternalDirs(): string[] {
  return getContentRoots().map((root) => resolveContentDir(root, 'external'));
}

/** Resolve a specific external template directory by ID */
export function resolveExternalDir(externalId: string): string {
  return findExternalDir(externalId) ?? resolveChildDir(getExternalDir(), externalId, 'external');
}

/** Find a specific external directory by ID across all configured content roots. */
export function findExternalDir(externalId: string): string | undefined {
  return findChildDir(getAllExternalDirs(), externalId, 'external');
}

/** List external template IDs across all content roots (first match wins for duplicates). */
export function listExternalEntries(): ContentEntry[] {
  return listEntries(getAllExternalDirs(), 'external');
}

export function listExternalIds(): string[] {
  return listExternalEntries().map((entry) => entry.id);
}

/** Recipes directory */
export function getRecipesDir(): string {
  return resolveContentDir(getPackageRoot(), 'recipes');
}

/** All recipe directories in precedence order (env roots first, package root last). */
export function getAllRecipesDirs(): string[] {
  return getContentRoots().map((root) => resolveContentDir(root, 'recipes'));
}

/** Resolve a specific recipe directory by ID */
export function resolveRecipeDir(recipeId: string): string {
  return findRecipeDir(recipeId) ?? resolveChildDir(getRecipesDir(), recipeId, 'recipe');
}

/** Find a specific recipe directory by ID across all configured content roots. */
export function findRecipeDir(recipeId: string): string | undefined {
  return findChildDir(getAllRecipesDirs(), recipeId, 'recipe');
}

/** List recipe IDs across all content roots (first match wins for duplicates). */
export function listRecipeEntries(): ContentEntry[] {
  return listEntries(getAllRecipesDirs(), 'recipe');
}

export function listRecipeIds(): string[] {
  return listRecipeEntries().map((entry) => entry.id);
}

function uniqueOrdered(paths: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of paths) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

function findChildDir(baseDirs: string[], childId: string, label: string): string | undefined {
  for (const baseDir of baseDirs) {
    const resolved = resolveChildDir(baseDir, childId, label);
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  return undefined;
}

function listEntries(baseDirs: string[], label: string): ContentEntry[] {
  const entries: ContentEntry[] = [];
  const seenIds = new Set<string>();

  for (const baseDir of baseDirs) {
    if (!existsSync(baseDir)) {
      continue;
    }

    const ids = readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const id of ids) {
      if (seenIds.has(id)) {
        continue;
      }

      const dir = resolveChildDir(baseDir, id, label);
      entries.push({ id, dir, baseDir });
      seenIds.add(id);
    }
  }

  return entries;
}
