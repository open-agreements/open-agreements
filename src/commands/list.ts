import { readdirSync, existsSync } from 'node:fs';
import { loadMetadata, loadRecipeMetadata } from '../core/metadata.js';
import { getTemplatesDir, resolveTemplateDir, getRecipesDir, resolveRecipeDir } from '../utils/paths.js';

export function runList(): void {
  listTemplates();
  listRecipes();
}

function listTemplates(): void {
  const templatesDir = getTemplatesDir();

  if (!existsSync(templatesDir)) {
    console.log('No templates directory found.');
    return;
  }

  const dirs = readdirSync(templatesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (dirs.length === 0) {
    console.log('No templates found.');
    return;
  }

  console.log(`\n${'Template'.padEnd(40)} ${'License'.padEnd(14)} ${'Fields'.padEnd(8)} Source`);
  console.log('─'.repeat(100));

  for (const id of dirs) {
    const dir = resolveTemplateDir(id);
    try {
      const meta = loadMetadata(dir);
      const required = meta.fields.filter((f) => f.required).length;
      const total = meta.fields.length;
      console.log(
        `${id.padEnd(40)} ${meta.license.padEnd(14)} ${`${required}/${total}`.padEnd(8)} ${meta.source_url}`
      );
    } catch {
      console.log(`${id.padEnd(40)} ${'ERROR'.padEnd(14)} ${'—'.padEnd(8)} Could not load metadata`);
    }
  }
}

function listRecipes(): void {
  const recipesDir = getRecipesDir();

  if (!existsSync(recipesDir)) {
    return;
  }

  const dirs = readdirSync(recipesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (dirs.length === 0) {
    return;
  }

  console.log(`\n${'Recipe'.padEnd(40)} ${'Version'.padEnd(14)} ${'Fields'.padEnd(8)} Source`);
  console.log('─'.repeat(100));

  for (const id of dirs) {
    const dir = resolveRecipeDir(id);
    try {
      const meta = loadRecipeMetadata(dir);
      const fieldCount = meta.fields.length;
      const optionalTag = meta.optional ? ' (optional)' : '';
      console.log(
        `${(id + optionalTag).padEnd(40)} ${meta.source_version.padEnd(14)} ${`${fieldCount}`.padEnd(8)} ${meta.source_url}`
      );
    } catch {
      console.log(`${id.padEnd(40)} ${'ERROR'.padEnd(14)} ${'—'.padEnd(8)} Could not load metadata`);
    }
  }

  console.log('');
}
