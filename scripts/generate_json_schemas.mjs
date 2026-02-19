#!/usr/bin/env node

/**
 * Generate JSON Schema files from Zod schemas.
 *
 * Reads compiled Zod schemas from the contracts-workspace package and
 * produces JSON Schema files for:
 *   - forms-catalog.yaml  -> forms-catalog.schema.json
 *   - conventions.yaml    -> conventions.schema.json
 *
 * Canonical output: packages/contracts-workspace/schemas/
 * Copy for site:    site/schemas/
 *
 * Usage: node scripts/generate_json_schemas.mjs
 * Prerequisite: npm run build:workspace
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Import compiled Zod schemas — fail fast if workspace not built
let FormsCatalogSchema, ConventionConfigSchema;
try {
  const catalogMod = await import(
    resolve(root, 'packages/contracts-workspace/dist/core/catalog.js')
  );
  const conventionMod = await import(
    resolve(root, 'packages/contracts-workspace/dist/core/convention-config.js')
  );
  FormsCatalogSchema = catalogMod.FormsCatalogSchema;
  ConventionConfigSchema = conventionMod.ConventionConfigSchema;
} catch (error) {
  console.error(
    'Error: Could not import compiled workspace schemas.\n' +
    'Run "npm run build:workspace" before "npm run generate:schemas".\n\n' +
    error.message
  );
  process.exit(1);
}

const BASE_URL = 'https://openagreements.ai/schemas';

const schemas = [
  {
    name: 'forms-catalog',
    schema: FormsCatalogSchema,
    title: 'Forms Catalog',
    description:
      'Schema for forms-catalog.yaml used by @open-agreements/contracts-workspace.',
  },
  {
    name: 'conventions',
    schema: ConventionConfigSchema,
    title: 'Conventions Config',
    description:
      'Schema for .contracts-workspace/conventions.yaml used by @open-agreements/contracts-workspace.',
  },
];

// Canonical output + site copy
const canonicalDir = resolve(root, 'packages/contracts-workspace/schemas');
const siteDir = resolve(root, 'site/schemas');

mkdirSync(canonicalDir, { recursive: true });
mkdirSync(siteDir, { recursive: true });

for (const { name, schema, title, description } of schemas) {
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: 'none',
  });

  // Add standard JSON Schema metadata at the top level
  jsonSchema.$id = `${BASE_URL}/${name}.schema.json`;
  jsonSchema.title = title;
  jsonSchema.description = description;

  const content = JSON.stringify(jsonSchema, null, 2) + '\n';
  const fileName = `${name}.schema.json`;

  // Write canonical
  const canonicalPath = resolve(canonicalDir, fileName);
  writeFileSync(canonicalPath, content, 'utf-8');
  console.log(`  wrote ${canonicalPath}`);

  // Copy to site
  const sitePath = resolve(siteDir, fileName);
  writeFileSync(sitePath, content, 'utf-8');
  console.log(`  copied ${sitePath}`);
}

console.log('JSON Schema generation complete.');
