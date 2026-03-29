#!/usr/bin/env node
/**
 * Validate that Concerto model (.cto) fields match metadata.yaml fields
 * for each template that has both definitions.
 *
 * Prevents schema drift between the Concerto model (source of type truth)
 * and the metadata.yaml (source of fill pipeline truth).
 *
 * Usage: node scripts/validate_concerto_metadata_parity.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';

const CONCERTO_DIR = 'concerto';
const TEMPLATES_DIR = 'content/templates';

/**
 * Extract field names from a .cto file.
 * Parses `o <Type> <fieldName>` lines from the asset definition,
 * skipping inherited fields (contractId, clauseId).
 */
function extractCtoFields(ctoPath) {
  const content = readFileSync(ctoPath, 'utf-8');
  // Match "o TypeName fieldName" but only inside asset/concept blocks (indented lines)
  // Concerto fields look like: "  o String party_1_name" or "  o PartyType party_type default=..."
  const fieldPattern = /^\s+o\s+\S+\s+(\w+)(?:\s|$)/gm;
  const inherited = new Set(['contractId', 'clauseId']);
  // Skip lines inside enum blocks
  const enumBlockPattern = /^enum\s+\w+\s*\{[^}]*\}/gms;
  const contentWithoutEnums = content.replace(enumBlockPattern, '');
  const fields = [];
  let match;
  while ((match = fieldPattern.exec(contentWithoutEnums)) !== null) {
    const fieldName = match[1];
    if (!inherited.has(fieldName)) {
      fields.push(fieldName);
    }
  }
  return fields;
}

/**
 * Extract field names from a metadata.yaml file.
 */
function extractMetadataFields(metadataPath) {
  const content = readFileSync(metadataPath, 'utf-8');
  const metadata = yaml.load(content);
  return (metadata.fields || []).map(f => f.name);
}

/**
 * Infer which template a .cto file corresponds to by matching
 * the cto filename to a template directory name.
 * E.g., bonterms-mutual-nda.cto → content/templates/bonterms-mutual-nda/
 */
function findTemplateDir(ctoFilename) {
  const templateId = basename(ctoFilename, '.cto');
  const templateDir = join(TEMPLATES_DIR, templateId);
  if (existsSync(join(templateDir, 'metadata.yaml'))) {
    return templateDir;
  }
  return null;
}

// Main
const ctoFiles = readdirSync(CONCERTO_DIR).filter(f => f.endsWith('.cto'));
let hasErrors = false;

for (const ctoFile of ctoFiles) {
  const templateDir = findTemplateDir(ctoFile);
  if (!templateDir) continue;

  const ctoPath = join(CONCERTO_DIR, ctoFile);
  const metadataPath = join(templateDir, 'metadata.yaml');

  const ctoFields = new Set(extractCtoFields(ctoPath));
  const metadataFields = new Set(extractMetadataFields(metadataPath));

  const inCtoOnly = [...ctoFields].filter(f => !metadataFields.has(f));
  const inMetadataOnly = [...metadataFields].filter(f => !ctoFields.has(f));

  if (inCtoOnly.length > 0 || inMetadataOnly.length > 0) {
    hasErrors = true;
    console.error(`\n❌ Schema drift: ${ctoFile} ↔ ${templateDir}/metadata.yaml`);
    if (inCtoOnly.length > 0) {
      console.error(`   In .cto only: ${inCtoOnly.join(', ')}`);
    }
    if (inMetadataOnly.length > 0) {
      console.error(`   In metadata.yaml only: ${inMetadataOnly.join(', ')}`);
    }
  } else {
    console.log(`✓ ${ctoFile} matches ${templateDir}/metadata.yaml (${ctoFields.size} fields)`);
  }
}

if (ctoFiles.length === 0) {
  console.log('No .cto files found in concerto/');
} else if (!hasErrors) {
  console.log('\nAll Concerto models match their metadata.yaml definitions.');
}

process.exit(hasErrors ? 1 : 0);
