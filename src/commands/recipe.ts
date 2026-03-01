import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runRecipe, cleanDocument, patchDocument } from '../core/recipe/index.js';
import { loadCleanConfig } from '../core/metadata.js';
import { listRecipeIds, resolveRecipeDir } from '../utils/paths.js';

export interface RecipeRunArgs {
  recipeId: string;
  input?: string;
  output?: string;
  data?: string;
  keepIntermediate?: boolean;
  computedOut?: string;
  normalizeBrackets?: boolean;
}

export async function runRecipeCommand(args: RecipeRunArgs): Promise<void> {
  const recipeDir = resolveRecipeDir(args.recipeId);

  if (!existsSync(recipeDir)) {
    const available = listRecipeIds();
    console.error(`Recipe "${args.recipeId}" not found.`);
    if (available.length > 0) {
      console.error(`Available recipes: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  let values: Record<string, string | boolean> = {};
  if (args.data) {
    values = JSON.parse(readFileSync(args.data, 'utf-8'));
  }

  const outputPath = resolve(args.output ?? `${args.recipeId}-filled.docx`);

  try {
    const result = await runRecipe({
      recipeId: args.recipeId,
      inputPath: args.input ? resolve(args.input) : undefined,
      outputPath,
      values,
      keepIntermediate: args.keepIntermediate,
      computedOutPath: args.computedOut ? resolve(args.computedOut) : undefined,
      normalizeBracketArtifacts: args.normalizeBrackets,
    });
    console.log(`Filled ${result.metadata.name}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    if (result.computedOutPath && result.computedArtifact) {
      console.log(`Computed artifact: ${result.computedOutPath}`);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export interface RecipeCleanArgs {
  input: string;
  output: string;
  recipe: string;
  extractGuidance?: string;
}

export async function runRecipeClean(args: RecipeCleanArgs): Promise<void> {
  const recipeDir = resolveRecipeDir(args.recipe);
  const config = loadCleanConfig(recipeDir);
  const inputPath = resolve(args.input);

  try {
    if (args.extractGuidance) {
      const sourceData = readFileSync(inputPath);
      const sourceHash = createHash('sha256').update(sourceData).digest('hex');
      const cleanPath = resolve(recipeDir, 'clean.json');
      const configData = existsSync(cleanPath) ? readFileSync(cleanPath, 'utf-8') : '{}';
      const configHash = createHash('sha256').update(configData).digest('hex');

      const result = await cleanDocument(inputPath, resolve(args.output), config, {
        extractGuidance: true,
        sourceHash,
        configHash,
      });
      if (result.guidance) {
        writeFileSync(resolve(args.extractGuidance), JSON.stringify(result.guidance, null, 2) + '\n');
        console.log(`Guidance: ${args.extractGuidance} (${result.guidance.entries.length} entries)`);
      }
    } else {
      await cleanDocument(inputPath, resolve(args.output), config);
    }
    console.log(`Cleaned: ${args.output}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export interface RecipePatchArgs {
  input: string;
  output: string;
  recipe: string;
}

export async function runRecipePatch(args: RecipePatchArgs): Promise<void> {
  const recipeDir = resolveRecipeDir(args.recipe);
  const replacementsPath = resolve(recipeDir, 'replacements.json');
  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));

  try {
    await patchDocument(resolve(args.input), resolve(args.output), replacements);
    console.log(`Patched: ${args.output}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
