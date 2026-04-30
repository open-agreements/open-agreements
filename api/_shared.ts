/**
 * Shared business logic for A2A and MCP endpoints.
 * File starts with _ so Vercel does not create a route for it.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OA_PACKAGE_VERSION } from './_config.js';

// ---------------------------------------------------------------------------
// Path resolution — must run before any dist/ function calls
// ---------------------------------------------------------------------------

const __shared_dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__shared_dirname, '..');

process.env['OPEN_AGREEMENTS_CONTENT_ROOTS'] = PROJECT_ROOT;
process.env['OPEN_AGREEMENTS_CACHE_ROOT'] ??= join('/tmp', '.open-agreements-cache');

// ---------------------------------------------------------------------------
// Core imports from compiled dist/
// ---------------------------------------------------------------------------

import { fillTemplate } from '../dist/core/engine.js';
import { runExternalFill } from '../dist/core/external/index.js';
import {
  ClosingChecklistSchema,
  buildChecklistTemplateContext,
} from '../dist/core/checklist/index.js';
import {
  loadMetadata,
  loadExternalMetadata,
  loadRecipeMetadata,
} from '../dist/core/metadata.js';
import type { RecipeMetadata } from '../dist/core/metadata.js';
import {
  findTemplateDir,
  findExternalDir,
  listExternalEntries,
  findRecipeDir,
  listRecipeEntries,
} from '../dist/utils/paths.js';
import { runRecipe, ensureSourceDocx } from '../dist/core/recipe/index.js';
import {
  listTemplateItems,
  categoryFromId,
  sourceName,
  mapFields,
  hasTemplateMarkdownSource,
} from '../dist/core/template-listing.js';
export { searchTemplates } from '../dist/core/template-search.js';
export {
  DOWNLOAD_TTL_MS,
  createDownloadArtifact,
  resolveDownloadArtifact,
  initDownloadArtifactStore,
  getDownloadStorageMode,
  DownloadStoreUnavailableError,
  DownloadStoreConfigurationError,
  DownloadStoreRuntimeError,
  type CreatedDownloadArtifact,
  type DownloadArtifact,
  type DownloadArtifactStore,
  type DownloadStorageMode,
  type DownloadStoreInitResult,
  type InitDownloadArtifactStoreDeps,
  type ResolveDownloadArtifactErrorCode,
  type ResolveDownloadArtifactResult,
} from './_download-artifacts.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface FillResultMeta {
  template: string;
  filledFieldCount: number;
  totalFieldCount: number;
  missingFields: string[];
  license: string | null;
  attribution: string | null;
}

export interface FillSuccess {
  ok: true;
  base64: string;
  metadata: FillResultMeta;
}

export interface FillFailure {
  ok: false;
  error: string;
}

export type FillOutcome = FillSuccess | FillFailure;

export interface TemplateItem {
  name: string;
  display_name: string;
  category: string;
  description: string;
  license?: string;
  source_url: string;
  source: string | null;
  attribution_text?: string;
  has_template_md: boolean;
  fields: {
    name: string;
    type: string;
    required: boolean;
    section: string | null;
    description: string;
    display_label: string | null;
    default: string | null;
  }[];
}

export interface ListOutcome {
  cliVersion: string;
  items: TemplateItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawTemplateMetadata {
  name: string;
  category?: string;
  description?: string;
  license?: string;
  source_url: string;
  attribution_text?: string;
  fields: {
    name: string;
    type: string;
    section?: string;
    description: string;
    display_label?: string;
    default?: string;
  }[];
  priority_fields: string[];
}

function toTemplateItem(templateId: string, meta: RawTemplateMetadata, hasTemplateMd = false): TemplateItem {
  return {
    name: templateId,
    display_name: meta.name,
    category: meta.category ?? categoryFromId(templateId),
    description: meta.description ?? meta.name,
    license: meta.license,
    source_url: meta.source_url,
    source: sourceName(meta.source_url),
    attribution_text: meta.attribution_text,
    has_template_md: hasTemplateMd,
    fields: mapFields(meta.fields, meta.priority_fields),
  };
}

function recipeToTemplateItem(recipeId: string, meta: RecipeMetadata): TemplateItem {
  return {
    name: recipeId,
    display_name: meta.name,
    category: meta.category ?? categoryFromId(recipeId),
    description: meta.description ?? meta.name,
    license: meta.license_note,
    source_url: meta.source_url,
    source: sourceName(meta.source_url),
    attribution_text: undefined,
    has_template_md: false,
    fields: mapFields(meta.fields, meta.priority_fields),
  };
}

// ---------------------------------------------------------------------------
// Fill handler — protocol-agnostic
// ---------------------------------------------------------------------------

export async function handleFill(
  template: string,
  values: Record<string, unknown>,
): Promise<FillOutcome> {
  const internalDir = findTemplateDir(template);
  const externalDir = !internalDir ? findExternalDir(template) : undefined;
  const recipeDir = !internalDir && !externalDir ? findRecipeDir(template) : undefined;

  if (!internalDir && !externalDir && !recipeDir) {
    return { ok: false, error: `Unknown template: "${template}"` };
  }

  const outputPath = join('/tmp', `${template}-${randomUUID()}.docx`);

  let meta: { license?: string; attribution_text?: string; fields: { name: string }[] };
  let fieldsUsed: string[];

  if (internalDir) {
    const result = await fillTemplate({ templateDir: internalDir, values, outputPath });
    meta = result.metadata;
    fieldsUsed = result.fieldsUsed;
  } else if (externalDir) {
    const result = await runExternalFill({ externalId: template, values, outputPath });
    meta = result.metadata;
    fieldsUsed = result.fieldsUsed;
  } else {
    const result = await runRecipe({ recipeId: template, outputPath, values });
    meta = result.metadata;
    fieldsUsed = result.fieldsUsed;
  }

  const base64 = readFileSync(outputPath).toString('base64');
  const allFieldNames = meta.fields.map((f) => f.name);
  const providedSet = new Set(Object.keys(values));

  return {
    ok: true,
    base64,
    metadata: {
      template,
      filledFieldCount: fieldsUsed.length,
      totalFieldCount: allFieldNames.length,
      missingFields: allFieldNames.filter((n) => !providedSet.has(n)),
      license: (meta as Record<string, unknown>).license as string ?? null,
      attribution: (meta as Record<string, unknown>).attribution_text as string ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Redline generation — compare source vs filled for recipe templates
// ---------------------------------------------------------------------------

export interface RedlineResult {
  base64: string;
  stats: { insertions: number; deletions: number; modifications: number };
}

/**
 * Generate a redline (track-changes) DOCX comparing a base document
 * against the filled output. Returns null for non-recipe templates.
 *
 * @param redlineBase 'source' = cleaned form (text boxes/commentary stripped, shows
 *                               replacement pattern + field substitution changes)
 *                    'clean'  = patched intermediate (shows only field substitutions)
 * @param values      Re-runs recipe with keepIntermediate to access stage files
 */
