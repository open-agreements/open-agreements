import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRecipeMetadata, loadCleanConfig, loadNormalizeConfig } from '../metadata.js';
import { resolveRecipeDir } from '../../utils/paths.js';
import { verifyOutput } from './verifier.js';
import { ensureSourceDocx } from './downloader.js';
import {
  loadComputedProfile,
  evaluateComputedProfile,
  buildComputedArtifact,
  buildPassthroughArtifact,
  writeComputedArtifact,
} from './computed.js';
import { normalizeBracketArtifacts } from './bracket-normalizer.js';
import { runFillPipeline } from '../unified-pipeline.js';
import type { RecipeRunOptions, RecipeRunResult } from './types.js';

/**
 * Run the full recipe pipeline: clean → patch → fill → verify.
 * If no inputPath is provided, auto-downloads the source document from source_url.
 */
export async function runRecipe(options: RecipeRunOptions): Promise<RecipeRunResult> {
  const { recipeId, outputPath, values, keepIntermediate, computedOutPath } = options;
  const recipeDir = resolveRecipeDir(recipeId);

  const metadata = loadRecipeMetadata(recipeDir);
  const cleanConfig = loadCleanConfig(recipeDir);
  const normalizeConfig = loadNormalizeConfig(recipeDir);

  // Resolve input: explicit path or auto-download
  const inputPath = options.inputPath ?? await ensureSourceDocx(recipeId, metadata);

  // Load replacements.json
  const replacementsPath = join(recipeDir, 'replacements.json');
  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
  const replacementFieldNames = new Set<string>();
  for (const replacement of Object.values(replacements)) {
    for (const match of replacement.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      replacementFieldNames.add(match[1]);
    }
  }

  const inputValues = { ...values };
  const computedProfile = loadComputedProfile(recipeDir);
  const computedEvaluation = computedProfile ? evaluateComputedProfile(computedProfile, inputValues) : null;
  const effectiveValues = computedEvaluation ? computedEvaluation.fillValues : inputValues;
  const verificationValues: Record<string, string> = {};
  for (const field of metadata.fields) {
    if (!replacementFieldNames.has(field.name)) {
      continue;
    }
    const value = effectiveValues[field.name];
    if (typeof value === 'string') {
      verificationValues[field.name] = value;
    }
  }
  const computedArtifact = computedEvaluation && computedProfile
    ? buildComputedArtifact({
      recipeId,
      inputValues,
      evaluated: computedEvaluation,
      profileVersion: computedProfile.version,
    })
    : (computedOutPath ? buildPassthroughArtifact({ recipeId, inputValues }) : undefined);

  if (computedOutPath && computedArtifact) {
    writeComputedArtifact(computedOutPath, computedArtifact);
  }

  const shouldNormalizeBracketArtifacts =
    options.normalizeBracketArtifacts ?? recipeId === 'nvca-stock-purchase-agreement';

  const result = await runFillPipeline({
    inputPath,
    outputPath,
    values: effectiveValues,
    fields: metadata.fields,
    requiredFieldNames: metadata.required_fields,
    cleanPatch: { cleanConfig, replacements },
    postProcess: shouldNormalizeBracketArtifacts
      ? async (outputDocPath: string) => {
        await normalizeBracketArtifacts(outputDocPath, outputDocPath, {
          rules: normalizeConfig.paragraph_rules,
          fieldValues: effectiveValues,
        });
      }
      : undefined,
    verify: (p) => verifyOutput(p, verificationValues, replacements, cleanConfig),
    keepIntermediate,
  });

  return {
    outputPath: result.outputPath,
    metadata,
    fieldsUsed: result.fieldsUsed,
    stages: result.stages!,
    computedArtifact,
    computedOutPath,
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
export type { ComputedArtifact, ComputedProfile } from './computed.js';
