import { validateMetadata } from '../core/metadata.js';
import { validateTemplate } from '../core/validation/template.js';
import { validateLicense } from '../core/validation/license.js';
import { validateRecipe } from '../core/validation/recipe.js';
import { validateExternal } from '../core/validation/external.js';
import {
  findExternalDir,
  findRecipeDir,
  findTemplateDir,
  listExternalEntries,
  listRecipeEntries,
  listTemplateEntries,
} from '../utils/paths.js';

export interface ValidateArgs {
  template?: string;
  strict?: boolean;
}

export function runValidate(args: ValidateArgs): void {
  if (args.template) {
    runValidateSingle(args);
    return;
  }

  let hasErrors = false;

  // Validate templates
  hasErrors = validateTemplates(listTemplateEntries().map((entry) => ({
    id: entry.id,
    dir: entry.dir,
  }))) || hasErrors;

  // Validate external templates (unless a specific template was requested)
  hasErrors = validateExternalTemplates(listExternalEntries().map((entry) => ({
    id: entry.id,
    dir: entry.dir,
  }))) || hasErrors;

  // Validate recipes (unless a specific template was requested)
  hasErrors = validateRecipes(
    listRecipeEntries().map((entry) => ({ id: entry.id, dir: entry.dir })),
    args
  ) || hasErrors;

  if (hasErrors) {
    console.error('Validation FAILED');
    process.exit(1);
  } else {
    console.log('Validation PASSED');
  }
}

function runValidateSingle(args: ValidateArgs): void {
  const id = args.template!;
  const templateDir = findTemplateDir(id);
  if (templateDir) {
    const hasErrors = validateTemplates([{ id, dir: templateDir }]);
    if (hasErrors) {
      console.error('Validation FAILED');
      process.exit(1);
    }
    console.log('Validation PASSED');
    return;
  }

  const externalDir = findExternalDir(id);
  if (externalDir) {
    const hasErrors = validateExternalTemplates([{ id, dir: externalDir }]);
    if (hasErrors) {
      console.error('Validation FAILED');
      process.exit(1);
    }
    console.log('Validation PASSED');
    return;
  }

  const recipeDir = findRecipeDir(id);
  if (recipeDir) {
    const hasErrors = validateRecipes([{ id, dir: recipeDir }], args);
    if (hasErrors) {
      console.error('Validation FAILED');
      process.exit(1);
    }
    console.log('Validation PASSED');
    return;
  }

  console.error(`Agreement "${id}" not found in templates, external, or recipes.`);
  process.exit(1);
}

function validateTemplates(entries: { id: string; dir: string }[]): boolean {
  if (entries.length === 0) {
    console.log('No templates found.');
    return false;
  }

  let hasErrors = false;

  for (const entry of entries) {
    const id = entry.id;
    const dir = entry.dir;
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

  console.log(`\n${entries.length} template(s) validated.`);
  return hasErrors;
}

function validateExternalTemplates(entries: { id: string; dir: string }[]): boolean {
  if (entries.length === 0) {
    return false;
  }

  let hasErrors = false;

  for (const entry of entries) {
    const id = entry.id;
    const dir = entry.dir;
    console.log(`\nValidating external: ${id}`);

    const result = validateExternal(dir, id);
    if (!result.valid) {
      hasErrors = true;
      for (const e of result.errors) console.error(`  FAIL: ${e}`);
    } else {
      console.log('  PASS');
    }
    for (const w of result.warnings) console.log(`  WARN: ${w}`);
  }

  console.log(`\n${entries.length} external template(s) validated.`);
  return hasErrors;
}

function validateRecipes(entries: { id: string; dir: string }[], args: ValidateArgs): boolean {
  if (entries.length === 0) {
    return false;
  }

  let hasErrors = false;

  for (const entry of entries) {
    const id = entry.id;
    const dir = entry.dir;
    console.log(`\nValidating recipe: ${id}`);

    const result = validateRecipe(dir, id, { strict: args.strict });
    if (!result.valid) {
      hasErrors = true;
      for (const e of result.errors) console.error(`  FAIL: ${e}`);
    } else {
      console.log(`  PASS${result.scaffold ? ' (scaffold)' : ''}`);
    }
    for (const w of result.warnings) console.log(`  WARN: ${w}`);
  }

  console.log(`\n${entries.length} recipe(s) validated.`);
  return hasErrors;
}
