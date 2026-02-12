import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRecipeMetadata, loadCleanConfig } from '../metadata.js';
import { resolveRecipeDir } from '../../utils/paths.js';
import { verifyOutput } from './verifier.js';
import { ensureSourceDocx } from './downloader.js';
import { runFillPipeline } from '../unified-pipeline.js';
import type { RecipeRunOptions, RecipeRunResult } from './types.js';

/**
 * Run the full recipe pipeline: clean → patch → fill → verify.
 * If no inputPath is provided, auto-downloads the source document from source_url.
 */
export async function runRecipe(options: RecipeRunOptions): Promise<RecipeRunResult> {
  const { recipeId, outputPath, values, keepIntermediate } = options;
  const recipeDir = resolveRecipeDir(recipeId);

  const metadata = loadRecipeMetadata(recipeDir);
  const cleanConfig = loadCleanConfig(recipeDir);

  // Resolve input: explicit path or auto-download
  const inputPath = options.inputPath ?? await ensureSourceDocx(recipeId, metadata);

  // Load replacements.json
  const replacementsPath = join(recipeDir, 'replacements.json');
  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));

  const result = await runFillPipeline({
    inputPath,
    outputPath,
    values,
    fields: metadata.fields,
    requiredFieldNames: metadata.required_fields,
    cleanPatch: { cleanConfig, replacements },
    verify: (p) => verifyOutput(p, values, replacements, cleanConfig),
    keepIntermediate,
  });

  return {
    outputPath: result.outputPath,
    metadata,
    fieldsUsed: result.fieldsUsed,
    stages: result.stages!,
  };
}

export { cleanDocument } from './cleaner.js';
export type { CleanResult, CleanOptions } from './cleaner.js';
export { patchDocument } from './patcher.js';
export { verifyOutput, normalizeText, extractAllText } from './verifier.js';
export { ensureSourceDocx } from './downloader.js';
export { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
export type { OoxmlTextParts } from './ooxml-parts.js';
export type { RecipeRunOptions, RecipeRunResult, VerifyResult, VerifyCheck } from './types.js';
