import { resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { runRecipe, cleanDocument, patchDocument } from '../core/recipe/index.js';
import { loadCleanConfig } from '../core/metadata.js';
import { getRecipesDir, resolveRecipeDir } from '../utils/paths.js';

export interface RecipeRunArgs {
  recipeId: string;
  input: string;
  output?: string;
  data?: string;
  keepIntermediate?: boolean;
}

export async function runRecipeCommand(args: RecipeRunArgs): Promise<void> {
  const recipeDir = resolveRecipeDir(args.recipeId);

  if (!existsSync(recipeDir)) {
    const available = getAvailableRecipes();
    console.error(`Recipe "${args.recipeId}" not found.`);
    if (available.length > 0) {
      console.error(`Available recipes: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  let values: Record<string, string> = {};
  if (args.data) {
    values = JSON.parse(readFileSync(args.data, 'utf-8'));
  }

  const outputPath = resolve(args.output ?? `${args.recipeId}-filled.docx`);

  try {
    const result = await runRecipe({
      recipeId: args.recipeId,
      inputPath: resolve(args.input),
      outputPath,
      values,
      keepIntermediate: args.keepIntermediate,
    });
    console.log(`Filled ${result.metadata.name}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export interface RecipeCleanArgs {
  input: string;
  output: string;
  recipe: string;
}

export async function runRecipeClean(args: RecipeCleanArgs): Promise<void> {
  const recipeDir = resolveRecipeDir(args.recipe);
  const config = loadCleanConfig(recipeDir);

  try {
    await cleanDocument(resolve(args.input), resolve(args.output), config);
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

function getAvailableRecipes(): string[] {
  const recipesDir = getRecipesDir();
  if (!existsSync(recipesDir)) return [];
  return readdirSync(recipesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
