import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadRecipeMetadata, loadCleanConfig } from '../metadata.js';
import { resolveRecipeDir } from '../../utils/paths.js';
import { cleanDocument } from './cleaner.js';
import { patchDocument } from './patcher.js';
import { verifyOutput } from './verifier.js';
import { ensureSourceDocx } from './downloader.js';
import { prepareFillData, fillDocx } from '../fill-pipeline.js';
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

  // Create temp directory for intermediate files
  const tempDir = mkdtempSync(join(tmpdir(), `recipe-${recipeId}-`));

  const stages: RecipeRunResult['stages'] = {
    clean: '',
    patch: '',
    fill: '',
  };

  try {
    // Copy input to temp dir
    const sourcePath = join(tempDir, 'source.docx');
    copyFileSync(inputPath, sourcePath);

    // Stage 1: Clean
    const cleanedPath = join(tempDir, 'cleaned.docx');
    await cleanDocument(sourcePath, cleanedPath, cleanConfig);
    stages.clean = cleanedPath;

    // Stage 2: Patch (replace [brackets] with {template_tags})
    const patchedPath = join(tempDir, 'patched.docx');
    await patchDocument(cleanedPath, patchedPath, replacements);
    stages.patch = patchedPath;

    // Stage 3: Fill (render template tags with values)
    const fillData = prepareFillData({
      values,
      fields: metadata.fields,
      useBlankPlaceholder: true,
    });

    const filledPath = join(tempDir, 'filled.docx');
    const templateBuf = readFileSync(patchedPath);
    const filledBuf = await fillDocx({
      templateBuffer: templateBuf,
      data: fillData,
    });
    writeFileSync(filledPath, filledBuf);
    stages.fill = filledPath;

    // Stage 4: Verify
    const verifyResult = await verifyOutput(filledPath, values, replacements, cleanConfig);
    if (!verifyResult.passed) {
      const failures = verifyResult.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.details ?? 'failed'}`)
        .join('; ');
      console.warn(`Warning: verification issues: ${failures}`);
    }

    // Copy final output to destination
    copyFileSync(filledPath, outputPath);

    if (keepIntermediate) {
      console.log(`Intermediate files preserved at: ${tempDir}`);
    }

    return {
      outputPath,
      metadata,
      fieldsUsed: Object.keys(values),
      stages,
    };
  } finally {
    if (!keepIntermediate) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export { cleanDocument } from './cleaner.js';
export { patchDocument } from './patcher.js';
export { verifyOutput, normalizeText } from './verifier.js';
export { ensureSourceDocx } from './downloader.js';
export { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';
export type { OoxmlTextParts } from './ooxml-parts.js';
export type { RecipeRunOptions, RecipeRunResult, VerifyResult, VerifyCheck } from './types.js';
