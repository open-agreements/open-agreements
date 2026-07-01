#!/usr/bin/env npx tsx
/**
 * Prepare Bonterms templates from source DOCX cover pages.
 *
 * Discovers source.json files under each template directory and, for each one:
 *   1. Runs cleanDocument() with the clean config
 *   2. Runs patchDocument() with the replacements
 *   3. Writes the result as template.docx
 *
 * Usage:
 *   npx tsx scripts/prepare-bonterms-templates.ts /tmp/bonterms-sources/
 *
 * The sources directory should contain the original DOCX files referenced
 * by source_file in each source.json (e.g., nda-cover-page.docx).
 */

import { existsSync, readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { cleanDocument } from '../src/core/recipe/cleaner.js';
import { patchDocument } from '../src/core/recipe/patcher.js';
import { CleanConfigSchema } from '../src/core/metadata.js';

interface SourceConfig {
  source_file: string;
  clean: Record<string, unknown>;
  replacementColor?: string;
  replacements: Record<string, string>;
}

async function main() {
  const sourcesDir = process.argv[2];
  if (!sourcesDir) {
    console.error('Usage: npx tsx scripts/prepare-bonterms-templates.ts <sources-dir>');
    console.error('  <sources-dir>: directory containing source DOCX files');
    process.exit(1);
  }

  const resolvedSourcesDir = resolve(sourcesDir);
  if (!existsSync(resolvedSourcesDir)) {
    console.error(`Error: sources directory not found: ${resolvedSourcesDir}`);
    process.exit(1);
  }

  const projectRoot = resolve(import.meta.dirname!, '..');
  const templatesDir = join(projectRoot, 'templates');

  // Discover all source.json files
  const templateDirs = readdirSync(templatesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let processed = 0;

  for (const dirName of templateDirs) {
    const sourceJsonPath = join(templatesDir, dirName, 'source.json');
    if (!existsSync(sourceJsonPath)) continue;

    const config: SourceConfig = JSON.parse(readFileSync(sourceJsonPath, 'utf-8'));
    const sourceDocx = join(resolvedSourcesDir, config.source_file);

    if (!existsSync(sourceDocx)) {
      console.error(`Error: source file not found: ${sourceDocx}`);
      process.exit(1);
    }

    console.log(`\nProcessing: ${dirName}`);
    console.log(`  Source: ${config.source_file}`);

    const tempDir = mkdtempSync(join(tmpdir(), `prepare-${dirName}-`));

    try {
      // Stage 1: Clean
      const cleanConfig = CleanConfigSchema.parse(config.clean);
      const cleanedPath = join(tempDir, 'cleaned.docx');
      await cleanDocument(sourceDocx, cleanedPath, cleanConfig);
      console.log('  Cleaned');

      // Stage 2: Patch
      const outputPath = join(templatesDir, dirName, 'template.docx');
      const patchOpts = config.replacementColor ? { replacementColor: config.replacementColor } : undefined;
      await patchDocument(cleanedPath, outputPath, config.replacements, patchOpts);
      console.log(`  Patched → ${outputPath}`);

      processed++;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  if (processed === 0) {
    console.log('No source.json files found in templates/');
  } else {
    console.log(`\nDone! Processed ${processed} template(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
