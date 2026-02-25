#!/usr/bin/env node
/**
 * Migrate a closing checklist JSON file from array-based collections
 * to record-based collections (keyed by stable IDs).
 *
 * Usage:
 *   node scripts/migrate-checklist-to-records.mjs <path-to-json> [--dry-run]
 *
 * The script:
 * - Reads JSON with array-format collections
 * - Converts each collection: [{id: "x", ...}] → {"x": {id: "x", ...}}
 * - Checks for corruption: duplicate IDs, missing/empty IDs, non-object items
 * - Writes the converted JSON back (or prints preview with --dry-run)
 */

import { readFileSync, writeFileSync } from 'node:fs';

const COLLECTIONS = [
  { field: 'documents', idKey: 'document_id' },
  { field: 'checklist_entries', idKey: 'entry_id' },
  { field: 'action_items', idKey: 'action_id' },
  { field: 'issues', idKey: 'issue_id' },
];

function migrate(inputPath, dryRun) {
  const raw = readFileSync(inputPath, 'utf-8');
  const checklist = JSON.parse(raw);
  const errors = [];

  for (const { field, idKey } of COLLECTIONS) {
    const collection = checklist[field];
    if (!collection) continue;

    // Already a record — skip
    if (!Array.isArray(collection)) {
      console.log(`  [skip] ${field} is already a record`);
      continue;
    }

    const record = {};
    for (let i = 0; i < collection.length; i++) {
      const item = collection[i];
      if (typeof item !== 'object' || item === null) {
        errors.push(`${field}[${i}]: not an object`);
        continue;
      }
      const id = item[idKey];
      if (!id || typeof id !== 'string') {
        errors.push(`${field}[${i}]: missing or empty ${idKey}`);
        continue;
      }
      if (record[id]) {
        errors.push(`${field}[${i}]: duplicate ${idKey} "${id}"`);
        continue;
      }
      record[id] = item;
    }

    checklist[field] = record;
    console.log(`  [migrated] ${field}: ${collection.length} items → ${Object.keys(record).length} keys`);
  }

  if (errors.length > 0) {
    console.error('\nCorruption errors found:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const output = JSON.stringify(checklist, null, 2) + '\n';

  if (dryRun) {
    console.log('\n--- DRY RUN (no file written) ---');
    console.log(output);
  } else {
    writeFileSync(inputPath, output, 'utf-8');
    console.log(`\nWritten to ${inputPath}`);
  }
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filePath = args.find((a) => !a.startsWith('--'));

if (!filePath) {
  console.error('Usage: node scripts/migrate-checklist-to-records.mjs <path-to-json> [--dry-run]');
  process.exit(1);
}

console.log(`Migrating: ${filePath}${dryRun ? ' (dry-run)' : ''}`);
migrate(filePath, dryRun);
