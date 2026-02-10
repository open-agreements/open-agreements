import { resolve } from 'node:path';
import { fillTemplate } from '../core/engine.js';
import {
  findTemplateDir,
  findExternalDir,
  findRecipeDir,
  listTemplateIds,
  listExternalIds,
  listRecipeIds,
} from '../utils/paths.js';
import { runExternalFill } from '../core/external/index.js';
import { runRecipe } from '../core/recipe/index.js';

export interface FillArgs {
  template: string;
  output?: string;
  values: Record<string, string>;
}

export async function runFill(args: FillArgs): Promise<void> {
  // Search templates/ → external/ → recipes/
  const templateDir = findTemplateDir(args.template);
  const externalDir = findExternalDir(args.template);
  const recipeDir = findRecipeDir(args.template);

  const isTemplate = templateDir !== undefined;
  const isExternal = !isTemplate && externalDir !== undefined;
  const isRecipe = !isTemplate && !isExternal && recipeDir !== undefined;

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
        templateDir: templateDir!,
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
  return [...new Set([...listTemplateIds(), ...listExternalIds(), ...listRecipeIds()])];
}
