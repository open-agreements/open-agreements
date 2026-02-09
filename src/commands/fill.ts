import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fillTemplate } from '../core/engine.js';
import { getTemplatesDir, resolveTemplateDir, getExternalDir, resolveExternalDir, getRecipesDir, resolveRecipeDir } from '../utils/paths.js';
import { runExternalFill } from '../core/external/index.js';
import { runRecipe } from '../core/recipe/index.js';

export interface FillArgs {
  template: string;
  output?: string;
  values: Record<string, string>;
}

export async function runFill(args: FillArgs): Promise<void> {
  // Search templates/ → external/ → recipes/
  const templateDir = resolveTemplateDir(args.template);
  const externalDir = resolveExternalDir(args.template);
  const recipeDir = resolveRecipeDir(args.template);

  const isTemplate = existsSync(templateDir);
  const isExternal = !isTemplate && existsSync(externalDir);
  const isRecipe = !isTemplate && !isExternal && existsSync(recipeDir);

  if (!isTemplate && !isExternal && !isRecipe) {
    const available = getAvailableIds();
    console.error(`Agreement "${args.template}" not found in templates, external, or recipes.`);
    if (available.length > 0) {
      console.error(`Available: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  const outputPath = args.output ?? `${args.template}-filled.docx`;
  const resolvedOutput = resolve(outputPath);

  try {
    if (isRecipe) {
      const result = await runRecipe({
        recipeId: args.template,
        outputPath: resolvedOutput,
        values: args.values,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    } else if (isExternal) {
      const result = await runExternalFill({
        externalId: args.template,
        outputPath: resolvedOutput,
        values: args.values,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    } else {
      const result = await fillTemplate({
        templateDir,
        values: args.values,
        outputPath: resolvedOutput,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

function getAvailableIds(): string[] {
  const ids: string[] = [];
  const templatesDir = getTemplatesDir();
  if (existsSync(templatesDir)) {
    ids.push(...readdirSync(templatesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name));
  }
  const extDir = getExternalDir();
  if (existsSync(extDir)) {
    ids.push(...readdirSync(extDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name));
  }
  const recipesDir = getRecipesDir();
  if (existsSync(recipesDir)) {
    ids.push(...readdirSync(recipesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name));
  }
  return ids;
}
