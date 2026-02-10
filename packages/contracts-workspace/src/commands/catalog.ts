import { resolve } from 'node:path';
import type { Command } from 'commander';
import { CATALOG_FILE } from '../core/constants.js';
import { catalogPath, fetchCatalogEntries, validateCatalog } from '../core/catalog.js';

export function registerCatalogCommand(program: Command): void {
  const catalogCmd = program
    .command('catalog')
    .description('Validate and fetch forms from the workspace catalog');

  catalogCmd
    .command('validate')
    .description('Validate forms-catalog.yaml schema and required fields')
    .option('--catalog <path>', `Catalog path (default: ${CATALOG_FILE} in cwd)`)
    .action((opts: { catalog?: string }) => {
      const rootDir = process.cwd();
      const filePath = opts.catalog ? resolve(opts.catalog) : catalogPath(rootDir);

      const validation = validateCatalog(filePath);
      if (!validation.valid) {
        console.error(`Catalog validation failed: ${filePath}`);
        for (const error of validation.errors) {
          console.error(`- ${error}`);
        }
        process.exitCode = 1;
        return;
      }

      console.log(`Catalog is valid: ${filePath}`);
      console.log(`Entries: ${validation.catalog.entries.length}`);
    });

  catalogCmd
    .command('fetch [ids...]')
    .description('Download allowed catalog entries and verify SHA-256 checksums')
    .option('--catalog <path>', `Catalog path (default: ${CATALOG_FILE} in cwd)`)
    .action(async (ids: string[], opts: { catalog?: string }) => {
      const rootDir = process.cwd();
      const filePath = opts.catalog ? resolve(opts.catalog) : catalogPath(rootDir);

      const summary = await fetchCatalogEntries({
        rootDir,
        catalogFilePath: filePath,
        ids,
      });

      for (const result of summary.results) {
        const destination = result.path ? ` (${result.path})` : '';
        console.log(`[${result.status}] ${result.id}${destination}: ${result.message}`);
      }

      console.log(
        `Downloaded: ${summary.downloadedCount}, Pointer-only: ${summary.pointerOnlyCount}, Failed: ${summary.failedCount}`
      );

      if (summary.failedCount > 0) {
        process.exitCode = 1;
      }
    });
}
