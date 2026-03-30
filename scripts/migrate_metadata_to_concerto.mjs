#!/usr/bin/env node
/**
 * Auto-generate Concerto .cto models from metadata.yaml definitions.
 *
 * For each template/external/recipe with a metadata.yaml, generates a
 * corresponding .cto file in concerto/ that:
 * - Extends Contract (from Accord Project base models)
 * - Has flat fields matching metadata.yaml field names exactly
 * - Maps metadata types to Concerto types (string→String, date→String,
 *   number→Double, boolean→Boolean, enum→enum)
 * - Includes defaults where specified
 *
 * Usage:
 *   node scripts/migrate_metadata_to_concerto.mjs              # dry run
 *   node scripts/migrate_metadata_to_concerto.mjs --write      # write files
 *   node scripts/migrate_metadata_to_concerto.mjs --write --overwrite  # overwrite existing
 *
 * Skips templates that already have a .cto file (unless --overwrite).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';

const CONCERTO_DIR = 'concerto';
const CONTENT_DIRS = [
  { path: 'content/templates', type: 'template' },
  { path: 'content/external', type: 'external' },
  { path: 'content/recipes', type: 'recipe' },
];

const WRITE = process.argv.includes('--write');
const OVERWRITE = process.argv.includes('--overwrite');

/** Map metadata field types to Concerto types. */
function toConcertoType(metadataType) {
  switch (metadataType) {
    case 'string': return 'String';
    case 'date': return 'String'; // Fill pipeline is string-pass-through
    case 'number': return 'Double';
    case 'boolean': return 'Boolean';
    case 'enum': return null; // Handled separately (generates enum declaration)
    case 'array': return 'String[]';
    default: return 'String';
  }
}

/** Convert template-id to PascalCase asset name. */
function toAssetName(templateId) {
  return templateId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** Sanitize a string for use as a Concerto enum value. Must start with uppercase. */
function toEnumValue(str) {
  let val = str.replace(/[^a-zA-Z0-9_]/g, '_');
  // Concerto enum values must start with a letter
  if (/^[^a-zA-Z]/.test(val)) val = 'V_' + val;
  return val;
}

/** Derive a namespace from the template source + id. */
function toNamespace(templateId, metadata) {
  const sourceUrl = metadata.source_url || '';
  // Use source org as middle segment, template id as leaf
  let org;
  if (sourceUrl.includes('commonpaper.com')) org = 'commonpaper';
  else if (/bonterms/i.test(sourceUrl) || /Bonterms/i.test(metadata.name || '')) org = 'bonterms';
  else if (sourceUrl.includes('ycombinator') || sourceUrl.includes('Y Combinator')) org = 'yc';
  else if (sourceUrl.includes('nvca.org')) org = 'nvca';
  else org = 'custom';
  // Convert template-id kebab to dot notation for namespace leaf
  const leaf = templateId.replace(/-/g, '');
  return `org.openagreements.${org}.${leaf}`;
}

/** Generate a .cto file from metadata. */
function generateCto(templateId, metadata) {
  const namespace = toNamespace(templateId, metadata);
  const assetName = toAssetName(templateId);
  const lines = [];

  lines.push(`namespace ${namespace}@1.0.0`);
  lines.push('');
  lines.push('import org.accordproject.contract.Contract from https://models.accordproject.org/accordproject/contract.cto');
  lines.push('');

  // Collect doc comment
  if (metadata.description) {
    lines.push('/**');
    lines.push(` * ${metadata.name}`);
    lines.push(' *');
    const descLines = metadata.description.match(/.{1,75}(\s|$)/g) || [metadata.description];
    for (const dl of descLines) {
      lines.push(` * ${dl.trim()}`);
    }
    if (metadata.source_url) {
      lines.push(` * Source: ${metadata.source_url}`);
    }
    if (metadata.license) {
      lines.push(` * License: ${metadata.license}`);
    }
    lines.push(' */');
  }

  // Generate enum declarations for enum fields
  const enumFields = (metadata.fields || []).filter(f => f.type === 'enum' && f.options?.length > 0);
  for (const field of enumFields) {
    const enumName = toAssetName(field.name) + 'Type';
    lines.push('');
    lines.push(`enum ${enumName} {`);
    for (const opt of field.options) {
      lines.push(`  o ${toEnumValue(opt)}`);
    }
    lines.push('}');
  }

  // Generate asset
  lines.push('');
  lines.push(`asset ${assetName} extends Contract {`);

  for (const field of (metadata.fields || [])) {
    let typeName;
    if (field.type === 'enum') {
      typeName = toAssetName(field.name) + 'Type';
    } else {
      typeName = toConcertoType(field.type);
    }

    let line = `  o ${typeName} ${field.name}`;

    // Add default if present
    if (field.default !== undefined && field.default !== null) {
      const defaultStr = String(field.default);
      if (field.type === 'boolean') {
        line += ` default=${defaultStr}`;
      } else if (field.type === 'enum') {
        line += ` default="${toEnumValue(defaultStr)}"`;
      } else if (field.type === 'number') {
        line += ` default=${defaultStr}`;
      } else {
        // Escape quotes in default values
        line += ` default="${defaultStr.replace(/"/g, '\\"')}"`;
      }
    }

    // Make non-priority fields optional if they have defaults
    // (priority fields are always required)
    const isPriority = (metadata.priority_fields || []).includes(field.name);
    if (!isPriority && field.default === undefined) {
      line += ' optional';
    }

    lines.push(line);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// Main
let generated = 0;
let skipped = 0;
let errors = 0;

for (const { path: contentDir, type } of CONTENT_DIRS) {
  if (!existsSync(contentDir)) continue;

  const entries = readdirSync(contentDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const templateId of entries) {
    const metadataPath = join(contentDir, templateId, 'metadata.yaml');
    if (!existsSync(metadataPath)) continue;

    const ctoPath = join(CONCERTO_DIR, `${templateId}.cto`);

    if (existsSync(ctoPath) && !OVERWRITE) {
      console.log(`  skip  ${templateId} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const raw = readFileSync(metadataPath, 'utf-8');
      const metadata = yaml.load(raw);

      if (!metadata.fields || metadata.fields.length === 0) {
        console.log(`  skip  ${templateId} (no fields)`);
        skipped++;
        continue;
      }

      const cto = generateCto(templateId, metadata);

      if (WRITE) {
        writeFileSync(ctoPath, cto, 'utf-8');
        console.log(`  write ${ctoPath} (${metadata.fields.length} fields)`);
      } else {
        console.log(`  would write ${ctoPath} (${metadata.fields.length} fields)`);
      }
      generated++;
    } catch (err) {
      console.error(`  ERROR ${templateId}: ${err.message}`);
      errors++;
    }
  }
}

console.log(`\n${WRITE ? 'Written' : 'Would write'}: ${generated}  Skipped: ${skipped}  Errors: ${errors}`);
if (!WRITE && generated > 0) {
  console.log('\nDry run — pass --write to generate files.');
}
