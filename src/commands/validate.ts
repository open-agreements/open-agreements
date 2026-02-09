import { readdirSync, existsSync } from 'node:fs';
import { validateMetadata, validateRecipeMetadata } from '../core/metadata.js';
import { validateTemplate } from '../core/validation/template.js';
import { validateLicense } from '../core/validation/license.js';
import { validateRecipe } from '../core/validation/recipe.js';
import { getTemplatesDir, resolveTemplateDir, getRecipesDir, resolveRecipeDir } from '../utils/paths.js';

export interface ValidateArgs {
  template?: string;
}

export function runValidate(args: ValidateArgs): void {
  let hasErrors = false;

  // Validate templates
  hasErrors = validateTemplates(args) || hasErrors;

  // Validate recipes (unless a specific template was requested)
  if (!args.template) {
    hasErrors = validateRecipes() || hasErrors;
  }

  if (hasErrors) {
    console.error('Validation FAILED');
    process.exit(1);
  } else {
    console.log('Validation PASSED');
  }
}

function validateTemplates(args: ValidateArgs): boolean {
  const templatesDir = getTemplatesDir();
  let templateIds: string[];

  if (args.template) {
    templateIds = [args.template];
  } else {
    if (!existsSync(templatesDir)) {
      console.log('No templates directory found.');
      return false;
    }
    templateIds = readdirSync(templatesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  let hasErrors = false;

  for (const id of templateIds) {
    const dir = resolveTemplateDir(id);
    console.log(`\nValidating template: ${id}`);

    const metaResult = validateMetadata(dir);
    if (!metaResult.valid) {
      hasErrors = true;
      console.error(`  FAIL metadata: ${metaResult.errors.join('; ')}`);
    } else {
      console.log('  PASS metadata');
    }

    const tmplResult = validateTemplate(dir, id);
    if (!tmplResult.valid) {
      hasErrors = true;
      for (const e of tmplResult.errors) console.error(`  FAIL template: ${e}`);
    } else {
      console.log('  PASS template');
    }
    for (const w of tmplResult.warnings) console.log(`  WARN template: ${w}`);

    const licResult = validateLicense(dir, id);
    if (!licResult.valid) {
      hasErrors = true;
      for (const e of licResult.errors) console.error(`  FAIL license: ${e}`);
    } else {
      console.log('  PASS license');
    }
  }

  console.log(`\n${templateIds.length} template(s) validated.`);
  return hasErrors;
}

function validateRecipes(): boolean {
  const recipesDir = getRecipesDir();
  if (!existsSync(recipesDir)) {
    return false;
  }

  const recipeIds = readdirSync(recipesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (recipeIds.length === 0) {
    return false;
  }

  let hasErrors = false;

  for (const id of recipeIds) {
    const dir = resolveRecipeDir(id);
    console.log(`\nValidating recipe: ${id}`);

    const result = validateRecipe(dir, id);
    if (!result.valid) {
      hasErrors = true;
      for (const e of result.errors) console.error(`  FAIL: ${e}`);
    } else {
      console.log('  PASS');
    }
    for (const w of result.warnings) console.log(`  WARN: ${w}`);
  }

  console.log(`\n${recipeIds.length} recipe(s) validated.`);
  return hasErrors;
}
