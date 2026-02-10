import { resolve } from 'node:path';
import type { Command } from 'commander';
import { INDEX_FILE } from '../core/constants.js';
import { buildStatusIndex, collectWorkspaceDocuments, writeStatusIndex } from '../core/indexer.js';
import { lintWorkspace } from '../core/lint.js';

export function registerStatusCommand(program: Command): void {
  const statusCmd = program
    .command('status')
    .description('Generate and lint workspace status tracking data');

  statusCmd
    .command('generate')
    .description('Generate contracts-index.yaml from current workspace files')
    .option('--output <path>', `Output file path relative to cwd (default: ${INDEX_FILE})`)
    .action((opts: { output?: string }) => {
      const rootDir = process.cwd();
      const output = opts.output ?? INDEX_FILE;

      const documents = collectWorkspaceDocuments(rootDir);
      const firstLint = lintWorkspace(rootDir);
      const initialIndex = buildStatusIndex(rootDir, documents, firstLint);
      writeStatusIndex(rootDir, initialIndex, output);

      const finalLint = lintWorkspace(rootDir);
      const finalIndex = buildStatusIndex(rootDir, documents, finalLint);
      const indexPath = writeStatusIndex(rootDir, finalIndex, output);

      console.log(`Generated status index: ${resolve(indexPath)}`);
      console.log(`Documents indexed: ${finalIndex.summary.total_documents}`);
      console.log(`Warnings: ${finalIndex.lint.warning_count}, Errors: ${finalIndex.lint.error_count}`);

      if (finalIndex.lint.error_count > 0) {
        process.exitCode = 1;
      }
    });

  statusCmd
    .command('lint')
    .description('Lint workspace structure, naming rules, and stale index state')
    .action(() => {
      const rootDir = process.cwd();
      const report = lintWorkspace(rootDir);

      if (report.findings.length === 0) {
        console.log('Workspace lint passed with no findings.');
        return;
      }

      for (const finding of report.findings) {
        const path = finding.path ? ` (${finding.path})` : '';
        console.log(`[${finding.severity}] ${finding.code}${path}: ${finding.message}`);
      }

      console.log(`Errors: ${report.errorCount}, Warnings: ${report.warningCount}`);
      if (report.errorCount > 0) {
        process.exitCode = 1;
      }
    });
}