export async function generateRedlineFromFill(
  template: string,
  filledBase64: string,
  redlineBase: 'source' | 'clean' = 'source',
  values?: Record<string, unknown>,
): Promise<RedlineResult | null> {
  const recipeDir = findRecipeDir(template);
  if (!recipeDir) return null;

  const { compareDocuments } = await import('@usejunior/docx-core');

  // Run recipe with keepIntermediate to get stage files for comparison base
  const tmpOutput = join('/tmp', `${template}-redline-tmp-${randomUUID()}.docx`);
  const recipeResult = await runRecipe({
    recipeId: template,
    outputPath: tmpOutput,
    values: (values ?? {}) as Record<string, string | boolean>,
    keepIntermediate: true,
  });

  // 'source' → cleaned stage: text boxes and commentary removed, but replacement
  //            patterns and field placeholders still intact. Shows all legal text
  //            changes. (Raw source can't be used because compareDocuments doesn't
  //            diff text box/shape elements — they pass through untouched.)
  // 'clean'  → patched stage: replacement patterns applied ({field_name} tokens),
  //            shows only field value substitutions.
  const basePath = redlineBase === 'clean'
    ? recipeResult.stages.patch
    : recipeResult.stages.clean;
  const baseBuffer = readFileSync(basePath);

  const filledBuffer = Buffer.from(filledBase64, 'base64');
  const compareResult = await compareDocuments(baseBuffer, filledBuffer, {
    author: 'Open Agreements',
  });

  return {
    base64: compareResult.document.toString('base64'),
    stats: {
      insertions: compareResult.stats.insertions,
      deletions: compareResult.stats.deletions,
      modifications: compareResult.stats.modifications,
    },
  };
}

// ---------------------------------------------------------------------------
// Create checklist handler — protocol-agnostic
// ---------------------------------------------------------------------------

export async function handleCreateChecklist(
  data: Record<string, unknown>,
): Promise<FillOutcome> {
  const parsed = ClosingChecklistSchema.safeParse(data);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `Invalid closing checklist payload: ${message}` };
  }
  return handleFill('closing-checklist', buildChecklistTemplateContext(parsed.data));
}

// ---------------------------------------------------------------------------
// List handler — protocol-agnostic
// ---------------------------------------------------------------------------

export function handleGetTemplate(templateId: string): TemplateItem | null {
  const internalDir = findTemplateDir(templateId);
  if (internalDir) {
    try {
      const meta = loadMetadata(internalDir) as RawTemplateMetadata;
      return toTemplateItem(templateId, meta, hasTemplateMarkdownSource(internalDir));
    } catch {
      return null;
    }
  }

  const externalDir = findExternalDir(templateId);
  if (externalDir) {
    try {
      const meta = loadExternalMetadata(externalDir) as RawTemplateMetadata;
      return toTemplateItem(templateId, meta, false);
    } catch {
      return null;
    }
  }

  const recipeDir = findRecipeDir(templateId);
  if (recipeDir) {
    try {
      const meta = loadRecipeMetadata(recipeDir);
      return recipeToTemplateItem(templateId, meta);
    } catch {
      return null;
    }
  }

  return null;
}

export function handleListTemplates(): ListOutcome {
  // Internal templates via shared module (sorted, errors skipped)
  const internal: TemplateItem[] = listTemplateItems({ templatesOnly: true }) as TemplateItem[];

  // External templates (not covered by listTemplateItems)
  const external: TemplateItem[] = [];
  for (const entry of listExternalEntries()) {
    try {
      const meta = loadExternalMetadata(entry.dir) as RawTemplateMetadata;
      external.push(toTemplateItem(entry.id, meta, false));
    } catch { /* skip */ }
  }

  const recipes: TemplateItem[] = [];
  for (const entry of listRecipeEntries()) {
    try {
      const meta = loadRecipeMetadata(entry.dir);
      recipes.push(recipeToTemplateItem(entry.id, meta));
    } catch { /* skip */ }
  }

  const items = [...internal, ...external, ...recipes].sort((a, b) => a.name.localeCompare(b.name));

  return { cliVersion: OA_PACKAGE_VERSION, items };
}
